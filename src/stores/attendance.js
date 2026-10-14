import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { GAME_IDS } from '../utils/constants'
import { useWeekStateStore } from './weekState'
import { cloneForAudit, auditedWrite, captureAuditContext, newAuditOperationId, writeAuditLog } from '../utils/auditLog'

const PRESET_STATUSES = new Set(['confirmed', 'tentative', 'absent'])

export const useAttendanceStore = defineStore('attendance', () => {
  // { [gameId]: { schedule, date, records: [{ playerId, attendance }] } }
  const attendance = ref({})
  const loading = ref(false)

  function getGameAttendance(gameId) {
    return attendance.value[gameId] || { schedule: gameId, date: '', records: [] }
  }

  function isGameSkipped(gameId) {
    return attendance.value[gameId]?.skipped === true
  }

  function getPlayerAttendance(gameId, playerId) {
    const game = getGameAttendance(gameId)
    const record = game.records.find(r => r.playerId === playerId)
    return record?.attendance || 'no_response'
  }

  /** Get all attendance for a player across all games */
  function getPlayerReadiness(playerId) {
    const result = {}
    for (const gameId of GAME_IDS) {
      result[gameId] = getPlayerAttendance(gameId, playerId)
    }
    return result
  }

  const summary = computed(() => {
    const result = {}
    for (const gameId of GAME_IDS) {
      const counts = { confirmed: 0, tentative: 0, absent: 0, no_response: 0 }
      const records = attendance.value[gameId]?.records || []
      for (const r of records) {
        counts[r.attendance || 'no_response']++
      }
      result[gameId] = counts
    }
    return result
  })

  function unrespondedPlayers(gameId, allPlayers) {
    const records = attendance.value[gameId]?.records || []
    const respondedIds = new Set(records.filter(r => r.attendance !== 'no_response').map(r => r.playerId))
    return allPlayers.filter(p => !respondedIds.has(p.uid))
  }

  // --- Firestore ---
  let unsubscribes = []

  async function loadFirestore() {
    const { attendanceRef, onSnapshot } = await import('../firebase/firestore')

    const unsub = onSnapshot(attendanceRef, (snapshot) => {
      const data = {}
      snapshot.docs.forEach(d => { data[d.id] = d.data() })
      attendance.value = data
    })
    unsubscribes.push(unsub)
  }

  async function saveAttendanceFirestore(gameId, data) {
    const { doc, setDoc, serverTimestamp, db } = await import('../firebase/firestore')
    await setDoc(doc(db, 'attendance', gameId), { ...data, updatedAt: serverTimestamp() }, { merge: true })
  }

  async function deleteAttendanceFirestore(gameId) {
    const { doc, deleteDoc, db } = await import('../firebase/firestore')
    await deleteDoc(doc(db, 'attendance', gameId))
  }

  // --- Public API ---
  async function fetchAttendance() {
    loading.value = true
    try {
      await loadFirestore()
    } finally {
      loading.value = false
    }
  }

  const pending = new Map()
  function enqueue(gameId, work) {
    const task = (pending.get(gameId) || Promise.resolve()).catch(() => {}).then(work)
    pending.set(gameId, task)
    task.finally(() => { if (pending.get(gameId) === task) pending.delete(gameId) }).catch(() => {})
    return task
  }

  async function persist(gameId, before, after, eventType, metadata = {}, options = {}) {
    const next = cloneForAudit(after)
    await auditedWrite({ ...options, action: options.action || 'update', eventType,
      entityType: 'attendance', entityId: gameId, before, after: next, metadata,
    }, () => next ? saveAttendanceFirestore(gameId, next) : deleteAttendanceFirestore(gameId))
    if (next) attendance.value[gameId] = next
    else delete attendance.value[gameId]
  }

  // The local snapshot can be empty or stale. Read and change the server document
  // atomically so another browser's records survive, including transaction retries.
  async function updateAttendance(gameId, mutate, eventType, metadata = {}, options = {}) {
    const { doc, runTransaction, serverTimestamp, db } = await import('../firebase/firestore')
    const audit = { ...options, ...captureAuditContext(options) }
    let attempt = null
    let committed
    try {
      committed = await runTransaction(db, async transaction => {
        attempt = null
        const target = doc(db, 'attendance', gameId)
        const snap = await transaction.get(target)
        const before = snap.exists() ? cloneForAudit(snap.data()) : null
        const after = cloneForAudit(before) || { schedule: gameId, date: '', records: [] }
        const details = mutate(after)
        if (!details) return null
        attempt = { ...audit, action: 'update', eventType, entityType: 'attendance', entityId: gameId,
          before, after, metadata: { ...metadata, ...details },
        }
        transaction.set(target, { ...after, updatedAt: serverTimestamp() }, { merge: true })
        return attempt
      })
    } catch (error) {
      await writeAuditLog({ ...(attempt || { ...audit, action: 'update', eventType,
        entityType: 'attendance', entityId: gameId, metadata }), outcome: 'failure', severity: 'error',
        metadata: { ...(attempt?.metadata || metadata), error: { code: error.code || '', message: error.message || String(error) } },
      })
      throw error
    }
    if (!committed) return false
    attendance.value[gameId] = committed.after
    // Log only the committed attempt. A failed audit must never repeat the write.
    await writeAuditLog({ ...committed, outcome: 'success' })
    return true
  }

  function setPlayerAttendance(gameId, playerId, status) {
    const audit = { operationId: newAuditOperationId(), ...captureAuditContext() }
    return enqueue(gameId, async () => {
      const weekState = useWeekStateStore()
      const week = await weekState.ensureLockedForAttendance(audit)
      const changed = await updateAttendance(gameId, after => {
        if (after.skipped) return
        const record = after.records.find(r => r.playerId === playerId)
        if ((record?.attendance || 'no_response') === status) return
        after.date ||= gameId.startsWith('friday') ? week?.friday || '' : week?.saturday || ''
        if (record) record.attendance = status
        else after.records.push({ playerId, attendance: status })
        return {}
      }, 'attendance.changed', { playerId }, audit)
      if (!changed) return
      const { useAuthStore } = await import('./auth')
      if (status === 'absent' && useAuthStore().isUserAdmin) {
        const { useGamesStore } = await import('./games')
        await useGamesStore().unassignPlayerFromGame(gameId, playerId, audit)
      }
    })
  }

  async function applyAttendancePresets(players = [], options = {}) {
    const applicable = players.filter(p => p?.status === 'active' && p.attendancePreset?.enabled)
    if (!applicable.length) return
    const audit = { ...options, operationId: options.operationId || newAuditOperationId(), ...captureAuditContext(options) }
    for (const gameId of GAME_IDS) {
      if (!applicable.some(player => PRESET_STATUSES.has(player.attendancePreset?.[gameId]))) continue
      await enqueue(gameId, async () => {
        const week = await useWeekStateStore().ensureLockedForAttendance(audit)
        await updateAttendance(gameId, after => {
          if (after.skipped) return
          const playerIds = []
          for (const player of applicable) {
            const status = player.attendancePreset?.[gameId]
            if (!PRESET_STATUSES.has(status)) continue
            const record = after.records.find(r => r.playerId === player.uid)
            if (record && record.attendance && record.attendance !== 'no_response') continue
            if (record) record.attendance = status
            else after.records.push({ playerId: player.uid, attendance: status })
            playerIds.push(player.uid)
          }
          if (!playerIds.length) return
          after.date ||= gameId.startsWith('friday') ? week?.friday || '' : week?.saturday || ''
          return { playerIds }
        }, 'attendance.presets', { operation: 'apply-presets', automatic: true }, audit)
      })
    }
  }

  function setDate(gameId, date) {
    return enqueue(gameId, () => updateAttendance(gameId, after => {
      if (after.date === date) return
      after.date = date
      return {}
    }, 'attendance.date'))
  }

  function clearGameAttendance(gameId, options = {}) {
    return enqueue(gameId, async () => {
      const { doc, getDoc, db } = await import('../firebase/firestore')
      const snap = await getDoc(doc(db, 'attendance', gameId))
      if (!snap.exists()) return
      const before = cloneForAudit(snap.data())
      await persist(gameId, before, null, options.eventType || 'attendance.cleared', {}, { ...options, action: options.action || 'clear' })
    })
  }

  function skipGame(gameId, { date = '', ...options } = {}) {
    return enqueue(gameId, async () => {
      const before = cloneForAudit(getGameAttendance(gameId))
      const after = { schedule: gameId, date, records: [], skipped: true, skippedReason: 'game-cancelled' }
      await persist(gameId, before, after, 'game.skipped', {}, { ...options, action: 'skip' })
    })
  }

  async function clearAttendance(options = {}) {
    const audit = { ...options, operationId: options.operationId || newAuditOperationId() }
    for (const gameId of GAME_IDS) await clearGameAttendance(gameId, audit)
  }

  function cleanup() {
    unsubscribes.forEach(fn => fn())
    unsubscribes = []
  }

  return {
    attendance, loading,
    getGameAttendance, getPlayerAttendance, getPlayerReadiness,
    isGameSkipped, summary, unrespondedPlayers,
    fetchAttendance, setPlayerAttendance, applyAttendancePresets, setDate,
    clearGameAttendance, skipGame, clearAttendance, cleanup,
  }
})
