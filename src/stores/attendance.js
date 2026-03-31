import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { GAME_IDS } from '../utils/constants'

export const useAttendanceStore = defineStore('attendance', () => {
  // { [gameId]: { schedule, date, records: [{ playerId, attendance }] } }
  const attendance = ref({})
  const loading = ref(false)

  function getGameAttendance(gameId) {
    return attendance.value[gameId] || { schedule: gameId, date: '', records: [] }
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

  // --- Public API ---
  async function fetchAttendance() {
    loading.value = true
    try {
      await loadFirestore()
    } finally {
      loading.value = false
    }
  }

  async function setPlayerAttendance(gameId, playerId, status) {
    if (!attendance.value[gameId]) {
      attendance.value[gameId] = { schedule: gameId, date: '', records: [] }
    }

    const records = attendance.value[gameId].records
    const idx = records.findIndex(r => r.playerId === playerId)
    if (idx !== -1) {
      records[idx].attendance = status
    } else {
      records.push({ playerId, attendance: status })
    }

    // Auto-unassign from slots when marked absent
    if (status === 'absent') {
      const { useGamesStore } = await import('./games')
      const gamesStore = useGamesStore()
      gamesStore.unassignPlayerFromGame(gameId, playerId)
    }

    await saveAttendanceFirestore(gameId, attendance.value[gameId])
  }

  function setDate(gameId, date) {
    if (!attendance.value[gameId]) {
      attendance.value[gameId] = { schedule: gameId, date: '', records: [] }
    }
    attendance.value[gameId].date = date
    saveAttendanceFirestore(gameId, attendance.value[gameId])
  }

  /** Clear all attendance (new week reset) */
  async function clearAttendance() {
    const { doc, deleteDoc, db } = await import('../firebase/firestore')
    await Promise.all(GAME_IDS.map(id => deleteDoc(doc(db, 'attendance', id)).catch(() => {})))
    attendance.value = {}
  }

  function cleanup() {
    unsubscribes.forEach(fn => fn())
    unsubscribes = []
  }

  return {
    attendance, loading,
    getGameAttendance, getPlayerAttendance, getPlayerReadiness,
    summary, unrespondedPlayers,
    fetchAttendance, setPlayerAttendance, setDate, clearAttendance, cleanup,
  }
})
