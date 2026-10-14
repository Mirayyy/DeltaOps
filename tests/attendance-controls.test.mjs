import test from 'node:test'
import assert from 'node:assert/strict'
import { ref } from 'vue'
import { createHarness } from './helpers/audit-harness.mjs'
import { loadComponentFunctions } from './helpers/component-functions.mjs'

const copy = value => JSON.parse(JSON.stringify(value))
const game = (schedule, skipped = false) => ({ schedule, date: '2026-10-16', skipped,
  records: skipped ? [] : [{ playerId: 'p1', attendance: 'confirmed' }],
})

async function lineup() {
  const h = await createHarness()
  const { useAttendanceStore } = await h.load('src/stores/attendance.js')
  const attendance = useAttendanceStore()
  const activeTab = ref('friday_1'), skipped = ref(false)
  let confirmation
  const handlers = await loadComponentFunctions('src/pages/LineupPage.vue',
    ['confirmClearAttendance', 'confirmSkipGame'], {
      activeTab, isActiveGameSkipped: skipped, activeGameMeta: ref({ id: 'friday_1', date: '2026-10-16' }),
      currentGame: ref(null), attendance, toast: { success() {} },
      requestConfirmation: config => { confirmation = config },
    })
  return { ...h, attendance, activeTab, skipped, handlers, confirmation: () => confirmation }
}

test('a restore confirmation cannot turn into a skip after another admin restores the game', async () => {
  const h = await lineup()
  h.docs.set('attendance/friday_1', game('friday_1', true))
  h.skipped.value = true
  await h.handlers.confirmSkipGame()
  // Another admin restores the game and then fills in attendance.
  const restored = game('friday_1')
  h.docs.set('attendance/friday_1', copy(restored))
  h.skipped.value = false
  await h.confirmation().onConfirm()
  assert.deepEqual(h.docs.get('attendance/friday_1'), restored)
})

test('clearing attendance stays bound to the game displayed when confirmation opened', async () => {
  const h = await lineup()
  h.docs.set('attendance/friday_1', game('friday_1'))
  const saturday = game('saturday_1')
  h.docs.set('attendance/saturday_1', copy(saturday))
  await h.handlers.confirmClearAttendance()
  // Route changes can update the active tab while the confirmation is open.
  h.activeTab.value = 'saturday_1'
  await h.confirmation().onConfirm()
  assert.equal(h.docs.has('attendance/friday_1'), false)
  assert.deepEqual(h.docs.get('attendance/saturday_1'), saturday)
})

for (const page of ['LineupPage', 'DashboardPage']) {
  test(`${page}: repeated confirm events start a destructive operation only once`, async () => {
    let release
    const waiting = new Promise(resolve => { release = resolve })
    let calls = 0
    const bindings = { confirmBusy: ref(false), confirmAction: ref({ onConfirm: async () => { calls++; await waiting } }) }
    const { handleConfirm } = await loadComponentFunctions(`src/pages/${page}.vue`, ['handleConfirm'], bindings)
    const first = handleConfirm(), second = handleConfirm()
    release()
    await Promise.all([first, second])
    assert.equal(calls, 1)
  })
}

test('week finalization cannot start twice while the first reset is running', async () => {
  let release
  const waiting = new Promise(resolve => { release = resolve })
  let calls = 0
  const { finalize } = await loadComponentFunctions('src/components/admin/WeekFinalizer.vue', ['finalize'], {
    canFinalize: ref(true), processing: ref(false), games: ref([]), activeRotation: ref(null),
    cloneForAudit: copy, emit() {}, roster: { activePlayers: [] },
    attendance: { applyAttendancePresets: async () => {} },
    runAuditOperation: async () => { calls++; await waiting },
  })
  const first = finalize(), second = finalize()
  release()
  await Promise.all([first, second])
  assert.equal(calls, 1)
})
