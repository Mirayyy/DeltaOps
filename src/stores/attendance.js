import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { GAME_IDS } from '../utils/constants'
import { useWeekStateStore } from './weekState'
import { cloneForAudit, auditedWrite, captureAuditContext, newAuditOperationId } from '../utils/auditLog'

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

  function setPlayerAttendance(gameId, playerId, status) {
    const audit = { operationId: newAuditOperationId(), ...captureAuditContext() }
    return enqueue(gameId, async () => {
      if (getPlayerAttendance(gameId, playerId) === status) return
      const weekState = useWeekStateStore()
      const week = await weekState.ensureLockedForAttendance(audit)
      const before = cloneForAudit(getGameAttendance(gameId))
      const after = cloneForAudit(before)
      after.date ||= gameId.startsWith('friday') ? week?.friday || '' : week?.saturday || ''
      const record = after.records.find(r => r.playerId === playerId)
      if (record) record.attendance = status
      else after.records.push({ playerId, attendance: status })
      await persist(gameId, before, after, 'attendance.changed', { playerId }, audit)
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
      await enqueue(gameId, async () => {
        const before = cloneForAudit(getGameAttendance(gameId))
        const after = cloneForAudit(before)
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
        const week = await useWeekStateStore().ensureLockedForAttendance(audit)
        after.date ||= gameId.startsWith('friday') ? week?.friday || '' : week?.saturday || ''
        await persist(gameId, before, after, 'attendance.presets', { operation: 'apply-presets', automatic: true, playerIds }, audit)
      })
    }
  }

  function setDate(gameId, date) {
    return enqueue(gameId, () => {
      const before = cloneForAudit(getGameAttendance(gameId))
      return persist(gameId, before, { ...before, date }, 'attendance.date')
    })
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
