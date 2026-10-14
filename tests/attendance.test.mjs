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
