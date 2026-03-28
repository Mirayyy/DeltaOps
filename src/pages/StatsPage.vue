<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRosterStore } from '../stores/roster'
import { useStatsStore } from '../stores/stats'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'
import { kpdColor } from '../utils/formatters'
import { useSquadConfig } from '../stores/squadConfig'

const roster = useRosterStore()
const statsStore = useStatsStore()
const squad = useSquadConfig()

const activeTab = ref('general')
const sortKey = ref('rank')
const sortAsc = ref(true)

onMounted(async () => {
  if (!roster.players.length) await roster.fetchPlayers()
  await statsStore.fetchStats()
})

// Active player nicknames for filtering
const activeNicknames = computed(() =>
  roster.activePlayers.map(p => p.nickname).filter(Boolean)
)

// --- DELTA squad card ---
const deltaSquad = computed(() => statsStore.deltaSquad)

// --- Filtered player tables (unsorted, sorting applied in currentPlayers) ---
const tabData = computed(() => ({
  general: statsStore.filterByNicknames(statsStore.allStats, activeNicknames.value),
  infantry: statsStore.filterByNicknames(statsStore.infantryStats, activeNicknames.value),
  vehicle: statsStore.filterByNicknames(statsStore.vehicleStats, activeNicknames.value),
  artillery: statsStore.filterByNicknames(statsStore.artilleryStats, activeNicknames.value),
}))

// Current tab data — sorted
const currentPlayers = computed(() => {
  const list = [...(tabData.value[activeTab.value] || [])]
  const key = sortKey.value
  const dir = sortAsc.value ? 1 : -1

  list.sort((a, b) => {
    let va = a[key]
    let vb = b[key]
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    if (typeof va === 'string') return va.localeCompare(vb) * dir
    return (va - vb) * dir
  })
  return list
})

// Tab counts
const tabCounts = computed(() => ({
  general: tabData.value.general.length,
  infantry: tabData.value.infantry.length,
  vehicle: tabData.value.vehicle.length,
  artillery: tabData.value.artillery.length,
}))

// Squad rank
const squadRank = computed(() => {
  if (!deltaSquad.value) return null
  return { rank: deltaSquad.value.rank, total: statsStore.squadStats.length }
})

// --- Sorting ---
function toggleSort(key) {
  const col = COLUMNS.find(c => c.key === key)
  if (!col?.sortable) return
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = key === 'callsign' // asc for names, asc for rank (lower=better)
  }
}

function sortIcon(key) {
  if (sortKey.value !== key) return ''
  return sortAsc.value ? '↑' : '↓'
}

// --- Helpers ---

function fmt(val, decimals = 0) {
  if (val == null) return '—'
  return decimals > 0 ? val.toFixed(decimals) : val
}

function deltaIcon(d) {
  if (d > 0) return { text: `▲${d}`, cls: 'text-green-500' }
  if (d < 0) return { text: `▼${Math.abs(d)}`, cls: 'text-red-500' }
  return null
}

async function refresh() {
  await statsStore.fetchFromApi()
}

const tabs = [
  { key: 'general', label: 'Общая' },
  { key: 'infantry', label: 'Пехота' },
  { key: 'vehicle', label: 'Техника' },
  { key: 'artillery', label: 'Артиллерия' },
]

const COLUMNS = [
  { key: 'rank', label: '#', sortable: true },
  { key: 'delta', label: '±', sortable: true },
  { key: 'callsign', label: 'Позывной', sortable: true, align: 'left' },
  { key: 'attendance', label: 'Посещ.', sortable: true },
  { key: 'frags', label: 'Фраги', sortable: true },
  { key: 'tk', label: 'ТК', sortable: true },
  { key: 'survival', label: 'Выжив.', sortable: true },
  { key: 'medic', label: 'Медицина', sortable: true },
  { key: 'ego', label: 'ЧСВ', sortable: true },
  { key: 'efficiency', label: 'КПД', sortable: true },
]
</script>

