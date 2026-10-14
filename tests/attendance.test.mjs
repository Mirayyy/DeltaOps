import test from 'node:test'
import assert from 'node:assert/strict'
import { createHarness } from './helpers/audit-harness.mjs'

const copy = value => JSON.parse(JSON.stringify(value))
const game = records => ({ schedule: 'friday_1', date: '2026-10-16', records })
const record = (playerId, attendance = 'confirmed') => ({ playerId, attendance })

async function setup(options) {
  const h = await createHarness(options)
  const { useAttendanceStore } = await h.load('src/stores/attendance.js')
  const { useWeekStateStore } = await h.load('src/stores/weekState.js')
  useWeekStateStore().lockedWeek = { weekId: 'test-week', friday: '2026-10-16', saturday: '2026-10-17' }
  return { ...h, store: useAttendanceStore() }
}

test('editing before the attendance snapshot arrives preserves all other players', async () => {
  const h = await setup()
  h.docs.set('attendance/friday_1', game([record('p1'), record('p2'), record('p3')]))
  await h.store.setPlayerAttendance('friday_1', 'p4', 'tentative')
  assert.deepEqual(h.docs.get('attendance/friday_1').records,
    [record('p1'), record('p2'), record('p3'), record('p4', 'tentative')])
})

test('an old browser cannot erase attendance restored by the admin', async () => {
  const h = await setup()
  h.store.attendance.friday_1 = game([record('p1', 'tentative')])
  h.docs.set('attendance/friday_1', game([record('p1', 'tentative'), record('p2'), record('p3')]))
  await h.store.setPlayerAttendance('friday_1', 'p1', 'confirmed')
  assert.deepEqual(h.docs.get('attendance/friday_1').records, [record('p1'), record('p2'), record('p3')])
  const log = h.logs().find(l => l.eventType === 'attendance.changed')
  assert.deepEqual(log.before.records, [record('p1', 'tentative'), record('p2'), record('p3')])
})

test('a stale local status must not suppress a requested server change', async () => {
  const h = await setup()
  h.store.attendance.friday_1 = game([record('p1')])
  h.docs.set('attendance/friday_1', game([record('p1', 'tentative')]))
  await h.store.setPlayerAttendance('friday_1', 'p1', 'confirmed')
  assert.equal(h.docs.get('attendance/friday_1').records[0].attendance, 'confirmed')
})

test('changing only the date preserves server attendance', async () => {
  const h = await setup()
  h.docs.set('attendance/friday_1', game([record('p1'), record('p2')]))
  await h.store.setDate('friday_1', '2026-10-23')
  assert.deepEqual(h.docs.get('attendance/friday_1').records, [record('p1'), record('p2')])
  assert.equal(h.docs.get('attendance/friday_1').date, '2026-10-23')
})

test('presets preserve manual answers and skipped games even with an empty local cache', async () => {
  const h = await setup()
  h.docs.set('attendance/friday_1', game([record('p1', 'absent'), record('p2')]))
  h.docs.set('attendance/friday_2', { schedule: 'friday_2', records: [], skipped: true })
  await h.store.applyAttendancePresets([
    { uid: 'p1', status: 'active', attendancePreset: { enabled: true, friday_1: 'confirmed', friday_2: 'confirmed' } },
    { uid: 'p3', status: 'active', attendancePreset: { enabled: true, friday_1: 'tentative' } },
  ])
  assert.deepEqual(h.docs.get('attendance/friday_1').records,
    [record('p1', 'absent'), record('p2'), record('p3', 'tentative')])
  assert.deepEqual(h.docs.get('attendance/friday_2').records, [])
})

