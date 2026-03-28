<script setup>
import { ref, computed, onMounted } from 'vue'
import { useArchiveStore } from '../stores/archive'
import { useRosterStore } from '../stores/roster'
import { SIDE_COLORS, SLOT_TYPES } from '../utils/constants'
import EquipmentTag from '../components/common/EquipmentTag.vue'
import BaseModal from '../components/common/BaseModal.vue'
import BaseSelect from '../components/common/BaseSelect.vue'

const archive = useArchiveStore()
const roster = useRosterStore()

const SLOT_TYPE_STYLES = {
  squadCommander: 'bg-delta-green/20 text-delta-green border-delta-green/30',
  sideCommander: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  vehicle: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  reserve: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
}

const FT_COLORS = [
  'bg-red-500/20 text-red-300 border-red-500/30',
  'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'bg-orange-500/20 text-orange-300 border-orange-500/30',
]

function ftColor(name) {
  if (!name) return ''
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  return FT_COLORS[Math.abs(hash) % FT_COLORS.length]
}

function guessSideColor(sideName) {
  if (!sideName) return null
  const lower = sideName.toLowerCase()
  if (lower.includes('blu') || lower.includes('nato') || lower.includes('синие')) return 'blue'
  if (lower.includes('red') || lower.includes('opfor') || lower.includes('красные') || lower.includes('csat')) return 'red'
  if (lower.includes('green') || lower.includes('indep') || lower.includes('зелёные') || lower.includes('зеленые')) return 'green'
  return null
}

function groupSlots(slots) {
  const rows = []
  let lastGroup = null
  slots.forEach((slot, idx) => {
    const group = `${slot.side}::${slot.squad}`
    if (group !== lastGroup) {
      const squadSlots = slots.filter(s => s.side === slot.side && s.squad === slot.squad)
      rows.push({
        type: 'header',
        side: slot.side,
        squad: slot.squad,
        color: guessSideColor(slot.side),
        count: squadSlots.length,
        assigned: squadSlots.filter(s => s.playerId).length,
      })
      lastGroup = group
    }
    rows.push({ type: 'slot', slot, idx })
  })
  return rows
}

// --- State ---
const activeTab = ref('games')
const selectedRotation = ref('all') // 'all' or rotation ID

const rotationOptions = computed(() => [
  { value: 'all', label: 'Все' },
  ...archive.rotations.map(r => ({ value: r.id, label: r.name })),
])
const expandedDate = ref(null)
const expandedGame = ref(null)
const showNewRotation = ref(false)
const newRotationName = ref('')
const newRotationStart = ref('')

const gameLabel = {
  friday_1: 'Пятница 1', friday_2: 'Пятница 2',
  saturday_1: 'Суббота 1', saturday_2: 'Суббота 2',
}

onMounted(async () => {
  if (!roster.players.length) await roster.fetchPlayers()
  await archive.fetchArchives()
})

// --- Filtered archives by rotation ---
const filteredArchives = computed(() => {
  if (selectedRotation.value === 'all') return archive.archives
  return archive.archives.filter(a => a.rotation === selectedRotation.value)
})

// --- Games tab: group by date ---
const dateGroups = computed(() => {
  const groups = {}
  for (const a of filteredArchives.value) {
    const date = a.date || 'unknown'
    if (!groups[date]) groups[date] = { date, games: [] }
    groups[date].games.push(a)
  }
  return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date))
})

function toggleDate(date) {
  expandedDate.value = expandedDate.value === date ? null : date
  expandedGame.value = null
}

function selectGame(archiveId) {
  expandedGame.value = expandedGame.value === archiveId ? null : archiveId
}

function confirmedCount(gameArchive) {
  return (gameArchive.records || []).filter(r => r.attendance === 'confirmed').length
}

// --- Attendance tab ---

