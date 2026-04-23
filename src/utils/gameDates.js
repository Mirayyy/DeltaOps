import { GAME_IDS } from './constants.js'

const FRIDAY_GAME_IDS = ['friday_1', 'friday_2']
const SATURDAY_GAME_IDS = ['saturday_1', 'saturday_2']
const GAME_DAY = {
  friday_1: 'friday',
  friday_2: 'friday',
  saturday_1: 'saturday',
  saturday_2: 'saturday',
}

export function formatDate(date) {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

export function parseDateString(dateStr = '') {
  if (!dateStr) return null

  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [yyyy, mm, dd] = dateStr.slice(0, 10).split('-').map(Number)
    return new Date(yyyy, mm - 1, dd)
  }

  const ruMatch = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (ruMatch) {
    const [, dd, mm, yyyy] = ruMatch
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  }

  return null
}

export function normalizeDate(dateStr = '') {
  const parsed = parseDateString(dateStr)
  if (!parsed) return ''
  return toIsoDate(parsed)
}

export function toIsoDate(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function timestampToDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value?.toDate === 'function') return value.toDate()
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  if (typeof value?.seconds === 'number') {
    return new Date(value.seconds * 1000)
  }
  return null
}

function getStoredGameDate(gameId, gamesById = {}, attendanceById = {}) {
  return gamesById?.[gameId]?.date || attendanceById?.[gameId]?.date || ''
}

function getExplicitWeekendDates(gamesById = {}, attendanceById = {}) {
  let friday = ''
  let saturday = ''

  for (const gameId of FRIDAY_GAME_IDS) {
    const date = getStoredGameDate(gameId, gamesById, attendanceById)
    if (parseDateString(date)) {
      friday = date
      break
    }
  }

  for (const gameId of SATURDAY_GAME_IDS) {
    const date = getStoredGameDate(gameId, gamesById, attendanceById)
    if (parseDateString(date)) {
      saturday = date
      break
    }
  }

  if (friday && !saturday) {
    const saturdayDate = addDays(parseDateString(friday), 1)
    saturday = formatDate(saturdayDate)
  }

  if (!friday && saturday) {
    const fridayDate = addDays(parseDateString(saturday), -1)
    friday = formatDate(fridayDate)
  }

  return friday && saturday ? { friday, saturday } : null
}

function hasLiveGameContent(gamesById = {}) {
  return GAME_IDS.some(gameId => {
    const game = gamesById?.[gameId]
    if (!game) return false
    if ((game.slots || []).length) return true
    if ((game.slotRequests || []).length) return true
    if ((game.task || '').trim()) return true
    if ((game.sourceUrl || '').trim()) return true
    if ((game.version || '').trim()) return true
    return false
  })
}

function hasLiveAttendanceContent(attendanceById = {}) {
  return GAME_IDS.some(gameId => (attendanceById?.[gameId]?.records || []).length > 0)
}

export function hasLiveWeekData({ gamesById = {}, attendanceById = {} } = {}) {
  return hasLiveGameContent(gamesById) || hasLiveAttendanceContent(attendanceById)
}

function buildWeekendDatesFromFriday(fridayDate) {
  return {
    friday: formatDate(fridayDate),
    saturday: formatDate(addDays(fridayDate, 1)),
  }
}

function getWeekendFromArchiveEntry(entry) {
  const date = getSuggestedArchiveDate(entry) || entry?.date || ''
  const parsed = parseDateString(date)
  if (!parsed) return null

  if (String(entry?.schedule || '').startsWith('saturday')) {
    return buildWeekendDatesFromFriday(addDays(parsed, -1))
  }

  if (String(entry?.schedule || '').startsWith('friday')) {
    return buildWeekendDatesFromFriday(parsed)
  }

  if (parsed.getDay() === 6) {
    return buildWeekendDatesFromFriday(addDays(parsed, -1))
  }

  return buildWeekendDatesFromFriday(parsed)
}

function getLatestArchivedWeekend(archives = []) {
  let latest = null

  for (const entry of archives) {
    const weekend = getWeekendFromArchiveEntry(entry)
    if (!weekend) continue
    const fridayIso = normalizeDate(weekend.friday)
    if (!latest || fridayIso > latest.fridayIso) {
      latest = { ...weekend, fridayIso }
    }
  }

  return latest
}

export function getUpcomingGameDates(now = new Date()) {
  const date = new Date(now)
  const day = date.getDay()
  const friday = addDays(date, day === 6 ? -1 : 5 - day)
  return buildWeekendDatesFromFriday(friday)
}

export function getRecentGameDates(now = new Date()) {
  const date = new Date(now)
  const day = date.getDay()
  const offsets = {
    0: -2,
    1: -3,
    2: -4,
    3: -5,
    4: -6,
    5: 0,
    6: -1,
  }
  return buildWeekendDatesFromFriday(addDays(date, offsets[day] ?? 0))
}

export function getResolvedGameDates({
  now = new Date(),
  gamesById = {},
  attendanceById = {},
  archives = [],
} = {}) {
  const explicitDates = getExplicitWeekendDates(gamesById, attendanceById)
  if (explicitDates) return explicitDates

  if (hasLiveWeekData({ gamesById, attendanceById })) {
    const latestArchivedWeekend = getLatestArchivedWeekend(archives)
    if (latestArchivedWeekend) {
      return buildWeekendDatesFromFriday(addDays(parseDateString(latestArchivedWeekend.friday), 7))
    }

    return now.getDay() <= 2 || now.getDay() === 0
      ? getRecentGameDates(now)
      : getUpcomingGameDates(now)
  }

  return getUpcomingGameDates(now)
}

export function buildGameDateMap({ friday, saturday }) {
  return {
    friday_1: friday,
    friday_2: friday,
    saturday_1: saturday,
    saturday_2: saturday,
  }
}

export function getSuggestedArchiveDate(entry) {
  const archivedDate = timestampToDate(entry?.archivedAt)
  const gameDate = parseDateString(entry?.date)
  if (!archivedDate || !gameDate) return null

  if (toIsoDate(gameDate) > toIsoDate(archivedDate)) {
    return formatDate(addDays(gameDate, -7))
  }

  return null
}

export function shouldRepairArchiveDate(entry) {
  if (!entry) return false
  if (!GAME_DAY[entry.schedule]) return false
  return !!getSuggestedArchiveDate(entry)
}

export function resolveRotationIdForDate(dateStr, rotations = []) {
  const normalized = normalizeDate(dateStr)
  if (!normalized) return ''

  const today = toIsoDate(new Date())
  const activeRotation = rotations.find(rotation => {
    const start = rotation.startDate || ''
    const end = rotation.endDate || ''
    if (start && today < start) return false
    if (end && today > end) return false
    return true
  }) || null

  return rotations.find(rotation => {
    if (!rotation.startDate || normalized < rotation.startDate) return false
    if (rotation.endDate && normalized > rotation.endDate) return false
    return true
  })?.id || activeRotation?.id || ''
}

export function getResolvedGameDateForSchedule(schedule, resolvedDates) {
  if (!GAME_DAY[schedule]) return ''
  return GAME_DAY[schedule] === 'friday' ? resolvedDates.friday : resolvedDates.saturday
}