test('two browsers changing different players retry conflicts without losing either change', async () => {
  const documents = new Map([['attendance/friday_1', game([record('p1', 'tentative'), record('p2', 'tentative')])]])
  const first = await setup({ documents })
  const second = await setup({ documents })
  let attempts = 0
  first.hooks.beforeWrite = async ref => {
    if (ref.path !== 'attendance/friday_1') return
    if (++attempts === 1) await second.store.setPlayerAttendance('friday_1', 'p2', 'confirmed')
  }
  await first.store.setPlayerAttendance('friday_1', 'p1', 'confirmed')
  assert.equal(attempts, 2)
  assert.deepEqual(documents.get('attendance/friday_1').records, [record('p1'), record('p2')])
  // Pinia's active instance is process-global in this two-client VM test.
  const logs = [...first.logs(), ...second.logs()]
    .filter(l => l.eventType === 'attendance.changed' && l.metadata.playerId === 'p1')
  assert.equal(logs.length, 1)
  assert.deepEqual(logs[0].before.records, [record('p1', 'tentative'), record('p2')])
})

test('repeated identical answers do not write or log a change', async () => {
  const h = await setup()
  h.docs.set('attendance/friday_1', game([record('p1')]))
  await h.store.setPlayerAttendance('friday_1', 'p1', 'confirmed')
  assert.equal(h.writes.length, 0)
})

test('failed saves preserve server data and report failure to the caller', async () => {
  const h = await setup()
  const original = game([record('p1')])
  h.docs.set('attendance/friday_1', copy(original))
  h.failures.add('attendance')
  await assert.rejects(h.store.setPlayerAttendance('friday_1', 'p2', 'confirmed'), { code: 'permission-denied' })
  assert.deepEqual(h.docs.get('attendance/friday_1'), original)
  assert.equal(h.logs().filter(l => l.outcome === 'failure').length, 1)
})

test('a failed audit never repeats a successful attendance save', async () => {
  const h = await setup()
  h.docs.set('attendance/friday_1', game([record('p1')]))
  h.failures.add('logs')
  await h.store.setPlayerAttendance('friday_1', 'p2', 'confirmed')
  assert.deepEqual(h.docs.get('attendance/friday_1').records, [record('p1'), record('p2')])
  assert.equal(h.writes.filter(w => w.path === 'attendance/friday_1').length, 1)
  assert.ok(h.warnings.length > 0)
})

test('an old browser cannot add attendance to a game cancelled by another admin', async () => {
  const h = await setup()
  h.store.attendance.friday_1 = game([record('p1')])
  h.docs.set('attendance/friday_1', { ...game([]), skipped: true })
  await h.store.setPlayerAttendance('friday_1', 'p2', 'confirmed')
  assert.deepEqual(h.docs.get('attendance/friday_1').records, [])
  assert.equal(h.writes.length, 0)
})

test('restoring a skipped game only removes its skipped flag and preserves any records', async () => {
  const h = await setup()
  const original = { ...game([record('p1')]), skipped: true, skippedReason: 'game-cancelled' }
  h.docs.set('attendance/friday_1', copy(original))
  await h.store.restoreGame('friday_1')
  const restored = h.docs.get('attendance/friday_1')
  assert.equal(restored.skipped, false)
  assert.equal(restored.date, original.date)
  assert.deepEqual(restored.records, original.records)
  assert.equal(h.logs()[0].eventType, 'game.restored')
  assert.equal(h.logs()[0].action, 'restore')
})

test('a delayed restore does not delete records entered after another admin restored the game', async () => {
  const h = await setup()
  h.docs.set('attendance/friday_1', { ...game([]), skipped: true })
  const restored = game([record('p1'), record('p2')])
  let attempts = 0
  h.hooks.beforeWrite = async ref => {
    if (ref.path === 'attendance/friday_1' && ++attempts === 1) h.docs.set(ref.path, copy(restored))
  }
  await h.store.restoreGame('friday_1')
  assert.deepEqual(h.docs.get('attendance/friday_1'), restored)
  assert.equal(h.writes.length, 0)
})

test('restoring a missing game does not create a document', async () => {
  const h = await setup()
  await h.store.restoreGame('friday_1')
  assert.equal(h.docs.has('attendance/friday_1'), false)
  assert.equal(h.writes.length, 0)
})

