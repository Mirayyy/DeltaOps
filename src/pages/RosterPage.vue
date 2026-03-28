<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRosterStore } from '../stores/roster'
import { useArchiveStore } from '../stores/archive'
import { useStatsStore } from '../stores/stats'
import { getTsgUrl } from '../utils/constants'
import { kpdColor } from '../utils/formatters'
import StatusBadge from '../components/common/StatusBadge.vue'
import SkillBadge from '../components/common/SkillBadge.vue'
import PlayerEditor from '../components/roster/PlayerEditor.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'
import BaseCheckbox from '../components/common/BaseCheckbox.vue'

const router = useRouter()
const roster = useRosterStore()
const archiveStore = useArchiveStore()
const statsStore = useStatsStore()

const statusFilter = ref('all')
const searchQuery = ref('')
const sortKey = ref('nickname')
const sortAsc = ref(true)
const showEditor = ref(false)
const editingPlayer = ref(null)
const showColumnConfig = ref(false)

// --- Column definitions ---
const ALL_COLUMNS = [
  { key: 'nickname', label: 'Позывной', default: true, sortable: true, minWidth: '10rem' },
  { key: 'position', label: 'Позиция', default: true, sortable: true, minWidth: '9rem' },
  { key: 'status', label: 'Статус', default: true, sortable: true, minWidth: '6rem' },
  { key: 'skills', label: 'Навыки', default: true, sortable: false, minWidth: '12rem' },
  { key: 'attRotation', label: 'Посещ. (рот)', default: true, sortable: true, minWidth: '6rem' },
  { key: 'attAllTime', label: 'Посещ. (всё)', default: true, sortable: true, minWidth: '6rem' },
  { key: 'optRotation', label: 'Оптика (рот)', default: false, sortable: true, minWidth: '6rem' },
  { key: 'optAllTime', label: 'Оптика (всё)', default: false, sortable: true, minWidth: '6rem' },
  { key: 'kpd', label: 'КПД', default: true, sortable: true, minWidth: '5rem' },
  { key: 'steam', label: 'Steam', default: false, sortable: false, minWidth: '4rem' },
  { key: 'tsg', label: 'TSG', default: false, sortable: false, minWidth: '4rem' },
  { key: 'telegram', label: 'Telegram', default: false, sortable: false, minWidth: '7rem' },
  { key: 'discord', label: 'Discord', default: false, sortable: false, minWidth: '7rem' },
  { key: 'linked', label: 'Привязка', default: true, sortable: true, minWidth: '5rem' },
  { key: 'email', label: 'Email', default: false, sortable: false, minWidth: '10rem' },
  { key: 'wishes', label: 'Пожелания', default: false, sortable: false, minWidth: '10rem' },
]

// Visible columns — persisted in localStorage
const STORAGE_KEY = 'deltaops_roster_columns'
const visibleKeys = ref(loadVisibleColumns())

function loadVisibleColumns() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return ALL_COLUMNS.filter(c => c.default).map(c => c.key)
}

watch(visibleKeys, v => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)), { deep: true })

const visibleColumns = computed(() => ALL_COLUMNS.filter(c => visibleKeys.value.includes(c.key)))

function toggleColumn(key) {
  const idx = visibleKeys.value.indexOf(key)
  if (idx !== -1) {
    // Don't allow hiding nickname
    if (key === 'nickname') return
    visibleKeys.value.splice(idx, 1)
  } else {
    visibleKeys.value.push(key)
  }
}

// --- Data loading ---
onMounted(async () => {
  await roster.fetchPlayers()
  await Promise.all([
    archiveStore.fetchArchives(),
    statsStore.fetchStats(),
  ])
})

// --- Player enrichment (attach stats) ---
const activeRotation = computed(() => archiveStore.getActiveRotation())

function getPlayerData(player) {
  const attAll = archiveStore.getPlayerAttendanceStats(player.uid)
  const attRot = activeRotation.value
    ? archiveStore.getPlayerAttendanceStats(player.uid, activeRotation.value.id)
    : null
  const optAll = archiveStore.getPlayerOpticsStats(player.uid)
  const optRot = activeRotation.value
    ? archiveStore.getPlayerOpticsStats(player.uid, activeRotation.value.id)
    : null
  const stats = statsStore.getPlayerStats(player.nickname)

  return {
    ...player,
    linked: !!player.email,
    attRotation: attRot?.attendanceRate ?? null,
    attAllTime: attAll?.attendanceRate ?? null,
    attRotGames: attRot ? `${attRot.attendedGames}/${attRot.totalGames}` : null,
    attAllGames: `${attAll.attendedGames}/${attAll.totalGames}`,
    optRotation: optRot?.opticsRate ?? null,
    optAllTime: optAll?.opticsRate ?? null,
    optRotGames: optRot ? `${optRot.gamesWithOptics}/${optRot.gamesPlayed}` : null,
    optAllGames: `${optAll.gamesWithOptics}/${optAll.gamesPlayed}`,
    kpd: stats?.kpd ?? null,
  }
}

