import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSquadConfig } from './squadConfig'

const API_BASE = 'https://stats.tsgames.ru/api/v1'

/**
 * TSG API endpoints:
 *   /player-stats/    — all players (общий рейтинг)
 *   /infantry-stats/  — infantry only
 *   /vehicle-stats/   — vehicle only
 *   /artillery-stats/ — artillery only
 *   /squad-stats/     — squad leaderboard
 *   /update-date/     — last update timestamp
 *
 * Player item fields:
 *   rank, delta, callsign, attendance, frags, tk, survival, medic, ego, efficiency, recordType
 *
 * Squad item fields:
 *   rank, delta, name, frags, tk, survival, attendance, vehicleFrags, infantryFrags,
 *   med, ksEfficiency, ego, efficiency, championCount
 */

export const useStatsStore = defineStore('stats', () => {
  const allStats = ref([])          // player-stats
  const infantryStats = ref([])     // infantry-stats
  const vehicleStats = ref([])      // vehicle-stats
  const artilleryStats = ref([])    // artillery-stats
  const squadStats = ref([])        // squad-stats
  const loading = ref(false)
  const fetchError = ref(null)
  const lastUpdated = ref(null)

  // Index by callsign (lowercase) for fast lookup
  const statsByCallsign = computed(() => {
    const map = {}
    for (const item of allStats.value) {
      if (item.callsign) map[item.callsign.toLowerCase()] = item
    }
    return map
  })

  function getStatsByNickname(nickname) {
    if (!nickname) return null
    return statsByCallsign.value[nickname.toLowerCase()] || null
  }

  /** Get normalized stats for ProfilePage/RosterPage */
  function getPlayerStats(nickname) {
    const raw = getStatsByNickname(nickname)
    if (!raw) return null
    return {
      rating: raw.rank,
      delta: raw.delta,
      attendance: raw.attendance,
      kills: raw.frags,
      teamkills: raw.tk,
      survival: raw.survival,
      medicine: raw.medic,
      chsv: raw.ego,
      kpd: raw.efficiency,
      recordType: raw.recordType,
    }
  }

  /** Get DELTA squad stats */
  const deltaSquad = computed(() => {
    const squad = useSquadConfig()
    return squadStats.value.find(s => s.name === squad.name) || null
  })

  /** Filter any stats array by a set of nicknames (case-insensitive) */
  function filterByNicknames(items, nicknames) {
    const set = new Set(nicknames.map(n => n.toLowerCase()))
    return items.filter(s => set.has((s.callsign || '').toLowerCase()))
  }

  /** Fetch all data from TSG API */
  async function fetchFromApi() {
    loading.value = true
    fetchError.value = null
    try {
      const endpoints = [
        'player-stats', 'infantry-stats', 'vehicle-stats',
        'artillery-stats', 'squad-stats', 'update-date',
      ]
      const results = await Promise.all(
        endpoints.map(ep =>
          fetch(`${API_BASE}/${ep}/`, { headers: { Accept: 'application/json' } })
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      )

      const [players, infantry, vehicle, artillery, squads, updateDate] = results

      if (players?.items) allStats.value = players.items
      if (infantry?.items) infantryStats.value = infantry.items
      if (vehicle?.items) vehicleStats.value = vehicle.items
      if (artillery?.items) artilleryStats.value = artillery.items
      if (squads?.items) squadStats.value = squads.items
      if (updateDate?.updated_at) lastUpdated.value = updateDate.updated_at

      // Cache
      localStorage.setItem('deltaops_tsg_stats', JSON.stringify({
        allStats: allStats.value,
        infantryStats: infantryStats.value,
        vehicleStats: vehicleStats.value,
        artilleryStats: artilleryStats.value,
        squadStats: squadStats.value,
        lastUpdated: lastUpdated.value,
        cachedAt: new Date().toISOString(),
      }))
    } catch (e) {
      fetchError.value = e.message
      loadFromCache()
    } finally {
      loading.value = false
    }
  }

  function loadFromCache() {
    try {
      const saved = localStorage.getItem('deltaops_tsg_stats')
      if (saved) {
        const data = JSON.parse(saved)
        allStats.value = data.allStats || []
        infantryStats.value = data.infantryStats || []
        vehicleStats.value = data.vehicleStats || []
        artilleryStats.value = data.artilleryStats || []
        squadStats.value = data.squadStats || []
        lastUpdated.value = data.lastUpdated || null
      }
    } catch {}
  }

  async function fetchStats() {
    loadFromCache()
    await fetchFromApi()
  }

  return {
    allStats, infantryStats, vehicleStats, artilleryStats, squadStats,
    loading, fetchError, lastUpdated, deltaSquad,
    getPlayerStats, getStatsByNickname, filterByNicknames,
    fetchStats, fetchFromApi,
  }
})
