<script setup>
import { ref, computed } from 'vue'
import { useRosterStore } from '../../stores/roster'
import { useAttendanceStore } from '../../stores/attendance'
import { useGamesStore } from '../../stores/games'
import { useArchiveStore } from '../../stores/archive'
import { useGameWeek } from '../../composables/useGameWeek'
import BaseModal from '../common/BaseModal.vue'

const emit = defineEmits(['close', 'done'])

const roster = useRosterStore()
const attendance = useAttendanceStore()
const gamesStore = useGamesStore()
const archive = useArchiveStore()
const { games } = useGameWeek()

const processing = ref(false)

const gameLabel = {
  friday_1: 'Пятница 1', friday_2: 'Пятница 2',
  saturday_1: 'Суббота 1', saturday_2: 'Суббота 2',
}

// Rotation check
const activeRotation = computed(() => archive.getActiveRotation())
const hasActiveRotation = computed(() => !!activeRotation.value)

// Check if a player is assigned to any slot in a game
function isInSlots(gameId, playerId) {
  return gamesStore.getSlots(gameId).some(s => s.playerId === playerId)
}

// Players marked "confirmed" but not in any slot — blocks finalization
const confirmedNotInSlots = computed(() => {
  const problems = []
  for (const game of games.value) {
    for (const p of roster.activePlayers) {
      const status = attendance.getPlayerAttendance(game.id, p.uid)
      if (status === 'confirmed' && !isInSlots(game.id, p.uid)) {
        problems.push({ gameId: game.id, gameLabel: gameLabel[game.id] || game.id, nickname: p.nickname })
      }
    }
  }
  return problems
})

const canFinalize = computed(() =>
  hasActiveRotation.value && confirmedNotInSlots.value.length === 0
)

// Preview what will happen
const preview = computed(() => {
  return games.value.map(game => {
    const slots = gamesStore.getSlots(game.id)
    const assigned = slots.filter(s => s.playerId).length

    let confirmed = 0
    let tentativeToConfirmed = 0
    let tentativeAbsent = 0
    let absent = 0
    let noResponse = 0

    for (const p of roster.activePlayers) {
      const status = attendance.getPlayerAttendance(game.id, p.uid)
      const inSlots = isInSlots(game.id, p.uid)

      if (status === 'confirmed') confirmed++
      else if (status === 'tentative' && inSlots) { tentativeToConfirmed++; confirmed++ }
      else if (status === 'tentative' && !inSlots) { tentativeAbsent++ }
      else if (status === 'absent') absent++
      else noResponse++
    }

    return {
      id: game.id,
      label: gameLabel[game.id] || game.id,
      date: game.date,
      slotCount: slots.length,
      assigned,
      confirmed,
      tentativeToConfirmed,
      tentativeAbsent,
      absent,
      noResponse,
    }
  })
})

/**
 * Finalization logic:
 * - confirmed + in slot → confirmed
 * - confirmed + NOT in slot → BLOCKED (admin must fix)
 * - tentative + in slot → confirmed (50/50 = был)
 * - tentative + NOT in slot → absent (50/50 без слота = не был)
 * - no_response → no_response (не отметился = не был)
 * - absent → absent
 * - optics: auto-derived from equipment (already on slot)
 */
async function finalize() {
  if (!canFinalize.value) return
  processing.value = true
  try {
    for (const game of games.value) {
      const gameData = gamesStore.getGame(game.id)

      const records = roster.activePlayers.map(p => {
        const status = attendance.getPlayerAttendance(game.id, p.uid)
        const inSlots = isInSlots(game.id, p.uid)
        let finalStatus = status

        if (status === 'tentative') {
          finalStatus = inSlots ? 'confirmed' : 'absent'
        }

        return { playerId: p.uid, attendance: finalStatus }
      })

      await archive.archiveGame({
        schedule: game.id,
        date: gameData?.date || game.date || '',
        sourceUrl: gameData?.sourceUrl || '',
        version: gameData?.version || '',
        server: '',
        side: '',
        slots: gameData?.slots || [],
        records,
        task: gameData?.task || '',
        adminUid: 'admin',
      })
    }

    await gamesStore.clearGames()
    await attendance.clearAttendance()

    emit('done')
  } finally {
    processing.value = false
  }
}
</script>