<template>
  <div class="pb-20 md:pb-0 max-w-6xl mx-auto">
    <LoadingSpinner v-if="statsStore.loading && !statsStore.allStats.length" />
    <template v-else>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div>
        <h1 class="text-2xl font-bold">Статистика</h1>
        <p class="text-sm text-neutral-500">
          Данные TSG
          <span v-if="statsStore.lastUpdated" class="text-neutral-600 ml-1">· обновлено {{ statsStore.lastUpdated }}</span>
        </p>
      </div>
      <button @click="refresh" :disabled="statsStore.loading"
        class="px-4 py-2 text-sm border border-neutral-700 rounded-lg text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors disabled:opacity-50">
        {{ statsStore.loading ? 'Загрузка...' : 'Обновить' }}
      </button>
    </div>

    <!-- Error -->
    <div v-if="statsStore.fetchError" class="mb-4 px-4 py-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg">
      {{ statsStore.fetchError }}
    </div>

    <!-- DELTA Squad Overview -->
    <div class="bg-neutral-900 rounded-xl border border-neutral-800 p-5 mb-5">
      <div class="flex items-center gap-4 mb-4">
        <img :src="squad.logo" :alt="squad.name" class="w-12 h-12 rounded-xl object-cover" />
        <div class="flex-1">
          <div class="flex items-center gap-3">
            <h2 class="text-lg font-bold">{{ squad.name }}</h2>
            <template v-if="deltaSquad">
              <span v-if="deltaSquad.delta > 0" class="text-xs text-green-500 font-mono">▲{{ deltaSquad.delta }}</span>
              <span v-else-if="deltaSquad.delta < 0" class="text-xs text-red-500 font-mono">▼{{ Math.abs(deltaSquad.delta) }}</span>
              <span v-else class="text-xs text-neutral-600 font-mono">=</span>
            </template>
          </div>
          <p class="text-xs text-neutral-500" v-if="squadRank">
            Рейтинг отряда: <span class="text-delta-green font-mono font-bold">{{ squadRank.rank }}</span>
            <span class="text-neutral-600"> / {{ squadRank.total }}</span>
          </p>
        </div>
      </div>

      <div v-if="deltaSquad" class="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
        <div class="text-center">
          <div class="text-lg font-bold font-mono text-delta-green">{{ fmt(deltaSquad.efficiency, 3) }}</div>
          <div class="text-[10px] text-neutral-500">КПД</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-bold font-mono">{{ fmt(deltaSquad.frags) }}</div>
          <div class="text-[10px] text-neutral-500">Фраги</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-bold font-mono text-neutral-400">{{ fmt(deltaSquad.infantryFrags) }}</div>
          <div class="text-[10px] text-neutral-500">Пехота</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-bold font-mono text-neutral-400">{{ fmt(deltaSquad.vehicleFrags) }}</div>
          <div class="text-[10px] text-neutral-500">Техника</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-bold font-mono text-red-400">{{ fmt(deltaSquad.tk) }}</div>
          <div class="text-[10px] text-neutral-500">ТК</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-bold font-mono">{{ fmt(deltaSquad.survival) }}</div>
          <div class="text-[10px] text-neutral-500">Выжив.</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-bold font-mono">{{ fmt(deltaSquad.attendance) }}</div>
          <div class="text-[10px] text-neutral-500">Посещ.</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-bold font-mono">{{ fmt(deltaSquad.ego, 3) }}</div>
          <div class="text-[10px] text-neutral-500">ЧСВ</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-bold font-mono text-yellow-400">{{ fmt(deltaSquad.championCount) }}</div>
          <div class="text-[10px] text-neutral-500">Чемпион</div>
        </div>
      </div>
      <div v-else class="text-neutral-600 text-sm">Нет данных об отряде</div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 bg-neutral-900 rounded-lg p-1 mb-4 overflow-x-auto">
      <button v-for="tab in tabs" :key="tab.key"
        @click="activeTab = tab.key; sortKey = 'rank'; sortAsc = true"
        :class="[
          'px-4 py-2 text-xs rounded-md transition-colors whitespace-nowrap',
          activeTab === tab.key ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'
        ]">
        {{ tab.label }}
        <span class="text-neutral-600 font-mono ml-1">{{ tabCounts[tab.key] }}</span>
      </button>
    </div>

    <!-- Player Stats Table -->
    <div class="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
      <!-- Desktop table -->
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-neutral-800">
              <th v-for="col in COLUMNS" :key="col.key"
                @click="toggleSort(col.key)"
                :class="[
                  'px-3 py-2.5 font-medium text-xs whitespace-nowrap select-none',
                  col.align === 'left' ? 'text-left' : 'text-center',
                  col.sortable ? 'cursor-pointer hover:text-white' : '',
                  sortKey === col.key ? 'text-delta-green' : 'text-neutral-500',
                ]">
                <span class="inline-flex items-center gap-1">
                  {{ col.label }}
                  <span v-if="sortIcon(col.key)" class="text-delta-green text-[10px]">{{ sortIcon(col.key) }}</span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="player in currentPlayers" :key="player.callsign"
              class="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">

              <!-- Rank -->
              <td class="px-3 py-2.5 text-center text-neutral-600 font-mono text-xs">{{ player.rank }}</td>

              <!-- Delta -->
              <td class="px-3 py-2.5 text-center">
                <template v-if="deltaIcon(player.delta)">
                  <span :class="['text-[10px]', deltaIcon(player.delta).cls]">{{ deltaIcon(player.delta).text }}</span>
                </template>
                <span v-else class="text-neutral-700 text-[10px]">—</span>
              </td>

              <!-- Callsign -->
              <td class="px-3 py-2.5 text-left font-medium">{{ player.callsign }}</td>

              <!-- Attendance -->
              <td class="px-3 py-2.5 text-center font-mono text-neutral-300">{{ player.attendance }}</td>

              <!-- Frags -->
              <td class="px-3 py-2.5 text-center font-mono text-neutral-300">{{ player.frags }}</td>

              <!-- TK -->
              <td :class="['px-3 py-2.5 text-center font-mono', player.tk > 5 ? 'text-red-400' : 'text-neutral-500']">
                {{ player.tk }}
              </td>

              <!-- Survival -->
              <td class="px-3 py-2.5 text-center font-mono text-neutral-300">{{ player.survival }}</td>

              <!-- Medic -->
              <td class="px-3 py-2.5 text-center font-mono text-neutral-400">{{ fmt(player.medic, 3) }}</td>

              <!-- Ego / ЧСВ -->
              <td class="px-3 py-2.5 text-center font-mono text-neutral-400">{{ fmt(player.ego, 3) }}</td>

              <!-- KPD -->
              <td :class="['px-3 py-2.5 text-center font-mono font-bold', kpdColor(player.efficiency)]">
                {{ fmt(player.efficiency, 3) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <div class="md:hidden divide-y divide-neutral-800/50">
        <div v-for="player in currentPlayers" :key="player.callsign"
          class="px-4 py-3">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-xs text-neutral-600 font-mono w-6">{{ player.rank }}</span>
              <span class="text-sm font-medium">{{ player.callsign }}</span>
              <template v-if="deltaIcon(player.delta)">
                <span :class="['text-[10px]', deltaIcon(player.delta).cls]">{{ deltaIcon(player.delta).text }}</span>
              </template>
            </div>
            <span :class="['font-mono font-bold text-sm', kpdColor(player.efficiency)]">
              {{ fmt(player.efficiency, 3) }}
            </span>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
            <span>Посещ: <span class="text-neutral-300 font-mono">{{ player.attendance }}</span></span>
            <span>Фраги: <span class="text-neutral-300 font-mono">{{ player.frags }}</span></span>
            <span>ТК: <span :class="['font-mono', player.tk > 5 ? 'text-red-400' : 'text-neutral-400']">{{ player.tk }}</span></span>
            <span>Выж: <span class="text-neutral-300 font-mono">{{ player.survival }}</span></span>
            <span>ЧСВ: <span class="text-neutral-400 font-mono">{{ fmt(player.ego, 3) }}</span></span>
          </div>
        </div>
      </div>

      <div v-if="!currentPlayers.length" class="px-4 py-8 text-center text-neutral-600 text-sm">
        Нет данных
      </div>
    </div>

    </template>
  </div>
</template>
