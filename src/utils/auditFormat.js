import { GAMES, PLAYER_STATUSES, READINESS_STATUSES, SITE_ROLES, SKILL_LEVELS, SLOT_TYPES } from './constants.js'

export const ENTITY_LABELS = {
  players: 'Игроки', users: 'Учётные записи', 'user-player-link': 'Привязки аккаунтов',
  games: 'Расстановка', slotRequests: 'Запросы на слоты', attendance: 'Посещаемость',
  missions: 'Миссии', week: 'Неделя', archive: 'Архив', rotations: 'Ротации',
  structures: 'Шаблоны', config: 'Настройки', telegram: 'Telegram', system: 'Система',
}

export const ACTION_LABELS = {
  create: 'Создание', update: 'Изменение', delete: 'Удаление', 'delete-soft': 'Удаление профиля',
  clear: 'Очистка', restore: 'Снятие пропуска', skip: 'Пропуск', archive: 'Архивация',
  finalize: 'Завершение', send: 'Отправка', link: 'Привязка', unlink: 'Отвязка',
}

export const EVENT_LABELS = {
  'player.created': 'Добавлен игрок', 'player.updated': 'Изменён профиль игрока',
  'player.deleted': 'Игрок удалён полностью', 'player.removed': 'Удалён профиль игрока',
  'player.nickname': 'Изменён позывной', 'player.status': 'Изменён статус игрока',
  'player.position': 'Изменена должность', 'player.skills': 'Изменены навыки игрока',
  'player.avatar': 'Изменён аватар', 'player.attendancePreset': 'Изменены автоматические отметки',
  'user.created': 'Создана учётная запись', 'user.updated': 'Изменена учётная запись',
  'user.role': 'Изменена роль пользователя', 'user.auto-role': 'Автоматически изменена роль',
  'user.linked': 'Аккаунт привязан к игроку', 'user.unlinked': 'Аккаунт отвязан от игрока',
  'slot.added': 'Добавлен слот', 'slot.removed': 'Убран слот',
  'lineup.configured': 'Изменён набор слотов', 'lineup.created': 'Создана расстановка',
  'lineup.updated': 'Изменена расстановка', 'lineup.cleared': 'Очищена расстановка',
  'slot.assigned': 'Игрок назначен на слот', 'slot.moved': 'Игрок перемещён на другой слот',
  'slot.unassigned': 'Игрок снят со слота', 'slot.auto-unassigned': 'Игрок снят из-за отметки «Не буду»',
  'slot.updated': 'Изменены настройки слота', 'slot.equipment': 'Изменено снаряжение',
  'slot.type': 'Изменён тип слота', 'slot.fireteam': 'Изменена боевая группа',
  'slot.notes': 'Изменена заметка', 'slot.personalTask': 'Изменена личная задача',
  'game.task': 'Изменена задача отряда', 'game.meta': 'Изменены данные игры',
  'game.cleared': 'Удалена миссия с расстановкой',
  'request.created': 'Создан запрос на слоты', 'request.updated': 'Изменён запрос на слоты',
  'request.deleted': 'Удалён запрос на слоты',
  'attendance.changed': 'Изменена отметка посещаемости',
  'attendance.presets': 'Автоматически применены отметки', 'attendance.date': 'Изменена дата посещаемости',
  'attendance.cleared': 'Очищена посещаемость', 'game.skipped': 'Игра отмечена как пропущенная',
  'game.restored': 'Снята отметка пропуска игры',
  'mission.created': 'Загружена миссия', 'mission.updated': 'Обновлена миссия', 'mission.deleted': 'Удалена миссия',
  'week.locked': 'Закреплены даты недели', 'week.unlocked': 'Сброшено закрепление недели',
  'week.finalized': 'Неделя завершена', 'week.skipped': 'Неделя пропущена без архивации',
  'game.archived': 'Игра сохранена в архив',
  'rotation.created': 'Создана ротация', 'rotation.updated': 'Изменена ротация', 'rotation.deleted': 'Удалена ротация',
  'structure.created': 'Создан шаблон', 'structure.updated': 'Изменён шаблон', 'structure.deleted': 'Удалён шаблон',
  'config.app': 'Изменены настройки сайта', 'config.squad': 'Изменены настройки отряда',
  'config.skills': 'Изменён справочник навыков', 'config.equipment': 'Изменён справочник снаряжения',
  'config.content': 'Изменены описание и награды', 'config.about': 'Изменено описание отряда',
  'config.awards': 'Изменены награды',
  'telegram.readiness-reminder': 'Напоминание о посещаемости', 'telegram.missions-summary': 'Список миссий',
  'telegram.lineup-summary': 'Расстановка', 'telegram.slot-notification': 'Уведомление о слоте',
  'telegram.request-notification': 'Уведомление ответственным о запросе',
  'telegram.message': 'Сообщение Telegram',
}

