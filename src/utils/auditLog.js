import { useAuthStore } from '../stores/auth'
import { useRosterStore } from '../stores/roster'
import { useWeekStateStore } from '../stores/weekState'
import { useToast } from '../composables/useToast'
import { auditEqual, inferEventType, EVENT_LABELS } from './auditFormat.js'

export function cloneForAudit(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value))
}

export function newAuditOperationId() {
  return globalThis.crypto?.randomUUID?.() || `op-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Capture before asynchronous work or local mutation.
export function captureAuditContext(entry = {}) {
  const auth = useAuthStore()
  const roster = useRosterStore()
  const week = useWeekStateStore().lockedWeek
  const linked = roster.players.find(p => p.uid === auth.player?.uid) || auth.player
  const actor = entry.actor || {
    uid: auth.firebaseUser?.uid || auth.user?.uid || '',
    displayName: auth.user?.displayName || auth.firebaseUser?.displayName || '',
    email: auth.user?.email || auth.firebaseUser?.email || '',
    role: auth.userRole || 'guest',
    playerId: linked?.uid || '', nickname: linked?.deletedAt ? '' : linked?.nickname || '',
  }
  const ids = new Set()
  function collect(value) {
    if (!value || typeof value !== 'object') return
    for (const [key, item] of Object.entries(value)) {
      if (['playerId', 'playerUid'].includes(key) && typeof item === 'string') ids.add(item)
      else if (['playerIds', 'contacts', 'lineupResponsibleIds'].includes(key) && Array.isArray(item)) item.forEach(id => ids.add(id))
      else if (item && typeof item === 'object') collect(item)
    }
  }
  collect(entry.before); collect(entry.after); collect(entry.metadata)
  if (entry.entityType === 'players') ids.add(entry.entityId)
  const users = { ...entry.references?.users }
  if (entry.entityType === 'users') {
    const user = entry.after || entry.before || {}
    const matches = roster.players.filter(p => user.email && p.email === user.email && !p.deletedAt)
    const player = matches.length === 1 ? matches[0] : null
    if (player) ids.add(player.uid)
    users[entry.entityId] = { displayName: user.displayName || '', email: user.email || '', playerId: player?.uid || '', nickname: player?.nickname || '' }
  }
  const players = {}
  for (const id of ids) {
    const snapshot = entry.entityType === 'players' && entry.entityId === id ? entry.before || entry.after : null
    const player = snapshot || roster.getPlayer(id)
    if (player?.nickname && !player.deletedAt) players[id] = { nickname: player.nickname }
  }
  const gameId = entry.context?.gameId || entry.metadata?.gameId || entry.after?.schedule || entry.before?.schedule
    || (/^(friday|saturday)_[12]$/.test(entry.entityId || '') ? entry.entityId : '')
  const gameDate = entry.after?.date || entry.before?.date || (gameId?.startsWith('friday') ? week?.friday : gameId?.startsWith('saturday') ? week?.saturday : '') || ''
  return cloneForAudit({
    actor,
    context: { gameId, gameDate, weekId: week?.weekId || '',
      ...Object.fromEntries(Object.entries(entry.context || {}).filter(([, value]) => value !== '' && value != null)),
    },
    references: { players: { ...players, ...entry.references?.players }, users },
  })
}

function snapshotEntry(entry) {
  const frozen = cloneForAudit(entry)
  const action = frozen.action || (frozen.before != null && frozen.after != null ? 'update' : frozen.after != null ? 'create' : 'delete')
  const eventType = inferEventType({ ...frozen, action })
  return {
    ...frozen, ...captureAuditContext(frozen), action, eventType,
    summary: EVENT_LABELS[eventType] || frozen.summary || 'Изменение данных',
  }
}

export async function writeAuditLog(entry) {
  try {
    const frozen = snapshotEntry(entry)
    const { useAuditLogsStore } = await import('../stores/auditLogs')
    const saved = await useAuditLogsStore().logEvent(frozen)
    if (!saved) useToast().warning('Не удалось записать событие в журнал. Обновите страницу и проверьте результат действия.')
    return saved
  } catch (error) {
    console.warn('writeAuditLog failed:', error.message)
    useToast().warning('Не удалось записать событие в журнал.')
    return false
  }
}

export async function logEntitySnapshot(entry) {
  if (entry.before != null && entry.after != null && auditEqual(entry.before, entry.after) && !entry.force) return true
  return writeAuditLog(entry)
}

// Audit failure never repeats a business write which has already succeeded.
export async function auditedWrite(entry, write) {
  const frozen = snapshotEntry(entry)
  let result
  try {
    result = await write()
  } catch (error) {
    await writeAuditLog({ ...frozen, outcome: 'failure', severity: 'error',
      metadata: { ...frozen.metadata, error: { code: error.code || '', message: error.message || String(error) } },
    })
    throw error
  }
  await logEntitySnapshot({ ...frozen, outcome: 'success' })
  return result
}

export async function runAuditOperation(entry, work) {
  const frozen = snapshotEntry(entry)
  const audit = { ...captureAuditContext(frozen), operationId: entry.operationId || newAuditOperationId() }
  const completed = []
  try {
    const result = await work(audit, completed)
    await writeAuditLog({ ...frozen, ...audit, after: result ?? null, metadata: { ...frozen.metadata, completed } })
    return result
  } catch (error) {
    await writeAuditLog({ ...frozen, ...audit, outcome: completed.length ? 'partial' : 'failure', severity: 'error',
      metadata: { ...frozen.metadata, completed, error: { code: error.code || '', message: error.message || String(error) } },
    })
    throw error
  }
}
