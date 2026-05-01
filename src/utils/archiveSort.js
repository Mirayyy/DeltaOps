function scheduleRank(schedule = '') {
  const [day = '', gameNumber = '0'] = schedule.split('_')
  const dayRank = day === 'saturday' ? 2 : day === 'friday' ? 1 : 0
  const numberRank = Number.parseInt(gameNumber, 10) || 0
  return dayRank * 10 + numberRank
}

export function compareArchivedGames(a, b) {
  const dateCompare = (b?.date || '').localeCompare(a?.date || '')
  if (dateCompare !== 0) return dateCompare

  const scheduleCompare = scheduleRank(b?.schedule) - scheduleRank(a?.schedule)
  if (scheduleCompare !== 0) return scheduleCompare

  return (b?.archivedAt || '').localeCompare(a?.archivedAt || '')
}

export function sortArchivedGames(list = []) {
  return [...list].sort(compareArchivedGames)
}