const FIELD_LABELS = {
  nickname: 'Позывной', status: 'Статус', position: 'Должность', email: 'Email', role: 'Роль',
  avatar: 'Аватар', photoURL: 'Аватар учётки', displayName: 'Имя учётки', nicknameColor: 'Цвет позывного',
  skills: 'Навыки', skillName: 'Навык', level: 'Уровень', wishes: 'Пожелания', nicknameHistory: 'История позывных',
  telegramUsername: 'Telegram', telegramId: 'Telegram ID', discordUsername: 'Discord', discordId: 'Discord ID', steamUrl: 'Steam',
  attendancePreset: 'Автоматические отметки', enabled: 'Включено', attendance: 'Посещаемость', records: 'Отметки',
  slots: 'Слоты', playerId: 'Игрок', playerUid: 'Игрок', playerNickname: 'Позывной', playerIds: 'Игроки',
  playerNicknames: 'Позывные', userId: 'Учётная запись', userEmail: 'Email учётки',
  side: 'Сторона', squad: 'Отделение', number: 'Номер', slotNumber: 'Номер слота', name: 'Название',
  equipment: 'Снаряжение', optics: 'Оптика', notes: 'Заметка', fireteam: 'Боевая группа', type: 'Тип',
  personalTask: 'Личная задача', task: 'Задача отряда', text: 'Текст запроса',
  date: 'Дата', gameId: 'Игра', gameIds: 'Игры', schedule: 'Игра', sourceUrl: 'Источник миссии', version: 'Версия',
  missionTitle: 'Миссия', title: 'Название', description: 'Описание', server: 'Сервер',
  rotation: 'Ротация', rotationId: 'Ротация', startDate: 'Начало', endDate: 'Окончание',
  friday: 'Пятница', saturday: 'Суббота', weekId: 'Неделя', skipped: 'Пропуск игры',
  skippedReason: 'Причина пропуска', reason: 'Причина', archivedGameIds: 'Архивированные игры',
  archivedIds: 'Записи архива', skippedGameIds: 'Пропущенные игры', existingArchiveIds: 'Уже в архиве',
  siteName: 'Название сайта', siteUrl: 'Адрес сайта', githubUrl: 'GitHub', firestoreUrl: 'Firestore',
  lineupResponsibleIds: 'Ответственные за расстановку', showStats: 'Показывать статистику',
  tag: 'Тег отряда', logo: 'Логотип', guaranteedSlots: 'Гарантированные слоты', recruitment: 'Набор',
  contacts: 'Контакты', skillNames: 'Справочник навыков', equipmentItems: 'Справочник снаряжения', color: 'Цвет',
  awards: 'Награды', aboutMarkdown: 'Описание отряда', showOnLanding: 'На главной странице', icon: 'Иконка',
  section: 'Отделение', roleName: 'Роль слота', slotId: 'Слот', slotRequests: 'Запросы на слоты',
  affectedCount: 'Количество', deletedAt: 'Удалён', deletedBy: 'Удалил',
}
const TECHNICAL_FIELDS = new Set(['id', 'uid', '_id', 'createdAt', 'updatedAt', 'updatedBy', 'archivedAt', 'archivedBy', 'scrapedAt', 'lastLoginAt'])

