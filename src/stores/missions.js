import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { GAME_IDS } from '../utils/constants'

export const useMissionsStore = defineStore('missions', () => {
  const missions = ref({})
  const loading = ref(false)
  const error = ref(null)

  function getMission(gameId) {
    return missions.value[gameId] || null
  }

  const availableMissions = computed(() => {
    return Object.entries(missions.value)
      .filter(([, m]) => m != null)
      .map(([slot, m]) => ({ slot, ...m }))
  })

  function getSideTeam(mission, sideColor, squadSide) {
    if (!mission?.rotationSides || !squadSide) return null
    for (const rot of mission.rotationSides) {
      if (rot.gameSides.some(gs => gs.color === sideColor)) {
        return rot.color === squadSide ? 'ally' : 'enemy'
      }
    }
    return null
  }

  function getGroupedSides(mission, squadSide) {
    if (!mission?.sides) return null
    if (!mission.rotationSides || !squadSide) return null
    const ally = []
    const enemy = []
    for (const side of mission.sides) {
      const team = getSideTeam(mission, side.color, squadSide)
      if (team === 'ally') ally.push(side)
      else if (team === 'enemy') enemy.push(side)
      else enemy.push(side)
    }
    return { ally, enemy }
  }

  function getSideFaction(mission, sideColor) {
    if (!mission?.rotationSides) return ''
    for (const rot of mission.rotationSides) {
      const gs = rot.gameSides.find(g => g.color === sideColor)
      if (gs) return gs.name
    }
    return ''
  }

  function getMissionStats(mission) {
    if (!mission) return null
    const totalPlayers = mission.sides.reduce((sum, s) => sum + (s.players || 0), 0)
    const totalSquads = mission.sides.reduce((sum, s) => sum + (s.squads?.length || 0), 0)
    const hasVehicles = mission.sides.some(s => s.vehicles && s.vehicles.trim() !== '')
    return { totalPlayers, totalSquads, hasVehicles }
  }

  // --- Firestore ---
  async function loadFirestore() {
    const { doc, getDoc, db } = await import('../firebase/firestore')
    const results = {}
    await Promise.all(GAME_IDS.map(async (gameId) => {
      try {
        const docRef = doc(db, 'missions', gameId)
        const snapshot = await getDoc(docRef)
        results[gameId] = snapshot.exists() ? snapshot.data() : null
      } catch (e) {
        console.warn(`Failed to fetch mission ${gameId}:`, e.message)
        results[gameId] = null
      }
    }))
    missions.value = results
  }

  // --- Public API ---
  async function fetchMissions() {
    loading.value = true
    error.value = null
    try {
      await loadFirestore()
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function refreshMissions() {
    await fetchMissions()
  }

  async function clearMission(gameId) {
    const { doc, deleteDoc, db } = await import('../firebase/firestore')
    await deleteDoc(doc(db, 'missions', gameId)).catch(() => {})
    delete missions.value[gameId]
  }

  async function clearMissions() {
    const { doc, deleteDoc, db } = await import('../firebase/firestore')
    await Promise.all(GAME_IDS.map(async (gameId) => {
      try { await deleteDoc(doc(db, 'missions', gameId)) } catch (e) { /* ignore */ }
    }))
    missions.value = {}
  }

  return {
    missions, loading, error,
    getMission, availableMissions, getMissionStats, getSideTeam, getSideFaction, getGroupedSides,
    fetchMissions, refreshMissions, clearMission, clearMissions,
  }
})
