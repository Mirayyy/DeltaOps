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
    const gameIds = Array.isArray(gameId) ? gameId : [gameId]
    const task = Promise.all(gameIds.map(id => (pending.get(id) || Promise.resolve()).catch(() => {}))).then(work)
    for (const id of gameIds) pending.set(id, task)
    task.finally(() => {
      for (const id of gameIds) if (pending.get(id) === task) pending.delete(id)
    }).catch(() => {})
    return task
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
        attempt = { ...audit, action: options.action || 'update', eventType, entityType: 'attendance', entityId: gameId,
          before, after, metadata: { ...metadata, ...details },
        }
        transaction.set(target, { ...after, updatedAt: serverTimestamp() }, { merge: true })
        return attempt
      })
    } catch (error) {
      await writeAuditLog({ ...(attempt || { ...audit, action: options.action || 'update', eventType,
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
      await auditedWrite({ ...options, action: options.action || 'clear',
        eventType: options.eventType || 'attendance.cleared', entityType: 'attendance', entityId: gameId,
        before, after: null,
      }, () => deleteAttendanceFirestore(gameId))
      delete attendance.value[gameId]
    })
  }

  function skipGame(gameId, { date = '', ...options } = {}) {
    return enqueue(gameId, () => updateAttendance(gameId, after => {
      if (after.skipped) return
      Object.assign(after, { schedule: gameId, date, records: [], skipped: true, skippedReason: 'game-cancelled' })
      return {}
    }, 'game.skipped', {}, { ...options, action: 'skip' }))
  }

  function restoreGame(gameId, options = {}) {
    return enqueue(gameId, () => updateAttendance(gameId, after => {
      if (!after.skipped) return
      after.skipped = false
      after.skippedReason = ''
      return {}
    }, 'game.restored', {}, { ...options, action: 'restore' }))
  }

  async function clearAttendance(options = {}) {
    const audit = { ...options, operationId: options.operationId || newAuditOperationId(), ...captureAuditContext(options) }
    return enqueue(GAME_IDS, async () => {
      const { doc, getDoc, writeBatch, db } = await import('../firebase/firestore')
      const snapshots = await Promise.all(GAME_IDS.map(id => getDoc(doc(db, 'attendance', id))))
      const existing = snapshots.filter(snap => snap.exists())
      if (!existing.length) return
      const batch = writeBatch(db)
      for (const snap of existing) batch.delete(snap.ref)
      const entries = existing.map(snap => ({ ...audit, action: options.action || 'clear',
        eventType: options.eventType || 'attendance.cleared', entityType: 'attendance', entityId: snap.id,
        before: cloneForAudit(snap.data()), after: null, metadata: { gameIds: existing.map(s => s.id) },
      }))
      // All four attendance documents are deleted together, or none are deleted.
      try {
        await batch.commit()
      } catch (error) {
        for (const entry of entries) await writeAuditLog({ ...entry, outcome: 'failure', severity: 'error',
          metadata: { ...entry.metadata, error: { code: error.code || '', message: error.message || String(error) } },
        })
        throw error
      }
      for (const snap of existing) delete attendance.value[snap.id]
      for (const entry of entries) await writeAuditLog({ ...entry, outcome: 'success' })
    })
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
    clearGameAttendance, skipGame, restoreGame, clearAttendance, cleanup,
  }
})
