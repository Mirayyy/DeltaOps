<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useRosterStore } from '../stores/roster'
import { useAttendanceStore } from '../stores/attendance'
import { useGamesStore } from '../stores/games'
import { useStatsStore } from '../stores/stats'
import { useArchiveStore } from '../stores/archive'
import { useWebContentStore } from '../stores/webContent'
import { useGameWeek } from '../composables/useGameWeek'
import { getTsgUrl, SIDE_COLORS, SLOT_TYPES } from '../utils/constants'
import { kpdColor } from '../utils/formatters'
import StatusBadge from '../components/common/StatusBadge.vue'
import SkillBadge from '../components/common/SkillBadge.vue'
import EquipmentTag from '../components/common/EquipmentTag.vue'
import PlayerEditor from '../components/roster/PlayerEditor.vue'
import ReadinessSelector from '../components/profile/ReadinessSelector.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'
import { useToast } from '../composables/useToast'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const roster = useRosterStore()
const attendance = useAttendanceStore()
const gamesStore = useGamesStore()
const statsStore = useStatsStore()
const archiveStore = useArchiveStore()
const webContent = useWebContentStore()
const { games } = useGameWeek()
const toast = useToast()

const showEditor = ref(false)
const showSlotHistory = ref(false)
const editingAvatar = ref(false)
const avatarUrl = ref('')
const telegramIdInput = ref('')
const savingTelegramId = ref(false)
const telegramBotUrl = import.meta.env.VITE_TELEGRAM_BOT_URL || ''

onMounted(async () => {
  if (!roster.players.length) await roster.fetchPlayers()
  await Promise.all([
    attendance.fetchAttendance(),
    gamesStore.fetchGames(),
    statsStore.fetchStats(),
    archiveStore.fetchArchives(),
    webContent.fetchContent(),
  ])
})

const isOwnProfile = computed(() => !route.params.id || route.params.id === auth.player?.uid)

const player = computed(() => {
  if (isOwnProfile.value) return auth.player
  return roster.getPlayer(route.params.id)
})

const canEditReadiness = computed(() => {
  if (!player.value) return false
  if (auth.isUserAdmin) return true
  return isOwnProfile.value && player.value.status === 'active'
})

const playerReadiness = computed(() => {
  if (!player.value) return {}
  return attendance.getPlayerReadiness(player.value.uid)
})

const playerSlots = computed(() => {
  if (!player.value) return {}
  return gamesStore.getPlayerSlots(player.value.uid)
})

function getSlotInfo(gameId) {
  const slot = playerSlots.value[gameId]
  if (!slot) return null
  return { name: slot.name, squad: slot.squad, equipment: slot.equipment || [] }
}

const playerAwards = computed(() => {
  if (!player.value) return []
  return webContent.getPlayerAwards(player.value.uid)
})

const playerKpd = computed(() => {
  if (!player.value) return null
  return statsStore.getPlayerStats(player.value.nickname)
})

// Attendance from archive
const attendanceStats = computed(() => {
  if (!player.value) return { allTime: null, rotation: null }
  const activeRotation = archiveStore.getActiveRotation()
  return {
    allTime: archiveStore.getPlayerAttendanceStats(player.value.uid),
    rotation: activeRotation ? archiveStore.getPlayerAttendanceStats(player.value.uid, activeRotation.id) : null,
  }
})

// Optics from archive
const opticsStats = computed(() => {
  if (!player.value) return { allTime: null, rotation: null }
  const activeRotation = archiveStore.getActiveRotation()
  return {
    allTime: archiveStore.getPlayerOpticsStats(player.value.uid),
    rotation: activeRotation ? archiveStore.getPlayerOpticsStats(player.value.uid, activeRotation.id) : null,
  }
})

// Slot history from archive — grouped by date with squad headers
const slotHistory = computed(() => {
  if (!player.value) return []
  return archiveStore.getPlayerHistory(player.value.uid)
})

const SLOT_TYPE_STYLES = {
  squadCommander: 'bg-delta-green/20 text-delta-green border-delta-green/30',
  sideCommander: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  vehicle: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  reserve: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
}

