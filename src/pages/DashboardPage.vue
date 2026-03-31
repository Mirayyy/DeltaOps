<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useRosterStore } from '../stores/roster'
import { useAttendanceStore } from '../stores/attendance'
import { useMissionsStore } from '../stores/missions'
import { useGameWeek } from '../composables/useGameWeek'
import { READINESS_STATUSES } from '../utils/constants'
import { canEditReadiness } from '../utils/permissions'
import StatusBadge from '../components/common/StatusBadge.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'
import WeekFinalizer from '../components/admin/WeekFinalizer.vue'
import MissionCard from '../components/missions/MissionCard.vue'
import MissionDetail from '../components/missions/MissionDetail.vue'
import { useSquadConfig } from '../stores/squadConfig'
import { useTelegram } from '../composables/useTelegram'
import { useToast } from '../composables/useToast'

const router = useRouter()
const auth = useAuthStore()
const roster = useRosterStore()
const attendance = useAttendanceStore()
const missionsStore = useMissionsStore()
const { games, gameDates, currentWeekId } = useGameWeek()

const showFinalizer = ref(false)
const selectedMission = ref(null)
const squadConfig = useSquadConfig()
const telegram = useTelegram()
const toast = useToast()

onMounted(async () => {
  if (!roster.players.length) await roster.fetchPlayers()
  await Promise.all([
    attendance.fetchAttendance(roster.activePlayers),
    missionsStore.fetchMissions(),
  ])
})

const pageLoading = computed(() => roster.loading || attendance.loading)

const summaryRows = computed(() => {
  const activeIds = new Set(roster.activePlayers.map(p => p.uid))
  const totalActive = activeIds.size
  return games.value.map(game => {
    const records = attendance.getGameAttendance(game.id).records || []
    const counts = { confirmed: 0, tentative: 0, absent: 0 }
    for (const r of records) {
      if (!activeIds.has(r.playerId)) continue
      if (r.attendance === 'confirmed') counts.confirmed++
      else if (r.attendance === 'tentative') counts.tentative++
      else if (r.attendance === 'absent') counts.absent++
    }
    const no_response = totalActive - counts.confirmed - counts.tentative - counts.absent
    return { ...game, ...counts, no_response, total: totalActive }
  })
})

function getUnresponded(gameId) {
  return attendance.unrespondedPlayers(gameId, roster.activePlayers)
}

const allUnresponded = computed(() => {
  const set = new Set()
  for (const game of games.value) {
    for (const p of getUnresponded(game.id)) {
      set.add(p.uid)
    }
  }
  return roster.activePlayers.filter(p => set.has(p.uid))
})

// Per-player readiness table
const playerRows = computed(() => {
  return roster.activePlayers.map(p => {
    const r = attendance.getPlayerReadiness(p.uid)
    return { ...p, readiness: r }
  })
})

function statusClass(status) {
  const map = {
    confirmed: 'bg-status-confirmed text-white',
    tentative: 'bg-status-tentative text-white',
    absent: 'bg-status-absent text-white',
    no_response: 'bg-neutral-700 text-neutral-400',
  }
  return map[status] || map.no_response
}

function statusLabel(status) {
  return READINESS_STATUSES[status]?.icon || '—'
}

// Cycle: confirmed → tentative → absent → confirmed
const CYCLE = ['confirmed', 'tentative', 'absent']

function canEdit(playerId) {
  return canEditReadiness(auth.user?.role, auth.user?.uid, playerId)
}

function cycleReadiness(gameId, playerId, currentStatus) {
  if (!canEdit(playerId)) return
  const idx = CYCLE.indexOf(currentStatus)
  const next = CYCLE[(idx + 1) % CYCLE.length]
  attendance.setPlayerAttendance(gameId, playerId, next)
}

async function sendReminder() {
  const msg = telegram.buildReminderMessage(allUnresponded.value, gameDates.value)
  const result = await telegram.sendMessage(msg)
  if (result.ok) {
    toast.success(result.demo ? 'Напоминание (демо) — см. консоль' : 'Напоминание отправлено')
  } else {
    toast.error('Ошибка: ' + result.error)
  }
}

async function sendMissionsToTelegram() {
  const missionsData = {}
  for (const g of games.value) {
    const m = missionsStore.getMission(g.id)
    if (m) missionsData[g.id] = m
  }
  if (!Object.keys(missionsData).length) {
    toast.error('Нет загруженных миссий')
    return
  }
  const msg = telegram.buildMissionsMessage(missionsData, gameDates.value, squadConfig.side)
  const result = await telegram.sendMessage(msg)
  if (result.ok) {
    toast.success(result.demo ? 'Миссии (демо) — см. консоль' : 'Миссии отправлены в Telegram')
  } else {
    toast.error('Ошибка: ' + result.error)
  }
}

async function onWeekFinalized() {
  showFinalizer.value = false
  toast.success('Неделя завершена, архивы созданы')
}
</script>

