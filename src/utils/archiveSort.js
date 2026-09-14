function scheduleRank(schedule = '') {
  const [day = '', gameNumber = '0'] = schedule.split('_')
  const dayRank = day === 'saturday' ? 2 : day === 'friday' ? 1 : 0
  const numberRank = Number.parseInt(gameNumber, 10) || 0
  return dayRank * 10 + numberRank
}

function toDateStamp(date = '') {
  if (!date) return Number.NEGATIVE_INFINITY

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(date)) {
    const [day, month, year] = date.split('.').map(Number)
    return year * 10000 + month * 100 + day
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Number(date.replaceAll('-', ''))
  }

  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return Number.NEGATIVE_INFINITY

  return parsed.getFullYear() * 10000 + (parsed.getMonth() + 1) * 100 + parsed.getDate()
}

function toTimeStamp(value) {
  if (!value) return Number.NEGATIVE_INFINITY

  if (value instanceof Date) {
    return value.getTime()
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? Number.NEGATIVE_INFINITY : parsed.getTime()
  }

  if (typeof value.toMillis === 'function') {
    return value.toMillis()
  }

  if (typeof value.seconds === 'number') {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000)
  }

  return Number.NEGATIVE_INFINITY
}

export function compareArchiveDates(dateA, dateB) {
  return toDateStamp(dateB) - toDateStamp(dateA)
}

export function compareArchivedGames(a, b) {
  const dateCompare = compareArchiveDates(a?.date || '', b?.date || '')
  if (dateCompare !== 0) return dateCompare

  const scheduleCompare = scheduleRank(b?.schedule) - scheduleRank(a?.schedule)
  if (scheduleCompare !== 0) return scheduleCompare

  return toTimeStamp(b?.archivedAt) - toTimeStamp(a?.archivedAt)
}

export function sortArchivedGames(list = []) {
  return [...list].sort(compareArchivedGames)
}