test('a skip clears only the target game and repeated skips do not repeat writes', async () => {
  const h = await setup()
  const original = game([record('p1'), record('p2')])
  h.docs.set('attendance/friday_1', copy(original))
  const other = { ...game([record('p3')]), schedule: 'friday_2' }
  h.docs.set('attendance/friday_2', copy(other))
  await h.store.skipGame('friday_1', { date: original.date })
  await h.store.skipGame('friday_1', { date: original.date })
  assert.equal(h.docs.get('attendance/friday_1').skipped, true)
  assert.deepEqual(h.docs.get('attendance/friday_1').records, [])
  assert.deepEqual(h.docs.get('attendance/friday_2'), other)
  assert.equal(h.writes.filter(w => w.path === 'attendance/friday_1').length, 1)
  const logs = h.logs().filter(l => l.eventType === 'game.skipped')
  assert.equal(logs.length, 1)
  assert.deepEqual(logs[0].before.records, original.records)
})

test('clearing a lineup or mission does not touch attendance', async () => {
  const h = await setup()
  const original = game([record('p1')])
  h.docs.set('attendance/friday_1', copy(original))
  h.docs.set('games/friday_1', { slots: [] })
  h.docs.set('missions/friday_1', { title: 'Test' })
  const { useGamesStore } = await h.load('src/stores/games.js')
  const { useMissionsStore } = await h.load('src/stores/missions.js')
  await useGamesStore().clearGame('friday_1')
  await useMissionsStore().clearMission('friday_1')
  assert.deepEqual(h.docs.get('attendance/friday_1'), original)
  assert.equal(h.docs.has('games/friday_1'), false)
  assert.equal(h.docs.has('missions/friday_1'), false)
})

test('single-game attendance clear does not affect other games, missions, lineups or archives', async () => {
  const h = await setup()
  for (const key of ['attendance/friday_1', 'attendance/friday_2', 'games/friday_1', 'missions/friday_1', 'archive/history']) {
    h.docs.set(key, game([record('p1')]))
  }
  const original = new Map([...h.docs].map(([key, value]) => [key, copy(value)]))
  await h.store.clearGameAttendance('friday_1')
  assert.equal(h.docs.has('attendance/friday_1'), false)
  for (const [key, value] of original) {
    if (key !== 'attendance/friday_1') assert.deepEqual(h.docs.get(key), value)
  }
})

test('whole-week attendance clear affects four games and records one operation id', async () => {
  const h = await setup()
  const gameIds = ['friday_1', 'friday_2', 'saturday_1', 'saturday_2']
  for (const id of gameIds) h.docs.set(`attendance/${id}`, { ...game([record('p1')]), schedule: id })
  h.docs.set('archive/history', { records: [record('p1')] })
  await h.store.clearAttendance({ operationId: 'week-reset' })
  for (const id of gameIds) assert.equal(h.docs.has(`attendance/${id}`), false)
  assert.deepEqual(h.docs.get('archive/history').records, [record('p1')])
  assert.equal(h.logs().length, 4)
  for (const log of h.logs()) {
    assert.equal(log.eventType, 'attendance.cleared')
    assert.equal(log.operationId, 'week-reset')
  }
})

test('a failed weekly attendance clear cannot leave only Friday 1 deleted', async () => {
  const h = await setup()
  const gameIds = ['friday_1', 'friday_2', 'saturday_1', 'saturday_2']
  for (const id of gameIds) h.docs.set(`attendance/${id}`, { ...game([record('p1')]), schedule: id })
  const original = new Map([...h.docs].map(([key, value]) => [key, copy(value)]))
  h.failures.add('attendance/friday_2')
  await assert.rejects(h.store.clearAttendance(), { code: 'permission-denied' })
  for (const [key, value] of original) assert.deepEqual(h.docs.get(key), value)
  assert.equal(h.logs().filter(l => l.outcome === 'success').length, 0)
})

test('weekly clear waits for queued edits and later edits wait for the clear', async () => {
  const h = await setup()
  h.docs.set('attendance/friday_1', game([record('p1')]))
  const before = h.store.setPlayerAttendance('friday_1', 'p2', 'confirmed')
  const clear = h.store.clearAttendance()
  const after = h.store.setPlayerAttendance('friday_1', 'p3', 'tentative')
  await Promise.all([before, clear, after])
  assert.deepEqual(h.docs.get('attendance/friday_1').records, [record('p3', 'tentative')])
})