<template>
  <div class="pb-20 md:pb-0">
    <LoadingSpinner v-if="pageLoading" />
    <template v-else>
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div>
        <h1 class="text-2xl font-bold">Дашборд</h1>
        <p class="text-sm text-neutral-500">Неделя {{ currentWeekId }} | Пт {{ gameDates.friday }} — Сб {{ gameDates.saturday }}</p>
      </div>
      <div class="flex items-center gap-3">
        <button v-if="auth.isUserAdmin" @click="showFinalizer = true"
          class="text-xs px-3 py-1.5 border border-red-900/50 rounded-lg text-red-400 hover:text-red-300 hover:border-red-700 transition-colors">
          Завершить неделю
        </button>
      </div>
    </div>

    <!-- Readiness summary cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div v-for="row in summaryRows" :key="row.id"
        class="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
        <div class="text-xs text-neutral-500 mb-1">{{ row.label }}</div>
        <div class="text-sm text-neutral-400 mb-3">{{ row.date }}</div>

        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-status-confirmed"></span>
              <span class="text-xs text-neutral-300">Буду</span>
            </span>
            <span class="text-sm font-bold text-status-confirmed font-mono">{{ row.confirmed }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-status-tentative"></span>
              <span class="text-xs text-neutral-300">Возможно</span>
            </span>
            <span class="text-sm font-bold text-status-tentative font-mono">{{ row.tentative }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-status-absent"></span>
              <span class="text-xs text-neutral-300">Не буду</span>
            </span>
            <span class="text-sm font-bold text-status-absent font-mono">{{ row.absent }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-status-no-response"></span>
              <span class="text-xs text-neutral-300">Нет ответа</span>
            </span>
            <span class="text-sm font-bold text-neutral-400 font-mono">{{ row.no_response }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Missions -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Миссии недели</h3>
        <button v-if="auth.isUserAdmin && missionsStore.availableMissions.length"
          @click="sendMissionsToTelegram" :disabled="telegram.sending.value"
          class="tg-btn">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
          {{ telegram.sending.value ? '...' : 'Миссии' }}
        </button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MissionCard
          v-for="game in games" :key="game.id"
          :mission="missionsStore.getMission(game.id)"
          :game-label="game.label"
          @click="selectedMission = $event"
        />
      </div>
    </div>

    <!-- Mission detail modal -->
    <MissionDetail
      v-if="selectedMission"
      :mission="selectedMission"
      @close="selectedMission = null"
    />

    <!-- Unresponded alert -->
    <div v-if="allUnresponded.length && auth.isUserAdmin"
      class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-medium text-amber-400">Не отметились ({{ allUnresponded.length }})</h3>
        <button @click="sendReminder" :disabled="telegram.sending.value"
          class="tg-btn">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
          {{ telegram.sending.value ? '...' : 'Напомнить' }}
        </button>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <span v-for="p in allUnresponded" :key="p.uid"
          @click="router.push({ name: 'player-profile', params: { id: p.uid } })"
          class="text-xs px-2 py-1 bg-neutral-800 rounded-lg text-neutral-300 cursor-pointer hover:bg-neutral-700 transition-colors">
          {{ p.nickname }}
          <span v-if="p.telegramUsername" class="text-neutral-500 ml-0.5">@{{ p.telegramUsername.replace(/^@/, '') }}</span>
        </span>
      </div>
      <div v-if="!telegram.isConfigured" class="mt-2 text-[10px] text-neutral-600">
        Telegram не настроен — добавьте VITE_TELEGRAM_BOT_TOKEN и VITE_TELEGRAM_CHAT_ID
      </div>
    </div>

    <!-- Per-player readiness table -->
    <div class="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
      <h3 class="text-sm font-medium text-neutral-400 px-4 py-3 border-b border-neutral-800">
        Готовность по игрокам
      </h3>

      <!-- Desktop table -->
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-neutral-800 text-neutral-500 text-xs">
              <th class="text-left px-4 py-2.5 font-medium">Позывной</th>
              <th v-for="game in games" :key="game.id" class="text-center px-3 py-2.5 font-medium">
                {{ game.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in playerRows" :key="row.uid"
              class="border-b border-neutral-800/50 hover:bg-neutral-800/30 cursor-pointer transition-colors"
              @click="router.push({ name: 'player-profile', params: { id: row.uid } })">
              <td class="px-4 py-2.5 font-medium" :style="row.nicknameColor ? { color: row.nicknameColor } : {}">{{ row.nickname }}</td>
              <td v-for="game in games" :key="game.id" class="text-center px-3 py-2.5">
                <button
                  @click.stop="cycleReadiness(game.id, row.uid, row.readiness[game.id])"
                  :disabled="!canEdit(row.uid)"
                  :class="[
                    statusClass(row.readiness[game.id]),
                    'inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold transition-transform',
                    canEdit(row.uid) ? 'hover:scale-110 active:scale-95 cursor-pointer' : 'cursor-default'
                  ]">
                  {{ statusLabel(row.readiness[game.id]) }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <div class="md:hidden divide-y divide-neutral-800/50">
        <div v-for="row in playerRows" :key="row.uid"
          class="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-neutral-800/30"
          @click="router.push({ name: 'player-profile', params: { id: row.uid } })">
          <span class="text-sm font-medium" :style="row.nicknameColor ? { color: row.nicknameColor } : {}">{{ row.nickname }}</span>
          <div class="flex gap-1">
            <button v-for="game in games" :key="game.id"
              @click.stop="cycleReadiness(game.id, row.uid, row.readiness[game.id])"
              :disabled="!canEdit(row.uid)"
              :class="[
                statusClass(row.readiness[game.id]),
                'w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center transition-transform',
                canEdit(row.uid) ? 'active:scale-95' : ''
              ]">
              {{ statusLabel(row.readiness[game.id]) }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Week finalizer modal -->
    <WeekFinalizer v-if="showFinalizer" @close="showFinalizer = false" @done="onWeekFinalized" />
    </template>
  </div>
</template>