// Fireteam badge colors — deterministic hash (same as LineupPage)
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

// Build flat slot history rows with resolved slot data
const slotHistoryRows = computed(() => {
  if (!player.value) return []
  return slotHistory.value.map(entry => {
    const slot = archiveStore.getPlayerSlotInArchive(entry, player.value.uid)
    return { entry, slot }
  }).filter(r => r.slot)
})

// Schedule label map
const SCHEDULE_LABELS = {
  friday_1: 'Пятница 1',
  friday_2: 'Пятница 2',
  saturday_1: 'Суббота 1',
  saturday_2: 'Суббота 2',
}

function scheduleLabel(schedule) {
  return SCHEDULE_LABELS[schedule] || schedule
}

// Guess side color from side name in archived slot
function guessSideColor(sideName) {
  if (!sideName) return null
  const lower = sideName.toLowerCase()
  if (lower.includes('blu') || lower.includes('nato') || lower.includes('синие')) return 'blue'
  if (lower.includes('red') || lower.includes('opfor') || lower.includes('красные') || lower.includes('csat')) return 'red'
  if (lower.includes('green') || lower.includes('indep') || lower.includes('зелёные') || lower.includes('зеленые')) return 'green'
  return null
}

// Stats table columns — TSG API mapped format
const STAT_COLUMNS = [
  { key: 'rating', label: '#', format: v => v ?? '—' },
  { key: 'attendance', label: 'Посещ.', format: v => v ?? '—' },
  { key: 'kills', label: 'Фраги', format: v => v ?? '—' },
  { key: 'teamkills', label: 'ТК', format: v => v ?? '—' },
  { key: 'survival', label: 'Выжив.', format: v => v ?? '—' },
  { key: 'medicine', label: 'Медицина', format: v => v != null ? v.toFixed(3) : '—' },
  { key: 'chsv', label: 'ЧСВ', format: v => v != null ? v.toFixed(3) : '—' },
  { key: 'kpd', label: 'КПД', format: v => v != null ? v.toFixed(3) : '—' },
]

function formatKpd(val) {
  if (val == null) return '—'
  return val.toFixed(2)
}


function handleReadinessChange(gameId, status) {
  if (!player.value) return
  attendance.setPlayerAttendance(gameId, player.value.uid, status)
  const labels = { confirmed: 'Буду', tentative: 'Возможно', absent: 'Не буду' }
  toast.success(`${labels[status] || status}`)
}

function formatPercent(rate) {
  if (rate == null) return '—'
  return Math.round(rate * 100) + '%'
}

function attendanceColor(rate) {
  if (rate >= 0.7) return 'text-green-400'
  if (rate >= 0.4) return 'text-yellow-400'
  return 'text-red-400'
}

const canChangeAvatar = computed(() => {
  if (!player.value) return false
  return isOwnProfile.value || auth.isUserAdmin
})

function startEditAvatar() {
  avatarUrl.value = player.value?.avatar || ''
  editingAvatar.value = true
}

async function saveAvatar() {
  if (!player.value) return
  const url = avatarUrl.value.trim()
  await roster.updatePlayer(player.value.uid, { avatar: url })
  if (isOwnProfile.value && auth.player) {
    auth.player.avatar = url
  }
  editingAvatar.value = false
  toast.success('Аватар обновлён')
}

async function handleSave(data) {
  if (!player.value) return
  await roster.updatePlayer(player.value.uid, data)
  if (isOwnProfile.value && auth.player) {
    Object.assign(auth.player, data)
  }
  showEditor.value = false
}

async function saveTelegramId() {
  if (!player.value || !telegramIdInput.value.trim()) return
  savingTelegramId.value = true
  const id = Number(telegramIdInput.value.trim())
  if (!id || isNaN(id)) {
    toast.error('Неверный Telegram ID')
    savingTelegramId.value = false
    return
  }
  await roster.updatePlayer(player.value.uid, { telegramId: id })
  if (isOwnProfile.value && auth.player) {
    auth.player.telegramId = id
  }
  savingTelegramId.value = false
  telegramIdInput.value = ''
  toast.success('Telegram ID сохранён')
}
</script>

