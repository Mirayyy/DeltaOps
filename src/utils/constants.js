export const READINESS_STATUSES = {
  confirmed: { label: 'Буду', color: 'bg-status-confirmed', icon: '✓' },
  tentative: { label: 'Возможно', color: 'bg-status-tentative', icon: '?' },
  absent: { label: 'Не буду', color: 'bg-status-absent', icon: '✗' },
  no_response: { label: 'Не ответил', color: 'bg-status-no-response', icon: '—' },
}

export const PLAYER_STATUSES = {
  active: { label: 'В строю', color: 'bg-green-600' },
  reserve: { label: 'Запас', color: 'bg-yellow-600' },
  banned: { label: 'Бан', color: 'bg-red-600' },
  left: { label: 'Ушёл', color: 'bg-neutral-600' },
}

export const SITE_ROLES = {
  admin: { label: 'Админ' },
  member: { label: 'Участник' },
  guest: { label: 'Гость' },
}

export const POSITIONS = [
  'Командир отряда',
  'Заместитель Командира отряда',
  'Штабист',
  'Боец отряда',
  'Курсант отряда',
  'Боец запаса',
]

// SKILL_NAMES moved to config/squad.skillNames — managed via Settings CRUD

export const SKILL_LEVELS = {
  beginner: { label: 'Новичок', color: 'bg-skill-beginner' },
  intermediate: { label: 'Средний', color: 'bg-skill-intermediate' },
  experienced: { label: 'Опытный', color: 'bg-skill-experienced' },
}

export const GAMES = [
  { id: 'friday_1', label: 'Пятница 1', day: 'friday' },
  { id: 'friday_2', label: 'Пятница 2', day: 'friday' },
  { id: 'saturday_1', label: 'Суббота 1', day: 'saturday' },
  { id: 'saturday_2', label: 'Суббота 2', day: 'saturday' },
]

export const GAME_IDS = ['friday_1', 'friday_2', 'saturday_1', 'saturday_2']

export const SIDE_COLORS = {
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400', dot: 'bg-blue-500', raw: '59,130,246' },
  red: { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400', dot: 'bg-red-500', raw: '239,68,68' },
  green: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400', dot: 'bg-emerald-500', raw: '16,185,129' },
}

export const SLOT_TYPES = {
  vehicle: { label: 'Техника' },
  reserve: { label: 'Запас' },
  squadCommander: { label: 'КО' },
  sideCommander: { label: 'Командир стороны' },
}

export const EQUIPMENT_LIST = [
  'Оптика', 'Бинокль', 'GPS', 'ДВ', 'Глушитель',
  'Тепляк', 'Дальномер', 'Минка',
]

export const EQUIPMENT_COLORS = {
  'Оптика': 'bg-red-500',
  'Бинокль': 'bg-blue-500',
  'GPS': 'bg-emerald-500',
  'ДВ': 'bg-amber-500',
  'Глушитель': 'bg-purple-500',
  'Тепляк': 'bg-orange-500',
  'Дальномер': 'bg-cyan-500',
  'Минка': 'bg-pink-500',
}

// TSG profile URL builder (no need to store in DB)
export function getTsgUrl(nickname) {
  return `https://tsgames.ru/user/profile/${nickname}`
}