// Collect all unique player IDs from filtered archives (who have records)
const attendancePlayers = computed(() => {
  const playerMap = new Map()
  for (const a of filteredArchives.value) {
    for (const r of (a.records || [])) {
      if (!playerMap.has(r.playerId)) {
        playerMap.set(r.playerId, { uid: r.playerId, confirmed: 0, total: 0 })
      }
      const p = playerMap.get(r.playerId)
      p.total++
      if (r.attendance === 'confirmed') p.confirmed++
    }
  }
  return [...playerMap.values()]
    .map(p => ({ ...p, rate: p.total > 0 ? p.confirmed / p.total : 0 }))
    .sort((a, b) => b.rate - a.rate)
})

// Attendance history: per game day, which players confirmed
const attendanceHistory = computed(() => {
  return filteredArchives.value
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(a => {
      const recordMap = {}
      for (const r of (a.records || [])) {
        recordMap[r.playerId] = r.attendance
      }
      return { id: a.id, date: a.date, schedule: a.schedule, records: recordMap }
    })
})

// --- Optics tab ---

// Collect all unique player IDs who ever had optics
const opticsPlayers = computed(() => {
  const playerMap = new Map()
  for (const a of filteredArchives.value) {
    for (const s of (a.slots || [])) {
      if (!s.playerId) continue
      if (!playerMap.has(s.playerId)) {
        playerMap.set(s.playerId, { uid: s.playerId, withOptics: 0, total: 0 })
      }
      const p = playerMap.get(s.playerId)
      p.total++
      if (s.optics) p.withOptics++
    }
  }
  return [...playerMap.values()]
    .map(p => ({ ...p, rate: p.total > 0 ? p.withOptics / p.total : 0 }))
    .sort((a, b) => b.rate - a.rate)
})

// Optics history: per game day, which players had optics
const opticsHistory = computed(() => {
  return filteredArchives.value
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(a => {
      const slotMap = {}
      for (const s of (a.slots || [])) {
        if (s.playerId) slotMap[s.playerId] = !!s.optics
      }
      return { id: a.id, date: a.date, schedule: a.schedule, slots: slotMap }
    })
})

// --- Helpers ---
function formatPercent(rate) {
  return Math.round(rate * 100) + '%'
}

function rateColor(rate) {
  if (rate >= 0.7) return 'text-green-400'
  if (rate >= 0.4) return 'text-yellow-400'
  return 'text-red-400'
}

// --- Rotation CRUD ---
async function createRotation() {
  if (!newRotationName.value.trim()) return
  await archive.createRotation(newRotationName.value.trim(), newRotationStart.value || new Date().toISOString().slice(0, 10))
  newRotationName.value = ''
  newRotationStart.value = ''
  showNewRotation.value = false
}
</script>

