import { computed, watch } from 'vue'
import { useGamesStore } from '../stores/games'
import { useAttendanceStore } from '../stores/attendance'
import { useArchiveStore } from '../stores/archive'
import {
  buildGameDateMap,
  getResolvedGameDateForSchedule,
  getResolvedGameDates,
  hasLiveWeekData,
  parseDateString,
} from '../utils/gameDates'

/**
 * Returns ISO week ID for a given date (e.g. "2026-W13")
 */
export function getWeekId(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

let syncingDates = false
let archiveFetchStarted = false

export function getGameDates(date = new Date(), context = {}) {
  return getResolvedGameDates({ now: date, ...context })
}

export function useGameWeek() {
  const gamesStore = useGamesStore()
  const attendanceStore = useAttendanceStore()
  const archiveStore = useArchiveStore()
  const now = new Date()

  if (!archiveFetchStarted && !archiveStore.loading && !archiveStore.archives.length) {
    archiveFetchStarted = true
    void archiveStore.fetchArchives()
  }

  const gameDates = computed(() => getResolvedGameDates({
    now,
    gamesById: gamesStore.games,
    attendanceById: attendanceStore.attendance,
    archives: archiveStore.archives,
  }))
  const currentWeekId = computed(() => {
    const fridayDate = parseDateString(gameDates.value.friday)
    return getWeekId(fridayDate || now)
  })

  watch(gameDates, async (resolvedDates) => {
    if (syncingDates || !resolvedDates.friday || !resolvedDates.saturday) return
    if (!gamesStore.initialized || !attendanceStore.initialized) return

    const dateMap = buildGameDateMap(resolvedDates)
    const missingDates = Object.entries(dateMap).filter(([gameId, date]) =>
      (!gamesStore.getGame(gameId)?.date || !attendanceStore.getGameAttendance(gameId)?.date) &&
      date,
    )

    if (!missingDates.length) return
    if (!hasLiveWeekData({
      gamesById: gamesStore.games,
      attendanceById: attendanceStore.attendance,
    })) return
    if (archiveStore.loading) return

    syncingDates = true
    try {
      await Promise.all(missingDates.flatMap(([gameId, date]) => {
        const writes = []
        if (!gamesStore.getGame(gameId)?.date) {
          writes.push(Promise.resolve(gamesStore.setGameMeta(gameId, { date })))
        }
        if (!attendanceStore.getGameAttendance(gameId)?.date) {
          writes.push(Promise.resolve(attendanceStore.setDate(gameId, date)))
        }
        return writes
      }))
    } finally {
      syncingDates = false
    }
  }, { immediate: true })

  const games = computed(() => [
    { id: 'friday_1', label: `Пятница 1`, date: getResolvedGameDateForSchedule('friday_1', gameDates.value), day: 'friday' },
    { id: 'friday_2', label: `Пятница 2`, date: getResolvedGameDateForSchedule('friday_2', gameDates.value), day: 'friday' },
    { id: 'saturday_1', label: `Суббота 1`, date: getResolvedGameDateForSchedule('saturday_1', gameDates.value), day: 'saturday' },
    { id: 'saturday_2', label: `Суббота 2`, date: getResolvedGameDateForSchedule('saturday_2', gameDates.value), day: 'saturday' },
  ])

  return { currentWeekId, gameDates, games }
}
