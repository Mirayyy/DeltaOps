import { computed } from 'vue'

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

/**
 * Returns the Friday and Saturday dates for the current game week
 */
export function getGameDates(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun, 5=Fri, 6=Sat
  // Find this week's Friday
  const diff = 5 - day
  const friday = new Date(d)
  friday.setDate(d.getDate() + (diff <= 0 && day !== 0 ? diff + 7 : diff))

  const saturday = new Date(friday)
  saturday.setDate(friday.getDate() + 1)

  return {
    friday: formatDate(friday),
    saturday: formatDate(saturday),
  }
}

function formatDate(d) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

export function useGameWeek() {
  const now = new Date()
  const currentWeekId = computed(() => getWeekId(now))
  const gameDates = computed(() => getGameDates(now))

  const games = computed(() => [
    { id: 'friday_1', label: `Пятница 1`, date: gameDates.value.friday, day: 'friday' },
    { id: 'friday_2', label: `Пятница 2`, date: gameDates.value.friday, day: 'friday' },
    { id: 'saturday_1', label: `Суббота 1`, date: gameDates.value.saturday, day: 'saturday' },
    { id: 'saturday_2', label: `Суббота 2`, date: gameDates.value.saturday, day: 'saturday' },
  ])

  return { currentWeekId, gameDates, games }
}