<template>
  <BaseModal title="Завершить неделю" @close="emit('close')">
    <div class="space-y-4">
      <p class="text-sm text-neutral-400">Итоги недели будут архивированы. Статусы обработаются автоматически.</p>

      <!-- Preview per game -->
      <div class="space-y-2">
        <div v-for="g in preview" :key="g.id"
          class="bg-neutral-800 rounded-lg p-3">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium">{{ g.label }}</span>
            <span class="text-[10px] text-neutral-500">{{ g.date }}</span>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span>Слотов: <span class="text-neutral-300 font-mono">{{ g.assigned }}/{{ g.slotCount }}</span></span>
            <span>Буду: <span class="text-green-400 font-mono">{{ g.confirmed }}</span></span>
            <span v-if="g.tentativeToConfirmed">
              <span class="text-neutral-500">(50/50→буду:</span>
              <span class="text-yellow-400 font-mono">{{ g.tentativeToConfirmed }}</span><span class="text-neutral-500">)</span>
            </span>
            <span v-if="g.tentativeAbsent">
              <span class="text-neutral-500">(50/50 без слота:</span>
              <span class="text-orange-400 font-mono">{{ g.tentativeAbsent }}</span><span class="text-neutral-500">)</span>
            </span>
            <span>Не буду: <span class="text-red-400 font-mono">{{ g.absent }}</span></span>
            <span>Без ответа: <span class="text-neutral-600 font-mono">{{ g.noResponse }}</span></span>
          </div>
        </div>
      </div>

      <!-- Blocking error: no active rotation -->
      <div v-if="!hasActiveRotation" class="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
        <p class="text-xs text-red-400 font-medium">Невозможно завершить: нет активной ротации</p>
        <p class="text-[10px] text-neutral-500 mt-1">Создайте или активируйте ротацию в Настройках</p>
      </div>

      <!-- Blocking error: confirmed but not in slots -->
      <div v-else-if="confirmedNotInSlots.length" class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2">
        <p class="text-xs text-red-400 font-medium">Невозможно завершить: игроки со статусом «Буду» не в расстановке</p>
        <div v-for="item in confirmedNotInSlots" :key="item.gameId + item.nickname"
          class="flex items-center gap-2 text-xs">
          <span class="text-neutral-500">{{ item.gameLabel }}:</span>
          <span class="text-red-300">{{ item.nickname }}</span>
        </div>
        <p class="text-[10px] text-neutral-500 mt-1">Добавьте в расстановку или измените статус на «Не буду»</p>
      </div>

      <!-- Rules reminder -->
      <div v-else class="bg-neutral-800/50 rounded-lg p-3 space-y-1.5 text-xs text-neutral-500">
        <div class="flex items-center gap-2">
          <span class="text-yellow-400">50/50</span>
          <span>+ в расстановке → засчитывается как «Буду»</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-orange-400">50/50</span>
          <span>+ нет в расстановке → считается отсутствием</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-neutral-600">Без ответа</span>
          <span>→ считается отсутствием</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-red-400">Не буду</span>
          <span>→ уже убран из расстановки</span>
        </div>
      </div>

      <!-- Warning -->
      <div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
        <p class="text-xs text-amber-400">
          Данные будут архивированы, текущая расстановка и посещаемость очищены. Отменить нельзя.
        </p>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3">
        <button @click="emit('close')" class="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors">
          Отмена
        </button>
        <button @click="finalize" :disabled="processing || !canFinalize"
          class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {{ processing ? 'Обработка...' : 'Завершить неделю' }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>