export function timestampIso(value) {
  if (value == null || value === '') return null
  try {
    const date = typeof value?.toDate === 'function' ? value.toDate()
      : typeof value?.seconds === 'number' ? new Date(value.seconds * 1000)
        : new Date(value)
    return Number.isFinite(date.getTime()) ? date.toISOString() : null
  } catch { return null }
}

export function fieldLabel(key) {
  return FIELD_LABELS[key] || GAMES.find(g => g.id === key)?.label || key
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .filter(key => !TECHNICAL_FIELDS.has(key)).map(key => [key, stable(value[key])]))
  return value ?? null
}

export function auditEqual(a, b) { return JSON.stringify(stable(a)) === JSON.stringify(stable(b)) }

function itemKey(field, value) {
  if (!value || typeof value !== 'object') return null
  if (field === 'slots' && value.number != null) return `${value.side || ''}::${value.squad || ''}::${value.number}`
  if (field === 'records') return value.playerId
  if (field === 'skills') return value.skillName
  return null
}

// Match records/slots by identity, never by their current array position.
export function auditChanges(before, after) {
  const result = []
  function walk(a, b, path, labels, field) {
    if (auditEqual(a, b)) return
    if (Array.isArray(a) && Array.isArray(b)) {
      const keysA = a.map(v => itemKey(field, v)), keysB = b.map(v => itemKey(field, v))
      if ([...keysA, ...keysB].every(Boolean) && new Set(keysA).size === a.length && new Set(keysB).size === b.length) {
        const left = new Map(a.map((v, i) => [keysA[i], v])), right = new Map(b.map((v, i) => [keysB[i], v]))
        for (const key of new Set([...keysA, ...keysB])) {
          const item = right.get(key) || left.get(key)
          const label = field === 'slots' ? [item.side, item.squad, `${item.name || 'Слот'} №${item.number}`].filter(Boolean).join(' · ')
            : field === 'records' ? `@player:${key}` : key
          walk(left.get(key), right.get(key), `${path}[${key}]`, [...labels, label], field)
        }
        return
      }
    }
    const isObject = v => v != null && typeof v === 'object' && !Array.isArray(v)
    if (isObject(a) && isObject(b)) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!TECHNICAL_FIELDS.has(key)) walk(a[key], b[key], path ? `${path}.${key}` : key, [...labels, fieldLabel(key)], key)
      }
      return
    }
    result.push({ path, labels, field, before: a ?? null, after: b ?? null })
  }
  walk(before ?? {}, after ?? {}, '', [], '')
  return result
}

export function normalizedAction(log) {
  if (log.metadata?.operation === 'mark-as-deleted' || log.action === 'delete-soft') return 'delete-soft'
  return log.action || 'update'
}