<template>
  <div class="pb-20 md:pb-0">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div>
        <h1 class="text-2xl font-bold mb-1">Архив</h1>
        <p class="text-sm text-neutral-500">Архивы игр, посещаемость, оптика</p>
      </div>

      <!-- Rotation selector -->
      <div class="flex items-center gap-2">
        <BaseSelect v-model="selectedRotation" :options="rotationOptions" class="min-w-40" />
        <button @click="showNewRotation = true"
          class="p-2 text-neutral-500 hover:text-neutral-300 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors"
          title="Управление ротациями">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-5 bg-neutral-900 rounded-xl p-1 border border-neutral-800 max-w-md">
      <button @click="activeTab = 'games'"
        :class="['flex-1 py-2 text-sm font-medium rounded-lg transition-all',
          activeTab === 'games' ? 'bg-delta-green text-white' : 'text-neutral-400 hover:text-white']">
        Игры
      </button>
      <button @click="activeTab = 'attendance'"
        :class="['flex-1 py-2 text-sm font-medium rounded-lg transition-all',
          activeTab === 'attendance' ? 'bg-delta-green text-white' : 'text-neutral-400 hover:text-white']">
        Посещаемость
      </button>
      <button @click="activeTab = 'optics'"
        :class="['flex-1 py-2 text-sm font-medium rounded-lg transition-all',
          activeTab === 'optics' ? 'bg-delta-green text-white' : 'text-neutral-400 hover:text-white']">
        Оптика
      </button>
    </div>

    <!-- ==================== GAMES TAB ==================== -->
    <div v-if="activeTab === 'games'">
      <div v-if="!dateGroups.length" class="bg-neutral-900 rounded-xl border border-neutral-800 p-12 text-center">
        <p class="text-neutral-500">Нет архивов игр</p>
      </div>

      <div class="space-y-3">
        <div v-for="group in dateGroups" :key="group.date"
          class="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
          <button @click="toggleDate(group.date)"
            class="w-full px-5 py-3 flex items-center justify-between hover:bg-neutral-800/30 transition-colors">
            <div class="flex items-center gap-3">
              <span class="font-mono text-sm text-delta-green">{{ group.date }}</span>
              <span class="text-xs text-neutral-500">{{ group.games.length }} игр</span>
            </div>
            <svg :class="['w-4 h-4 text-neutral-500 transition-transform', expandedDate === group.date ? 'rotate-180' : '']"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div v-if="expandedDate === group.date" class="border-t border-neutral-800">
            <div v-for="game in group.games" :key="game.id" class="border-b border-neutral-800/50 last:border-b-0">
              <button @click="selectGame(game.id)"
                class="w-full px-5 py-2.5 flex items-center justify-between hover:bg-neutral-800/30 transition-colors">
                <span class="text-sm">{{ gameLabel[game.schedule] || game.schedule }}</span>
                <div class="flex items-center gap-3">
                  <span class="text-xs text-delta-green font-mono">{{ confirmedCount(game) }} чел.</span>
                  <svg :class="['w-3.5 h-3.5 text-neutral-500 transition-transform', expandedGame === game.id ? 'rotate-180' : '']"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              <div v-if="expandedGame === game.id" class="pb-4">
                <!-- Slots — full lineup table -->
                <div v-if="(game.slots || []).length" class="mb-4">
                  <div class="flex items-center justify-between px-5 py-2">
                    <h4 class="text-xs text-neutral-500">Расстановка</h4>
                    <div class="flex items-center gap-3 text-[10px] text-neutral-500">
                      <span>Слотов: <span class="text-neutral-300 font-mono">{{ game.slots.length }}</span></span>
                      <span>Назначено: <span class="text-delta-green font-mono">{{ game.slots.filter(s => s.playerId).length }}</span></span>
                    </div>
                  </div>

                  <!-- Desktop table -->
                  <div class="hidden md:block">
                    <table class="w-full text-sm table-fixed">
                      <thead>
                        <tr class="border-b border-neutral-800 text-neutral-500 text-xs">
                          <th class="text-left px-4 py-2 font-medium w-10">#</th>
                          <th class="text-left px-3 py-2 font-medium" style="width:14rem">Слот</th>
                          <th class="text-left px-3 py-2 font-medium" style="width:8rem">Тип</th>
                          <th class="text-left px-3 py-2 font-medium w-14">ФТ</th>
                          <th class="text-left px-3 py-2 font-medium" style="width:10rem">Позывной</th>
                          <th class="text-left px-3 py-2 font-medium" style="min-width:10rem">Снаряжение</th>
                          <th class="text-left px-3 py-2 font-medium">Заметки</th>
                        </tr>
                      </thead>
                      <tbody>
                        <template v-for="(row, rowIdx) in groupSlots(game.slots)" :key="rowIdx">
                          <tr v-if="row.type === 'header'"
                            :class="['border-b border-neutral-800', SIDE_COLORS[row.color]?.bg || 'bg-neutral-800/60']">
                            <td colspan="7" class="px-4 py-2">
                              <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                  <span :class="[SIDE_COLORS[row.color]?.dot || 'bg-neutral-500', 'w-2 h-2 rounded-full']"></span>
                                  <span :class="[SIDE_COLORS[row.color]?.text || 'text-neutral-400', 'text-xs font-bold uppercase tracking-wider']">
                                    {{ row.side }}
                                  </span>
                                  <span class="text-neutral-600 mx-1">›</span>
                                  <span class="text-xs font-medium text-neutral-300">{{ row.squad }}</span>
                                </div>
                                <span class="text-[10px] font-mono text-neutral-500">{{ row.assigned }}/{{ row.count }}</span>
                              </div>
                            </td>
                          </tr>
                          <tr v-else class="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                            <td class="px-4 py-2.5 font-mono text-xs text-neutral-500">{{ row.slot.number }}</td>
                            <td class="px-3 py-2.5 truncate" :title="row.slot.name">{{ row.slot.name }}</td>
                            <td class="px-3 py-2.5">
                              <span v-if="row.slot.type"
                                :class="['px-2 py-0.5 rounded text-xs border inline-block',
                                  SLOT_TYPE_STYLES[row.slot.type] || 'bg-neutral-700 text-neutral-400 border-neutral-600']">
                                {{ SLOT_TYPES[row.slot.type]?.label || '—' }}
                              </span>
                              <span v-else class="text-neutral-600 text-xs">—</span>
                            </td>
                            <td class="px-3 py-2.5">
                              <span v-if="row.slot.fireteam"
                                :class="['px-1.5 py-0.5 rounded text-xs font-mono border inline-block', ftColor(row.slot.fireteam)]">
                                {{ row.slot.fireteam }}
                              </span>
                              <span v-else class="text-neutral-600 text-xs">—</span>
                            </td>
                            <td class="px-3 py-2.5">
                              <span :class="row.slot.playerId ? 'text-neutral-200' : 'text-neutral-600'">
                                {{ row.slot.playerId ? roster.resolveNickname(row.slot.playerId) : '—' }}
                              </span>
                            </td>
                            <td class="px-3 py-2.5">
                              <div class="flex flex-wrap gap-1">
                                <EquipmentTag v-for="eq in (row.slot.equipment || [])" :key="eq" :name="eq" />
                                <span v-if="!(row.slot.equipment || []).length" class="text-neutral-600 text-xs">—</span>
                              </div>
                            </td>
                            <td class="px-3 py-2.5 text-xs text-neutral-500 truncate" :title="row.slot.notes">
                              {{ row.slot.notes || '—' }}
                            </td>
                          </tr>
                        </template>
                      </tbody>
                    </table>
                  </div>

                  <!-- Mobile cards -->
                  <div class="md:hidden">
                    <template v-for="(row, rowIdx) in groupSlots(game.slots)" :key="rowIdx">
                      <div v-if="row.type === 'header'"
                        :class="['px-4 py-2 border-b border-neutral-800 flex items-center justify-between',
                          SIDE_COLORS[row.color]?.bg || 'bg-neutral-800/60']">
                        <div class="flex items-center gap-2">
                          <span :class="[SIDE_COLORS[row.color]?.dot || 'bg-neutral-500', 'w-1.5 h-1.5 rounded-full']"></span>
                          <span :class="[SIDE_COLORS[row.color]?.text || 'text-neutral-400', 'text-[10px] font-bold uppercase tracking-wider']">
                            {{ row.side }}
                          </span>
                          <span class="text-neutral-600 text-[10px]">›</span>
                          <span class="text-xs text-neutral-300">{{ row.squad }}</span>
                        </div>
                        <span class="text-[10px] font-mono text-neutral-500">{{ row.assigned }}/{{ row.count }}</span>
                      </div>
                      <div v-else class="px-4 py-2.5 border-b border-neutral-800/50">
                        <div class="flex items-center justify-between mb-1">
                          <div class="flex items-center gap-2">
                            <span class="text-[10px] font-mono text-neutral-500">{{ row.slot.number }}</span>
                            <span class="text-sm">{{ row.slot.name }}</span>
                          </div>
                          <div class="flex items-center gap-1.5 shrink-0">
                            <span v-if="row.slot.fireteam"
                              :class="['px-1 py-0.5 rounded text-[10px] font-mono border', ftColor(row.slot.fireteam)]">
                              {{ row.slot.fireteam }}
                            </span>
                            <span v-if="row.slot.type"
                              :class="['px-1.5 py-0.5 rounded text-[10px] border',
                                SLOT_TYPE_STYLES[row.slot.type] || 'bg-neutral-700 text-neutral-400 border-neutral-600']">
                              {{ SLOT_TYPES[row.slot.type]?.label }}
                            </span>
                          </div>
                        </div>
                        <div class="flex items-center justify-between text-xs">
                          <span :class="row.slot.playerId ? 'text-neutral-300' : 'text-neutral-600'">
                            {{ row.slot.playerId ? roster.resolveNickname(row.slot.playerId) : '—' }}
                          </span>
                          <div v-if="(row.slot.equipment || []).length" class="flex gap-1">
                            <EquipmentTag v-for="eq in row.slot.equipment" :key="eq" :name="eq" />
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>

                <!-- Attendance within game -->
                <div class="px-5">
                  <h4 class="text-xs text-neutral-500 mb-2">Посещаемость</h4>
                  <div class="grid grid-cols-2 md:grid-cols-3 gap-1">
                    <div v-for="record in (game.records || [])" :key="record.playerId"
                      class="flex items-center justify-between px-3 py-1.5 rounded text-xs bg-neutral-800/30">
                      <span>{{ roster.resolveNickname(record.playerId) }}</span>
                      <span :class="record.attendance === 'confirmed' ? 'text-green-400 font-bold' : 'text-neutral-600'">
                        {{ record.attendance === 'confirmed' ? '✓' : '✗' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== ATTENDANCE TAB ==================== -->
    <div v-if="activeTab === 'attendance'">
      <div v-if="!attendancePlayers.length" class="bg-neutral-900 rounded-xl border border-neutral-800 p-12 text-center">
        <p class="text-neutral-500">Нет данных посещаемости</p>
      </div>

      <template v-else>
        <!-- Summary: player cards with % -->
        <div class="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden mb-4">
          <div class="px-5 py-3 border-b border-neutral-800">
            <h3 class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Сводка</h3>
          </div>
          <div class="overflow-x-auto">
            <div class="flex gap-0 min-w-max">
              <div v-for="p in attendancePlayers" :key="p.uid"
                class="flex flex-col items-center px-4 py-3 border-r border-neutral-800/50 last:border-r-0 min-w-[5rem]">
                <span class="text-xs text-neutral-300 font-medium truncate max-w-[4.5rem]" :title="roster.resolveNickname(p.uid)">
                  {{ roster.resolveNickname(p.uid) }}
                </span>
                <span :class="['text-lg font-bold font-mono mt-1', rateColor(p.rate)]">
                  {{ formatPercent(p.rate) }}
                </span>
                <span class="text-[10px] text-neutral-600 mt-0.5">{{ p.confirmed }}/{{ p.total }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- History: per game day -->
        <div class="space-y-2">
          <div v-for="entry in attendanceHistory" :key="entry.id"
            class="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
            <div class="px-5 py-2.5 border-b border-neutral-800 flex items-center gap-3">
              <span class="font-mono text-sm text-delta-green">{{ entry.date }}</span>
              <span class="text-xs text-neutral-500">{{ gameLabel[entry.schedule] || entry.schedule }}</span>
            </div>
            <div class="overflow-x-auto">
              <div class="flex gap-0 min-w-max">
                <div v-for="p in attendancePlayers" :key="p.uid"
                  class="flex flex-col items-center px-4 py-2.5 border-r border-neutral-800/50 last:border-r-0 min-w-[5rem]">
                  <span class="text-[10px] text-neutral-500 truncate max-w-[4.5rem]">
                    {{ roster.resolveNickname(p.uid) }}
                  </span>
                  <span v-if="entry.records[p.uid] === 'confirmed'"
                    class="text-green-400 font-bold text-sm mt-0.5">✓</span>
                  <span v-else-if="entry.records[p.uid]"
                    class="text-neutral-600 text-sm mt-0.5">✗</span>
                  <span v-else class="text-neutral-700 text-sm mt-0.5">—</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ==================== OPTICS TAB ==================== -->
    <div v-if="activeTab === 'optics'">
      <div v-if="!opticsPlayers.length" class="bg-neutral-900 rounded-xl border border-neutral-800 p-12 text-center">
        <p class="text-neutral-500">Нет данных по оптике</p>
      </div>

      <template v-else>
        <!-- Summary: player cards with % -->
        <div class="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden mb-4">
          <div class="px-5 py-3 border-b border-neutral-800">
            <h3 class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Сводка</h3>
          </div>
          <div class="overflow-x-auto">
            <div class="flex gap-0 min-w-max">
              <div v-for="p in opticsPlayers" :key="p.uid"
                class="flex flex-col items-center px-4 py-3 border-r border-neutral-800/50 last:border-r-0 min-w-[5rem]">
                <span class="text-xs text-neutral-300 font-medium truncate max-w-[4.5rem]" :title="roster.resolveNickname(p.uid)">
                  {{ roster.resolveNickname(p.uid) }}
                </span>
                <span :class="['text-lg font-bold font-mono mt-1', rateColor(p.rate)]">
                  {{ formatPercent(p.rate) }}
                </span>
                <span class="text-[10px] text-neutral-600 mt-0.5">{{ p.withOptics }}/{{ p.total }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- History: per game day -->
        <div class="space-y-2">
          <div v-for="entry in opticsHistory" :key="entry.id"
            class="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
            <div class="px-5 py-2.5 border-b border-neutral-800 flex items-center gap-3">
              <span class="font-mono text-sm text-delta-green">{{ entry.date }}</span>
              <span class="text-xs text-neutral-500">{{ gameLabel[entry.schedule] || entry.schedule }}</span>
            </div>
            <div class="overflow-x-auto">
              <div class="flex gap-0 min-w-max">
                <div v-for="p in opticsPlayers" :key="p.uid"
                  class="flex flex-col items-center px-4 py-2.5 border-r border-neutral-800/50 last:border-r-0 min-w-[5rem]">
                  <span class="text-[10px] text-neutral-500 truncate max-w-[4.5rem]">
                    {{ roster.resolveNickname(p.uid) }}
                  </span>
                  <span v-if="entry.slots[p.uid] === true"
                    class="text-red-400 font-bold text-sm mt-0.5">⊕</span>
                  <span v-else-if="entry.slots[p.uid] === false"
                    class="text-neutral-600 text-sm mt-0.5">—</span>
                  <span v-else class="text-neutral-700 text-sm mt-0.5">—</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- New rotation modal -->
    <BaseModal v-if="showNewRotation" title="Новая ротация" @close="showNewRotation = false">
      <div class="space-y-4">
        <div>
          <label class="text-xs text-neutral-500 block mb-1">Название</label>
          <input v-model="newRotationName" placeholder="Весна 2026"
            class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:border-delta-green outline-none">
        </div>
        <div>
          <label class="text-xs text-neutral-500 block mb-1">Дата начала</label>
          <input v-model="newRotationStart" type="date"
            class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:border-delta-green outline-none">
        </div>
        <div class="flex justify-end gap-2">
          <button @click="showNewRotation = false" class="px-4 py-2 text-sm text-neutral-400 hover:text-white">Отмена</button>
          <button @click="createRotation"
            class="px-4 py-2 bg-delta-green hover:bg-delta-green/80 text-white text-sm font-medium rounded-lg transition-colors">
            Создать
          </button>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
