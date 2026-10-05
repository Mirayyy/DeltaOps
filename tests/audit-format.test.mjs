import test from 'node:test'
import assert from 'node:assert/strict'
import { actorIdentity, playerName, inferEventType, describeAuditLog, auditChanges, auditEqual, timestampIso, EVENT_LABELS } from '../src/utils/auditFormat.js'

test('historical callsigns take precedence; actor and subject stay separate', () => {
  const players = [{ uid: 'p1', nickname: 'Новый', email: 'a@example.test' }]
  const log = { entityType: 'players', entityId: 'p2', actor: { uid: 'u1', nickname: 'Ястреб', email: 'a@example.test' },
    before: { uid: 'p2', nickname: 'Сокол' }, after: { uid: 'p2', nickname: 'Удален', deletedAt: 'now' },
    metadata: { operation: 'mark-as-deleted' }, action: 'update' }
  const original = structuredClone(log)
  const row = describeAuditLog(log, players)
  assert.equal(row.actor.label, 'Ястреб')
  assert.equal(row.target, 'Сокол')
  assert.equal(row.action, 'delete-soft')
  assert.equal(row.eventType, 'player.removed')
  assert.deepEqual(log, original)
})

test('legacy current associations are marked, ambiguous/deleted identities are not guessed', () => {
  const log = { actor: { uid: 'u', displayName: 'Account', email: 'a@b' } }
  assert.deepEqual(actorIdentity(log, [{ uid: 'p', nickname: 'Сокол', email: 'a@b' }]), { label: 'Сокол', current: true })
  assert.equal(actorIdentity(log, [{ uid: 'p', nickname: 'A', email: 'a@b' }, { uid: 'q', nickname: 'B', email: 'a@b' }]).label, 'Account')
  assert.equal(playerName('missing', {}, []), 'Игрок missing')
  assert.equal(playerName('p', {}, [{ uid: 'p', nickname: 'Удален', deletedAt: 'now' }]), 'Игрок p')
})

test('slot reordering is not a set of false edits; changes follow slot identity', () => {
  const a = { side: 'blue', squad: 'A', number: 1, playerId: 'p1', equipment: [] }
  const b = { side: 'blue', squad: 'A', number: 2, playerId: 'p2', equipment: [] }
  assert.deepEqual(auditChanges({ slots: [a, b] }, { slots: [b, a] }), [])
  const changes = auditChanges({ slots: [a, b] }, { slots: [{ ...b, equipment: ['Оптика'] }, a] })
  assert.equal(changes.length, 1)
  assert.match(changes[0].path, /blue::A::2.*equipment/)
})

test('attendance and skills compare by identity; false and zero survive', () => {
  const changes = auditChanges({ records: [{ playerId: 'p', attendance: 'tentative' }], showStats: true, guaranteedSlots: 2 },
    { records: [{ playerId: 'p', attendance: 'confirmed' }], showStats: false, guaranteedSlots: 0 })
  assert.equal(changes.length, 3)
  const row = describeAuditLog({ entityType: 'attendance', action: 'update',
    before: { records: [{ playerId: 'p', attendance: 'tentative' }] }, after: { records: [{ playerId: 'p', attendance: 'confirmed' }] },
    references: { players: { p: { nickname: 'Сокол' } } } })
  assert.match(row.changes[0].label, /Сокол/)
  assert.equal(row.changes[0].from, 'Возможно')
  assert.equal(row.changes[0].to, 'Буду')
  assert.equal(auditEqual({ nickname: 'A', updatedAt: 1 }, { updatedAt: 2, nickname: 'A' }), true)
})

test('all legacy game operations have meaningful titles', () => {
  const cases = {
    'toggle-slot': 'slot.added', 'set-slots': 'lineup.configured', 'assign-player': 'slot.assigned',
    'unassign-player': 'slot.unassigned', 'unassign-player-from-game': 'slot.auto-unassigned',
    'update-slot': 'slot.equipment', 'set-task': 'game.task', 'set-game-meta': 'game.meta',
    'remove-slot-request-legacy': 'request.deleted', 'clear-games': 'lineup.cleared',
  }
  for (const [operation, expected] of Object.entries(cases)) {
    const event = inferEventType({ entityType: 'games', action: operation === 'clear-games' ? 'delete' : 'update',
      before: { slots: [] }, after: { slots: [{ number: 1 }] }, metadata: { operation, updates: { equipment: ['Оптика'] } } })
    assert.equal(event, expected, operation)
    assert.ok(EVENT_LABELS[event])
  }
})

test('legacy families and unknown events remain readable', () => {
  for (const [entityType, action, eventType] of [
    ['players', 'create', 'player.created'], ['users', 'create', 'user.created'],
    ['user-player-link', 'unlink', 'user.unlinked'], ['slotRequests', 'delete', 'request.deleted'],
    ['attendance', 'restore', 'game.restored'], ['attendance', 'skip', 'game.skipped'],
    ['missions', 'delete', 'mission.deleted'], ['week', 'finalize', 'week.finalized'],
    ['archive', 'archive', 'game.archived'], ['rotations', 'create', 'rotation.created'],
    ['structures', 'update', 'structure.updated'],
  ]) assert.equal(inferEventType({ entityType, action }), eventType)
  const unknown = { eventType: 'future.event', summary: 'Историческое событие', before: null, after: null }
  assert.equal(describeAuditLog(unknown).title, unknown.summary)
  assert.equal(timestampIso('bad timestamp'), null)
  assert.equal(timestampIso({ seconds: 0 }), '1970-01-01T00:00:00.000Z')
})