export function inferEventType(log) {
  if (log.eventType) return log.eventType
  const action = normalizedAction(log), op = log.metadata?.operation
  const a = log.after || {}, b = log.before || {}
  const changed = auditChanges(b, a).map(c => c.path.split(/[.[]/)[0])
  const only = keys => changed.length > 0 && changed.every(k => keys.includes(k))
  if (log.entityType === 'players') {
    if (action === 'delete-soft') return 'player.removed'
    if (action === 'create') return 'player.created'
    if (action === 'delete') return 'player.deleted'
    for (const key of ['nickname', 'status', 'position', 'skills', 'avatar', 'attendancePreset']) if (only([key])) return `player.${key}`
    return 'player.updated'
  }
  if (log.entityType === 'users') return op === 'auto-link-by-email' ? 'user.linked'
    : op === 'auto-role' ? 'user.auto-role' : action === 'create' ? 'user.created' : only(['role']) ? 'user.role' : 'user.updated'
  if (log.entityType === 'user-player-link') return action === 'unlink' ? 'user.unlinked' : 'user.linked'
  if (log.entityType === 'games') {
    if (op === 'toggle-slot') return (a.slots?.length || 0) > (b.slots?.length || 0) ? 'slot.added' : 'slot.removed'
    if (op === 'assign-player') return b.slots?.some((s, i) => s.playerId === log.metadata?.playerId && i !== log.metadata?.slotIndex) ? 'slot.moved' : 'slot.assigned'
    if (op === 'update-slot') {
      const keys = Object.keys(log.metadata?.updates || {}).filter(k => k !== 'optics')
      return keys.length === 1 && EVENT_LABELS[`slot.${keys[0]}`] ? `slot.${keys[0]}` : 'slot.updated'
    }
    const operations = {
      'set-slots': 'lineup.configured', 'unassign-player': 'slot.unassigned',
      'unassign-player-from-game': 'slot.auto-unassigned', 'set-task': 'game.task',
      'set-game-meta': 'game.meta', 'remove-slot-request-legacy': 'request.deleted',
    }
    return operations[op] || (action === 'delete' || action === 'clear' ? 'lineup.cleared' : action === 'create' ? 'lineup.created' : 'lineup.updated')
  }
  if (log.entityType === 'slotRequests') return `request.${action === 'create' ? 'created' : action === 'delete' ? 'deleted' : 'updated'}`
  if (log.entityType === 'attendance') return action === 'skip' ? 'game.skipped' : action === 'restore' ? 'game.restored'
    : action === 'clear' || action === 'delete' ? 'attendance.cleared' : op === 'apply-presets' ? 'attendance.presets' : 'attendance.changed'
  if (log.entityType === 'telegram') return `telegram.${String(log.entityId || '').split(':')[0]}`
  if (log.entityType === 'week') return action === 'finalize' ? 'week.finalized' : action === 'skip' ? 'week.skipped' : action === 'delete' ? 'week.unlocked' : 'week.locked'
  if (log.entityType === 'archive') return 'game.archived'
  const prefixes = { rotations: 'rotation', structures: 'structure', missions: 'mission' }
  if (prefixes[log.entityType]) return `${prefixes[log.entityType]}.${action === 'create' ? 'created' : action === 'delete' ? 'deleted' : 'updated'}`
  if (log.entityType === 'config') {
    if (log.entityId === 'app') return 'config.app'
    if (only(['skillNames'])) return 'config.skills'
    if (only(['equipmentItems'])) return 'config.equipment'
    if (only(['awards'])) return 'config.awards'
    if (only(['aboutMarkdown'])) return 'config.about'
    return log.entityId === 'web-content' ? 'config.content' : 'config.squad'
  }
  return ''
}

export function actorIdentity(log, players = []) {
  const actor = log.actor || {}
  if (actor.nickname) return { label: actor.nickname, current: false }
  const matches = players.filter(p => !p.deletedAt && (actor.playerId ? p.uid === actor.playerId : actor.email && p.email === actor.email))
  if (matches.length === 1 && matches[0].nickname) return { label: matches[0].nickname, current: true }
  return { label: actor.displayName || actor.email || actor.uid || 'Автор неизвестен', current: false }
}

export function playerName(id, log, players = []) {
  if (!id) return 'Свободно'
  const saved = log.references?.players?.[id]?.nickname
  if (saved) return saved
  for (const snapshot of [log.before, log.after]) {
    if (snapshot && (snapshot.uid === id || (log.entityType === 'players' && log.entityId === id)) && snapshot.nickname && snapshot.nickname !== 'Удален') return snapshot.nickname
    if ((snapshot?.playerUid === id || snapshot?.playerId === id) && snapshot.playerNickname) return snapshot.playerNickname
  }
  if ((log.metadata?.playerUid === id || log.metadata?.playerId === id) && log.metadata?.playerNickname) return log.metadata.playerNickname
  const current = players.find(p => p.uid === id && !p.deletedAt)
  return current?.nickname ? `${current.nickname} (текущий позывной)` : `Игрок ${id}`
}

export function formatAuditValue(value, field, log, players = []) {
  if (value == null || value === '') return '—'
  if (field === 'playerId' || field === 'playerUid') return playerName(value, log, players)
  if (['playerIds', 'contacts', 'lineupResponsibleIds'].includes(field) && Array.isArray(value)) return value.map(id => playerName(id, log, players)).join(', ') || '—'
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
  if (field === 'status') return PLAYER_STATUSES[value]?.label || value
  if (field === 'attendance' || GAMES.some(g => g.id === field)) return READINESS_STATUSES[value]?.label || (value === 'skip' ? 'Не заполнять' : value)
  if (field === 'role') return SITE_ROLES[value]?.label || value
  if (field === 'level') return SKILL_LEVELS[value]?.label || value
  if (field === 'type') return SLOT_TYPES[value]?.label || ({ player: 'Игрок', squad: 'Отряд' }[value]) || value
  if (field === 'gameId' || field === 'schedule') return GAMES.find(g => g.id === value)?.label || value
  if (Array.isArray(value)) return value.map(v => formatAuditValue(v, field === 'gameIds' || field === 'archivedGameIds' ? 'gameId' : '', log, players)).join(', ') || '—'
  if (typeof value === 'object') return Object.entries(value).filter(([k]) => !TECHNICAL_FIELDS.has(k))
    .map(([k, v]) => `${fieldLabel(k)}: ${formatAuditValue(v, k, log, players)}`).join('; ') || '—'
  return String(value)
}

export function describeAuditLog(log, players = []) {
  const eventType = inferEventType(log)
  const changes = auditChanges(log.before, log.after).map(c => ({ ...c,
    label: c.labels.map(s => s.startsWith('@player:') ? playerName(s.slice(8), log, players) : s).join(' → ') || 'Данные',
    from: formatAuditValue(c.before, c.field, log, players), to: formatAuditValue(c.after, c.field, log, players),
  }))
  const actor = actorIdentity(log, players)
  const playerId = log.metadata?.playerId || log.metadata?.playerUid || log.after?.playerId || log.after?.playerUid || log.before?.playerId || log.before?.playerUid
  let target = log.entityType === 'players' ? playerName(log.entityId, log, players)
    : playerId ? playerName(playerId, log, players)
      : log.after?.name || log.before?.name || log.after?.missionTitle || log.before?.missionTitle || ''
  if (log.entityType === 'users' && !target) {
    const user = log.references?.users?.[log.entityId]
    target = user?.nickname || log.after?.displayName || log.before?.displayName || log.after?.email || log.before?.email || log.entityId
  }
  const gameId = log.context?.gameId || log.metadata?.gameId || log.after?.schedule || log.before?.schedule || (GAMES.some(g => g.id === log.entityId) ? log.entityId : '')
  const game = GAMES.find(g => g.id === gameId)?.label || gameId
  const date = log.context?.gameDate || log.after?.date || log.before?.date || ''
  const outcome = log.outcome || (log.severity === 'error' ? 'failure' : 'success')
  let title = EVENT_LABELS[eventType] || log.summary || `${ENTITY_LABELS[log.entityType] || log.entityType || 'Событие'}: ${ACTION_LABELS[log.action] || log.action || 'изменение'}`
  if (log.entityType === 'telegram' && EVENT_LABELS[eventType]) title += outcome === 'success' ? ' — отправлено' : outcome === 'skipped' ? ' — не отправлено' : ' — ошибка отправки'
  return {
    id: log.id, raw: log, eventType, action: normalizedAction(log), actor, target, title, outcome, changes,
    entity: ENTITY_LABELS[log.entityType] || log.entityType || 'Система',
    context: [game, date, log.context?.missionTitle].filter(Boolean).join(' · '),
    search: [title, target, actor.label, game, date, log.entityId, log.operationId, JSON.stringify(log), ...changes.map(c => `${c.label} ${c.from} ${c.to}`)].join(' ').toLocaleLowerCase('ru'),
  }
}