// --- Filtering + sorting ---
const filteredPlayers = computed(() => {
  let list = roster.players

  if (statusFilter.value === 'all') {
    list = list.filter(p => p.status !== 'left')
  } else {
    list = list.filter(p => p.status === statusFilter.value)
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(p => {
      // Search across all text content: nickname, position, status, skills, telegram, wishes
      const texts = [
        p.nickname,
        p.position,
        p.status,
        p.telegramId,
        p.wishes,
        p.email ? 'привязан' : 'не привязан',
        ...(p.skills || []).map(s => `${s.skillName} ${s.level}`),
      ]
      return texts.some(t => t && String(t).toLowerCase().includes(q))
    })
  }

  // Enrich
  let enriched = list.map(getPlayerData)

  // Sort
  const key = sortKey.value
  const dir = sortAsc.value ? 1 : -1

  enriched.sort((a, b) => {
    // Custom position sort
    if (key === 'position') {
      return (positionRank(a.position) - positionRank(b.position)) * dir
    }

    let va = a[key]
    let vb = b[key]

    // Nulls last
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1

    if (typeof va === 'string') return va.localeCompare(vb) * dir
    return (va - vb) * dir
  })

  return enriched
})

const statusCounts = computed(() => ({
  all: roster.players.filter(p => p.status !== 'left').length,
  active: roster.activePlayers.length,
  reserve: roster.reservePlayers.length,
  banned: roster.bannedPlayers.length,
  left: roster.leftPlayers.length,
}))

// --- Sort handler ---
function toggleSort(key) {
  const col = ALL_COLUMNS.find(c => c.key === key)
  if (!col?.sortable) return
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = true
  }
}

function sortIcon(key) {
  if (sortKey.value !== key) return ''
  return sortAsc.value ? '↑' : '↓'
}

// --- Custom sort orders ---
const POSITION_ORDER = { 'КО': 0, 'Зам. КО': 1, 'Штаб': 2, 'Боец': 3, 'Курсант': 4, 'Запас': 5 }

function positionRank(pos) {
  if (!pos) return 999
  // Case-insensitive match
  const key = Object.keys(POSITION_ORDER).find(k => k.toLowerCase() === pos.toLowerCase())
  return key != null ? POSITION_ORDER[key] : 998
}

// --- Helpers ---
function formatPercent(rate) {
  if (rate == null) return '—'
  return Math.round(rate * 100) + '%'
}

function rateColor(rate) {
  if (rate == null) return 'text-neutral-600'
  if (rate >= 0.7) return 'text-green-400'
  if (rate >= 0.4) return 'text-yellow-400'
  return 'text-red-400'
}


function openAdd() {
  editingPlayer.value = null
  showEditor.value = true
}

function openEdit(player) {
  editingPlayer.value = player
  showEditor.value = true
}

async function handleSave(data) {
  if (editingPlayer.value) {
    await roster.updatePlayer(editingPlayer.value.uid, data)
  } else {
    await roster.addPlayer(data)
  }
  showEditor.value = false
  editingPlayer.value = null
}

function goToProfile(uid) {
  router.push({ name: 'player-profile', params: { id: uid } })
}
</script>