<template>
  <div v-if="!player" class="text-center py-12">
    <p class="text-neutral-500">Игрок не найден</p>
  </div>

  <div v-else class="pb-20 md:pb-0 max-w-6xl mx-auto">
    <!-- Player header -->
    <div class="bg-neutral-900 rounded-xl border border-neutral-800 p-6 mb-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-5">
          <div class="relative group shrink-0">
            <div class="w-20 h-20 rounded-2xl bg-neutral-800 flex items-center justify-center overflow-hidden">
              <img v-if="player.avatar" :src="player.avatar" :alt="player.nickname" class="w-full h-full object-cover" />
              <span v-else class="text-3xl font-bold text-neutral-500">{{ player.nickname?.[0] || '?' }}</span>
            </div>
            <button v-if="canChangeAvatar"
              @click="startEditAvatar"
              class="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
              <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
          <div>
            <div class="flex items-center gap-3 mb-1">
              <h1 class="text-2xl font-bold" :style="player.nicknameColor ? { color: player.nicknameColor } : {}">{{ player.nickname }}</h1>
              <StatusBadge :status="player.status" />
            </div>
            <p class="text-neutral-400 mb-1">{{ player.position }}</p>
            <div class="flex items-center gap-3 flex-wrap">
              <a :href="getTsgUrl(player.nickname)" target="_blank"
                class="text-xs text-delta-green hover:underline">TSG</a>
              <a v-if="player.steamUrl" :href="player.steamUrl" target="_blank"
                class="text-xs text-blue-400 hover:underline">Steam</a>
              <a v-if="player.telegramUsername" :href="`https://t.me/${player.telegramUsername.replace(/^@/, '')}`" target="_blank"
                class="text-xs text-sky-400 hover:underline">Telegram</a>
              <span v-if="player.email" class="text-xs text-neutral-600">{{ player.email }}</span>
            </div>
          </div>
        </div>

        <button v-if="auth.isUserAdmin || isOwnProfile" @click="showEditor = true"
          class="self-start px-4 py-2 text-xs border border-neutral-700 rounded-lg text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors">
          Редактировать
        </button>
      </div>
    </div>

    <!-- Avatar URL editor -->
    <div v-if="editingAvatar" class="bg-neutral-900 rounded-xl border border-neutral-800 p-4 mb-4">
      <label class="block text-xs text-neutral-500 mb-2">Ссылка на аватар</label>
      <div class="flex gap-2">
        <input v-model="avatarUrl" type="url" placeholder="https://..."
          class="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green"
          @keydown.enter="saveAvatar" />
        <button @click="saveAvatar"
          class="px-4 py-2 text-sm bg-delta-green hover:bg-delta-green/80 text-white rounded-lg transition-colors">
          Сохранить
        </button>
        <button @click="editingAvatar = false"
          class="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors">
          Отмена
        </button>
      </div>
      <div v-if="avatarUrl" class="mt-2 flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-neutral-800 overflow-hidden">
          <img :src="avatarUrl" class="w-full h-full object-cover" @error="$event.target.style.display='none'" />
        </div>
        <span class="text-[10px] text-neutral-600 truncate">{{ avatarUrl }}</span>
      </div>
    </div>

    <!-- Telegram notifications -->
    <div v-if="isOwnProfile" class="bg-neutral-900 rounded-xl border border-neutral-800 p-4 mb-4">
      <div v-if="player.telegramId" class="flex items-center gap-2">
        <svg class="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
        <span class="text-xs text-emerald-500">Уведомления в Telegram подключены</span>
      </div>
      <template v-else>
        <h3 class="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Уведомления о слотах и личных задачах Telegram</h3>
        <p class="text-sm text-neutral-300 mb-2">1. Инициируйте чат с ботом</p>
        <ol class="text-sm text-neutral-400 list-decimal list-inside space-y-1 mb-3">
          <li>Откройте чат с ботом <a :href="telegramBotUrl || 'https://t.me/TSGDeltaOps_bot'" target="_blank" class="text-sky-400 hover:underline">@TSGDeltaOps_bot</a></li>
          <li>Напишите <code class="text-sky-400">/start</code> или другое сообщение чтобы инициировать чат с ботом</li>
        </ol>
        <p class="text-sm text-neutral-300 mb-2">2. Получите свой Telegram ID</p>
        <ol class="text-sm text-neutral-400 list-decimal list-inside space-y-1 mb-3">
          <li>Откройте чат с ботом <a href="https://t.me/userinfobot" target="_blank" class="text-sky-400 hover:underline">@userinfobot</a></li>
          <li>Напишите <code class="text-sky-400">/start</code> для инициации бота</li>
          <li>Скопируйте ID пользователя</li>
          <li>Вставьте ID в поле ниже</li>
          <li>Сохраните изменения</li>
        </ol>
        <div class="flex gap-2">
          <input v-model="telegramIdInput" type="text" placeholder="Telegram ID"
            class="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:border-delta-green"
            @keydown.enter="saveTelegramId" />
          <button @click="saveTelegramId" :disabled="savingTelegramId"
            class="px-3 py-2 text-sm bg-delta-green hover:bg-delta-green/80 text-white rounded-lg transition-colors disabled:opacity-50">
            Сохранить
          </button>
        </div>
      </template>
    </div>

    <!-- Player awards -->
    <div v-if="playerAwards.length" class="bg-neutral-900 rounded-xl border border-neutral-800 p-6 mb-4">
      <h3 class="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-4">Достижения</h3>
      <div class="flex flex-wrap gap-3">
        <div v-for="award in playerAwards" :key="award._id"
          class="flex items-center gap-3 bg-neutral-800/50 rounded-lg px-4 py-3 border border-neutral-700/40">
          <div class="w-10 h-10 shrink-0 flex items-center justify-center">
            <img v-if="award.icon" :src="award.icon" :alt="award.title" class="w-8 h-8 object-contain" />
            <span v-else class="text-neutral-600 text-lg">★</span>
          </div>
          <div class="min-w-0">
            <div class="text-sm font-medium text-white">{{ award.title }}</div>
            <div class="text-xs text-neutral-400 truncate">{{ award.description }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Current week readiness -->
    <div class="bg-neutral-900 rounded-xl border border-neutral-800 p-6 mb-4">
      <h3 class="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-4">Текущая неделя</h3>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ReadinessSelector
          v-for="game in games"
          :key="game.id"
          :game-id="game.id"
          :game-label="game.label"
          :game-date="game.date"
          :current-status="playerReadiness[game.id] || 'no_response'"
          :disabled="!canEditReadiness"
          :slot-info="getSlotInfo(game.id)"
          @change="handleReadinessChange"
        />
      </div>
    </div>

    <!-- Skills (full width) -->
    <div class="bg-neutral-900 rounded-xl border border-neutral-800 p-6 mb-4">
      <h3 class="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-4">Навыки</h3>
      <div v-if="(player.skills || []).length" class="flex flex-wrap gap-2">
        <SkillBadge v-for="skill in player.skills" :key="skill.skillName" :role="skill.skillName" :level="skill.level" />
      </div>
      <p v-else class="text-neutral-600 text-sm">Навыки не указаны</p>
      <div class="flex items-center gap-5 mt-5 pt-4 border-t border-neutral-800 text-xs text-neutral-600">
        <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-skill-experienced"></span> Опытный</span>
        <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-skill-intermediate"></span> Средний</span>
        <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-skill-beginner"></span> Новичок</span>
      </div>
    </div>

    <!-- Wishes -->
    <div v-if="player.wishes" class="bg-neutral-900 rounded-xl border border-neutral-800 p-6 mb-4">
      <h3 class="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Пожелания</h3>
      <p class="text-sm text-neutral-300 whitespace-pre-line">{{ player.wishes }}</p>
    </div>

    <!-- Stats (full width, TSG table format) -->
    <div class="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden mb-4">
      <div class="flex items-center justify-between px-6 py-3 border-b border-neutral-800">
        <h3 class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Статистика</h3>
        <span v-if="playerKpd" :class="['text-lg font-bold font-mono', kpdColor(playerKpd.kpd || 0)]">
          КПД {{ formatKpd(playerKpd.kpd) }}
        </span>
      </div>
      <div v-if="playerKpd" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-neutral-800 text-neutral-500 text-xs">
              <th v-for="col in STAT_COLUMNS" :key="col.key"
                class="text-center px-3 py-2.5 font-medium whitespace-nowrap">
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr class="hover:bg-neutral-800/30">
              <td v-for="col in STAT_COLUMNS" :key="col.key"
                :class="[
                  'text-center px-3 py-3 font-mono whitespace-nowrap',
                  col.key === 'kpd' ? kpdColor(playerKpd.kpd || 0) + ' font-bold text-base' : 'text-neutral-300'
                ]">
                {{ col.format(playerKpd[col.key]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="px-6 py-8 text-center text-neutral-600 text-sm">
        Нет данных статистики
      </div>
    </div>

    <!-- Attendance + Optics row (compact) -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <!-- Attendance: rotation -->
      <div class="bg-neutral-900 rounded-xl border border-neutral-800 p-4 flex items-center gap-3">
        <div class="flex-1 min-w-0">
          <div class="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Посещ. ротация</div>
          <div :class="['text-2xl font-bold font-mono', attendanceColor(attendanceStats.rotation?.attendanceRate || 0)]">
            {{ formatPercent(attendanceStats.rotation?.attendanceRate) }}
          </div>
          <div class="text-[10px] text-neutral-600 mt-0.5">
            {{ attendanceStats.rotation?.attendedGames || 0 }}/{{ attendanceStats.rotation?.totalGames || 0 }} игр
          </div>
        </div>
        <div class="w-12 h-12 shrink-0">
          <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3" class="text-neutral-800" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3" class="text-delta-green"
              :stroke-dasharray="`${(attendanceStats.rotation?.attendanceRate || 0) * 97.4} 97.4`"
              stroke-linecap="round" />
          </svg>
        </div>
      </div>
      <!-- Attendance: all time -->
      <div class="bg-neutral-900 rounded-xl border border-neutral-800 p-4 flex items-center gap-3">
        <div class="flex-1 min-w-0">
          <div class="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Посещ. всё время</div>
          <div :class="['text-2xl font-bold font-mono', attendanceColor(attendanceStats.allTime?.attendanceRate || 0)]">
            {{ formatPercent(attendanceStats.allTime?.attendanceRate) }}
          </div>
          <div class="text-[10px] text-neutral-600 mt-0.5">
            {{ attendanceStats.allTime?.attendedGames || 0 }}/{{ attendanceStats.allTime?.totalGames || 0 }} игр
          </div>
        </div>
        <div class="w-12 h-12 shrink-0">
          <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3" class="text-neutral-800" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3" class="text-delta-green"
              :stroke-dasharray="`${(attendanceStats.allTime?.attendanceRate || 0) * 97.4} 97.4`"
              stroke-linecap="round" />
          </svg>
        </div>
      </div>
      <!-- Optics: rotation -->
      <div class="bg-neutral-900 rounded-xl border border-neutral-800 p-4 flex items-center gap-3">
        <div class="flex-1 min-w-0">
          <div class="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Оптика ротация</div>
          <div :class="['text-2xl font-bold font-mono', attendanceColor(opticsStats.rotation?.opticsRate || 0)]">
            {{ formatPercent(opticsStats.rotation?.opticsRate) }}
          </div>
          <div class="text-[10px] text-neutral-600 mt-0.5">
            {{ opticsStats.rotation?.gamesWithOptics || 0 }}/{{ opticsStats.rotation?.gamesPlayed || 0 }} игр
          </div>
        </div>
        <div class="w-12 h-12 shrink-0">
          <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3" class="text-neutral-800" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3" class="text-red-500"
              :stroke-dasharray="`${(opticsStats.rotation?.opticsRate || 0) * 97.4} 97.4`"
              stroke-linecap="round" />
          </svg>
        </div>
      </div>
      <!-- Optics: all time -->
      <div class="bg-neutral-900 rounded-xl border border-neutral-800 p-4 flex items-center gap-3">
        <div class="flex-1 min-w-0">
          <div class="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Оптика всё время</div>
          <div :class="['text-2xl font-bold font-mono', attendanceColor(opticsStats.allTime?.opticsRate || 0)]">
            {{ formatPercent(opticsStats.allTime?.opticsRate) }}
          </div>
          <div class="text-[10px] text-neutral-600 mt-0.5">
            {{ opticsStats.allTime?.gamesWithOptics || 0 }}/{{ opticsStats.allTime?.gamesPlayed || 0 }} игр
          </div>
        </div>
        <div class="w-12 h-12 shrink-0">
          <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3" class="text-neutral-800" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3" class="text-red-500"
              :stroke-dasharray="`${(opticsStats.allTime?.opticsRate || 0) * 97.4} 97.4`"
              stroke-linecap="round" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Slot history (lineup table format) -->
    <div class="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden mb-2">
      <button @click="showSlotHistory = !showSlotHistory"
        class="w-full px-6 py-3 flex items-center justify-between text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
        :class="showSlotHistory ? 'border-b border-neutral-800' : ''">
        <span>История слотов</span>
        <svg :class="['w-4 h-4 transition-transform', showSlotHistory ? 'rotate-180' : '']"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div v-if="showSlotHistory">
        <div v-if="!slotHistoryRows.length" class="px-6 py-8 text-center text-neutral-600 text-sm">Нет данных</div>

        <!-- Desktop table -->
        <div v-else class="hidden md:block overflow-x-auto">
          <table class="w-full text-sm table-fixed">
            <thead>
              <tr class="border-b border-neutral-800 text-neutral-500 text-xs">
                <th class="text-left px-4 py-2.5 font-medium" style="width:6.5rem">Дата</th>
                <th class="text-left px-3 py-2.5 font-medium" style="width:7rem">Игра</th>
                <th class="text-left px-3 py-2.5 font-medium" style="width:8rem">Сторона</th>
                <th class="text-left px-3 py-2.5 font-medium" style="width:9rem">Отделение</th>
                <th class="text-left px-3 py-2.5 font-medium w-8">#</th>
                <th class="text-left px-3 py-2.5 font-medium" style="width:12rem">Название</th>
                <th class="text-left px-3 py-2.5 font-medium" style="width:7rem">Тип</th>
                <th class="text-left px-3 py-2.5 font-medium w-14">ФТ</th>
                <th class="text-left px-3 py-2.5 font-medium" style="min-width:8rem">Снаряжение</th>
                <th class="text-left px-3 py-2.5 font-medium">Заметки</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in slotHistoryRows" :key="row.entry.id"
                class="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                <!-- Date -->
                <td class="px-4 py-2.5 text-xs text-neutral-400 font-mono">{{ row.entry.date }}</td>
                <!-- Schedule -->
                <td class="px-3 py-2.5 text-xs text-neutral-500">{{ scheduleLabel(row.entry.schedule) }}</td>
                <!-- Side (colored) -->
                <td class="px-3 py-2.5">
                  <span class="flex items-center gap-1.5">
                    <span :class="[SIDE_COLORS[guessSideColor(row.slot.side)]?.dot || 'bg-neutral-500', 'w-1.5 h-1.5 rounded-full shrink-0']"></span>
                    <span :class="[SIDE_COLORS[guessSideColor(row.slot.side)]?.text || 'text-neutral-400', 'text-xs truncate']">
                      {{ row.slot.side || '—' }}
                    </span>
                  </span>
                </td>
                <!-- Squad -->
                <td class="px-3 py-2.5 text-xs text-neutral-300 truncate" :title="row.slot.squad">{{ row.slot.squad || '—' }}</td>
                <!-- Number -->
                <td class="px-3 py-2.5 font-mono text-xs text-neutral-500">{{ row.slot.number }}</td>
                <!-- Slot name -->
                <td class="px-3 py-2.5 truncate text-neutral-200" :title="row.slot.name">{{ row.slot.name }}</td>
                <!-- Type -->
                <td class="px-3 py-2.5">
                  <span v-if="row.slot.type"
                    :class="[
                      'px-2 py-0.5 rounded text-xs border inline-block',
                      SLOT_TYPE_STYLES[row.slot.type] || 'bg-neutral-700 text-neutral-400 border-neutral-600'
                    ]">
                    {{ SLOT_TYPES[row.slot.type]?.label || '—' }}
                  </span>
                  <span v-else class="text-neutral-600 text-xs">—</span>
                </td>
                <!-- Fireteam -->
                <td class="px-3 py-2.5">
                  <span v-if="row.slot.fireteam"
                    :class="['px-1.5 py-0.5 rounded text-xs font-mono border inline-block', ftColor(row.slot.fireteam)]">
                    {{ row.slot.fireteam }}
                  </span>
                  <span v-else class="text-neutral-600 text-xs">—</span>
                </td>
                <!-- Equipment -->
                <td class="px-3 py-2.5">
                  <div class="flex flex-wrap gap-1">
                    <EquipmentTag v-for="eq in (row.slot.equipment || [])" :key="eq" :name="eq" />
                    <span v-if="!(row.slot.equipment || []).length" class="text-neutral-600 text-xs">—</span>
                  </div>
                </td>
                <!-- Notes -->
                <td class="px-3 py-2.5 text-xs text-neutral-500 truncate" :title="row.slot.notes">
                  {{ row.slot.notes || '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile cards -->
        <div v-if="slotHistoryRows.length" class="md:hidden divide-y divide-neutral-800/50">
          <div v-for="row in slotHistoryRows" :key="row.entry.id" class="px-4 py-3">
            <!-- Date + schedule -->
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-mono text-neutral-400">{{ row.entry.date }}</span>
              <span class="text-[10px] text-neutral-600">{{ scheduleLabel(row.entry.schedule) }}</span>
            </div>
            <!-- Side › Squad -->
            <div class="flex items-center gap-1.5 mb-1.5">
              <span :class="[SIDE_COLORS[guessSideColor(row.slot.side)]?.dot || 'bg-neutral-500', 'w-1.5 h-1.5 rounded-full']"></span>
              <span :class="[SIDE_COLORS[guessSideColor(row.slot.side)]?.text || 'text-neutral-400', 'text-[10px] font-bold uppercase']">
                {{ row.slot.side }}
              </span>
              <span class="text-neutral-600 text-[10px]">›</span>
              <span class="text-xs text-neutral-300">{{ row.slot.squad }}</span>
            </div>
            <!-- Slot name + details -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono text-neutral-500">{{ row.slot.number }}</span>
                <span class="text-sm text-neutral-200">{{ row.slot.name }}</span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span v-if="row.slot.fireteam"
                  :class="['px-1 py-0.5 rounded text-[10px] font-mono border', ftColor(row.slot.fireteam)]">
                  {{ row.slot.fireteam }}
                </span>
                <span v-if="row.slot.type"
                  :class="['px-1.5 py-0.5 rounded text-[10px] border', SLOT_TYPE_STYLES[row.slot.type] || 'bg-neutral-700 text-neutral-400 border-neutral-600']">
                  {{ SLOT_TYPES[row.slot.type]?.label }}
                </span>
              </div>
            </div>
            <!-- Equipment row -->
            <div v-if="(row.slot.equipment || []).length" class="flex flex-wrap gap-1 mt-2">
              <EquipmentTag v-for="eq in row.slot.equipment" :key="eq" :name="eq" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Editor modal -->
    <PlayerEditor
      v-if="showEditor"
      :player="player"
      @save="handleSave"
      @close="showEditor = false"
    />
  </div>
</template>
