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

export function compareArchiveDates(dateA, dateB) {
  return toDateStamp(dateB) - toDateStamp(dateA)
}

export function compareArchivedGames(a, b) {
  const dateCompare = compareArchiveDates(a?.date || '', b?.date || '')
  if (dateCompare !== 0) return dateCompare

  const scheduleCompare = scheduleRank(b?.schedule) - scheduleRank(a?.schedule)
  if (scheduleCompare !== 0) return scheduleCompare

  return (b?.archivedAt || '').localeCompare(a?.archivedAt || '')
}

export function sortArchivedGames(list = []) {
  return [...list].sort(compareArchivedGames)
}