<template>
  <div class="pb-20 md:pb-0">
    <LoadingSpinner v-if="roster.loading" />
    <template v-else>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div>
        <h1 class="text-2xl font-bold">Состав</h1>
        <p class="text-sm text-neutral-500">{{ statusCounts.active }} активных, {{ statusCounts.reserve }} запас</p>
      </div>
      <button @click="openAdd"
        class="px-4 py-2 bg-delta-green hover:bg-delta-green/90 text-white text-sm font-medium rounded-lg transition-colors">
        + Добавить игрока
      </button>
    </div>

    <!-- Filters row -->
    <div class="flex flex-col sm:flex-row gap-3 mb-4">
      <!-- Status tabs -->
      <div class="flex gap-1 bg-neutral-900 rounded-lg p-1 overflow-x-auto">
        <button
          v-for="(label, key) in { all: 'Все', active: 'В строю', reserve: 'Запас', banned: 'Бан', left: 'Ушли' }"
          :key="key"
          @click="statusFilter = key"
          :class="[
            'px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap',
            statusFilter === key ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'
          ]">
          {{ label }} ({{ statusCounts[key] }})
        </button>
      </div>

      <!-- Search -->
      <input v-model="searchQuery" type="text" placeholder="Поиск..."
        class="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-delta-green sm:w-48" />

      <!-- Column config toggle -->
      <div class="relative ml-auto">
        <button @click="showColumnConfig = !showColumnConfig"
          class="p-2 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors"
          title="Настройка колонок">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <!-- Column config dropdown -->
        <div v-if="showColumnConfig"
          class="absolute right-0 top-full mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-30 w-56 py-2 max-h-80 overflow-y-auto">
          <div class="px-3 py-1.5 text-[10px] text-neutral-500 uppercase tracking-wider">Колонки</div>
          <div v-for="col in ALL_COLUMNS" :key="col.key"
            :class="['px-3 py-1 hover:bg-neutral-700 transition-colors',
              col.key === 'nickname' ? 'opacity-50' : '']">
            <BaseCheckbox
              :checked="visibleKeys.includes(col.key)"
              :disabled="col.key === 'nickname'"
              @change="toggleColumn(col.key)"
              size="sm"
            >
              <span :class="['text-xs', visibleKeys.includes(col.key) ? 'text-neutral-200' : 'text-neutral-500']">{{ col.label }}</span>
            </BaseCheckbox>
          </div>
        </div>
      </div>
    </div>

    <!-- Backdrop for column config -->
    <div v-if="showColumnConfig" class="fixed inset-0 z-20" @click="showColumnConfig = false"></div>

    <!-- Table (desktop) -->
    <div class="hidden md:block bg-neutral-900 rounded-xl border border-neutral-800 overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-neutral-800">
            <th v-for="col in visibleColumns" :key="col.key"
              :class="[
                'text-left px-4 py-3 font-medium text-xs whitespace-nowrap select-none',
                col.sortable ? 'cursor-pointer hover:text-white text-neutral-400' : 'text-neutral-500',
                sortKey === col.key ? 'text-delta-green' : ''
              ]"
              :style="{ minWidth: col.minWidth }"
              @click="toggleSort(col.key)">
              <span class="inline-flex items-center gap-1">
                {{ col.label }}
                <span v-if="sortIcon(col.key)" class="text-delta-green text-[10px]">{{ sortIcon(col.key) }}</span>
              </span>
            </th>
            <th class="px-4 py-3 w-12"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="player in filteredPlayers" :key="player.uid"
            class="border-b border-neutral-800/50 hover:bg-neutral-800/30 cursor-pointer transition-colors"
            @click="goToProfile(player.uid)">

            <td v-for="col in visibleColumns" :key="col.key" class="px-4 py-2.5">
              <!-- Nickname -->
              <template v-if="col.key === 'nickname'">
                <div class="flex items-center gap-2.5">
                  <div class="w-7 h-7 rounded-full bg-delta-green/20 flex items-center justify-center overflow-hidden shrink-0">
                    <img v-if="player.avatar" :src="player.avatar" :alt="player.nickname" class="w-full h-full object-cover" />
                    <span v-else class="text-xs font-bold text-delta-green">{{ (player.nickname || '?')[0] }}</span>
                  </div>
                  <span class="font-medium">{{ player.nickname }}</span>
                </div>
              </template>

              <!-- Position -->
              <template v-else-if="col.key === 'position'">
                <span class="text-neutral-400">{{ player.position || '—' }}</span>
              </template>

              <!-- Status -->
              <template v-else-if="col.key === 'status'">
                <StatusBadge :status="player.status" />
              </template>

              <!-- Skills -->
              <template v-else-if="col.key === 'skills'">
                <div class="flex flex-wrap gap-1 max-w-xs">
                  <SkillBadge v-for="skill in (player.skills || [])" :key="skill.skillName" :role="skill.skillName" :level="skill.level" />
                  <span v-if="!(player.skills || []).length" class="text-neutral-600">—</span>
                </div>
              </template>

              <!-- Attendance rotation -->
              <template v-else-if="col.key === 'attRotation'">
                <div class="text-right">
                  <span :class="['font-mono font-medium', rateColor(player.attRotation)]">
                    {{ formatPercent(player.attRotation) }}
                  </span>
                  <div v-if="player.attRotGames" class="text-[10px] text-neutral-600">{{ player.attRotGames }}</div>
                </div>
              </template>

              <!-- Attendance all time -->
              <template v-else-if="col.key === 'attAllTime'">
                <div class="text-right">
                  <span :class="['font-mono font-medium', rateColor(player.attAllTime)]">
                    {{ formatPercent(player.attAllTime) }}
                  </span>
                  <div class="text-[10px] text-neutral-600">{{ player.attAllGames }}</div>
                </div>
              </template>

              <!-- Optics rotation -->
              <template v-else-if="col.key === 'optRotation'">
                <div class="text-right">
                  <span :class="['font-mono font-medium', rateColor(player.optRotation)]">
                    {{ formatPercent(player.optRotation) }}
                  </span>
                  <div v-if="player.optRotGames" class="text-[10px] text-neutral-600">{{ player.optRotGames }}</div>
                </div>
              </template>

              <!-- Optics all time -->
              <template v-else-if="col.key === 'optAllTime'">
                <div class="text-right">
                  <span :class="['font-mono font-medium', rateColor(player.optAllTime)]">
                    {{ formatPercent(player.optAllTime) }}
                  </span>
                  <div class="text-[10px] text-neutral-600">{{ player.optAllGames }}</div>
                </div>
              </template>

              <!-- KPD -->
              <template v-else-if="col.key === 'kpd'">
                <span :class="['font-mono font-bold', kpdColor(player.kpd)]">
                  {{ player.kpd != null ? player.kpd.toFixed(2) : '—' }}
                </span>
              </template>

              <!-- Steam -->
              <template v-else-if="col.key === 'steam'">
                <a v-if="player.steamUrl" :href="player.steamUrl" target="_blank" @click.stop
                  class="text-blue-400 hover:underline text-xs">Steam</a>
                <span v-else class="text-neutral-600">—</span>
              </template>

              <!-- TSG -->
              <template v-else-if="col.key === 'tsg'">
                <a :href="getTsgUrl(player.nickname)" target="_blank" @click.stop
                  class="text-delta-green hover:underline text-xs">TSG</a>
              </template>

              <!-- Telegram -->
              <template v-else-if="col.key === 'telegram'">
                <span class="text-xs text-neutral-400">{{ player.telegramUsername || '—' }}</span>
              </template>

              <!-- Discord -->
              <template v-else-if="col.key === 'discord'">
                <span class="text-xs text-neutral-400">{{ player.discordUsername || '—' }}</span>
              </template>

              <!-- Linked -->
              <template v-else-if="col.key === 'linked'">
                <span v-if="player.linked" class="text-delta-green text-xs">Да</span>
                <span v-else class="text-red-400/60 text-xs">Нет</span>
              </template>

              <!-- Email -->
              <template v-else-if="col.key === 'email'">
                <span class="text-xs text-neutral-400">{{ player.email || '—' }}</span>
              </template>

              <!-- Wishes -->
              <template v-else-if="col.key === 'wishes'">
                <span class="text-xs text-neutral-500 truncate block max-w-[12rem]" :title="player.wishes">
                  {{ player.wishes || '—' }}
                </span>
              </template>
            </td>

            <!-- Edit button -->
            <td class="px-4 py-2.5 text-right">
              <button @click.stop="openEdit(player)"
                class="text-neutral-500 hover:text-delta-green text-xs transition-colors">
                Ред.
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!filteredPlayers.length" class="text-center py-8 text-neutral-500">
        Нет игроков
      </div>
    </div>

    <!-- Cards (mobile) -->
    <div class="md:hidden space-y-2">
      <div v-for="player in filteredPlayers" :key="player.uid"
        @click="goToProfile(player.uid)"
        class="bg-neutral-900 border border-neutral-800 rounded-xl p-4 cursor-pointer hover:bg-neutral-800/50 transition-colors">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <div class="w-9 h-9 rounded-full bg-delta-green/20 flex items-center justify-center overflow-hidden">
              <img v-if="player.avatar" :src="player.avatar" :alt="player.nickname" class="w-full h-full object-cover" />
              <span v-else class="text-sm font-bold text-delta-green">{{ (player.nickname || '?')[0] }}</span>
            </div>
            <div>
              <div class="font-medium text-sm">{{ player.nickname }}</div>
              <div class="text-xs text-neutral-500">{{ player.position }}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <StatusBadge :status="player.status" />
            <button @click.stop="openEdit(player)"
              class="text-neutral-500 hover:text-delta-green text-xs">
              Ред.
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between text-xs">
          <div class="flex flex-wrap gap-1">
            <SkillBadge v-for="skill in (player.skills || [])" :key="skill.skillName" :role="skill.skillName" :level="skill.level" />
            <span v-if="!(player.skills || []).length" class="text-neutral-600">—</span>
          </div>
          <div class="flex items-center gap-3">
            <span :class="['font-mono', rateColor(player.attRotation)]">{{ formatPercent(player.attRotation) }}</span>
            <span :class="['font-mono font-bold', kpdColor(player.kpd)]">{{ player.kpd != null ? player.kpd.toFixed(2) : '—' }}</span>
          </div>
        </div>
      </div>

      <div v-if="!filteredPlayers.length" class="text-center py-8 text-neutral-500">
        Нет игроков
      </div>
    </div>

    <!-- Editor modal -->
    <PlayerEditor
      v-if="showEditor"
      :player="editingPlayer"
      @save="handleSave"
      @close="showEditor = false"
    />

    </template>
  </div>
</template>
