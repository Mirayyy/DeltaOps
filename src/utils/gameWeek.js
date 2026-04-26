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
 * Current fallback behavior: Mon-Thu point to the upcoming Friday/Saturday,
 * Fri-Sun point to the next Friday/Saturday.
 */
export function getUpcomingGameDates(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun, 5=Fri, 6=Sat
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

/**
 * Frozen week behavior: Mon-Thu point to the upcoming Friday/Saturday,
 * Fri-Sun point to the current/last Friday/Saturday until the week is finalized.
 */
export function getFrozenWeekDates(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun, 5=Fri, 6=Sat
  const fridayOffsets = {
    0: -2,
    1: 4,
    2: 3,
    3: 2,
    4: 1,
    5: 0,
    6: -1,
  }

  const friday = new Date(d)
  friday.setDate(d.getDate() + fridayOffsets[day])

  const saturday = new Date(friday)
  saturday.setDate(friday.getDate() + 1)

  return {
    friday: formatDate(friday),
    saturday: formatDate(saturday),
    weekId: getWeekId(friday),
  }
}

function formatDate(d) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}
