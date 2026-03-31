<script setup>
import { ref, computed } from 'vue'
import { useGamesStore } from '../../stores/games'
import { useMissionsStore } from '../../stores/missions'
import { useSquadConfig } from '../../stores/squadConfig'
import { SIDE_COLORS } from '../../utils/constants'
import BaseModal from '../common/BaseModal.vue'

const props = defineProps({
  gameId: { type: String, required: true },
  playerId: { type: String, required: true },
  mission: { type: Object, required: true },
})

const emit = defineEmits(['close'])

const gamesStore = useGamesStore()
const missionsStore = useMissionsStore()
const squadConfig = useSquadConfig()

const activeSide = ref(0)
const selectedKeys = ref(new Set())
const text = ref('')

const currentSide = computed(() => props.mission.sides[activeSide.value])

// Load existing request for this player
const existing = computed(() =>
  gamesStore.getSlotRequests(props.gameId).find(r => r.playerId === props.playerId)
)

// Pre-fill from existing request
if (existing.value) {
  text.value = existing.value.text || ''
  existing.value.slots.forEach(s => {
    selectedKeys.value.add(`${s.side}::${s.squad}::${s.number}`)
  })
}

function slotKey(sideName, squadName, slotIdx) {
  return `${sideName}::${squadName}::${slotIdx + 1}`
}

function isSelected(sideName, squadName, slotIdx) {
  return selectedKeys.value.has(slotKey(sideName, squadName, slotIdx))
}

function toggleSlot(sideName, squadName, slotIdx) {
  const key = slotKey(sideName, squadName, slotIdx)
  if (selectedKeys.value.has(key)) {
    selectedKeys.value.delete(key)
  } else {
    selectedKeys.value.add(key)
  }
}

// Toggle entire squad
function toggleSquad(sideName, squad) {
  const allActive = squad.slots.every((_, i) => isSelected(sideName, squad.name, i))
  squad.slots.forEach((_, i) => {
    const active = isSelected(sideName, squad.name, i)
    if (allActive && active) toggleSlot(sideName, squad.name, i)
    else if (!allActive && !active) toggleSlot(sideName, squad.name, i)
  })
}

function isSquadFullyActive(sideName, squad) {
  return squad.slots.every((_, i) => isSelected(sideName, squad.name, i))
}

function isSquadPartiallyActive(sideName, squad) {
  return squad.slots.some((_, i) => isSelected(sideName, squad.name, i)) && !isSquadFullyActive(sideName, squad)
}

function sideSelectedCount(side) {
  let count = 0
  for (const sq of side.squads) {
    for (let i = 0; i < sq.slots.length; i++) {
      if (isSelected(side.name, sq.name, i)) count++
    }
  }
  return count
}

const canSubmit = computed(() => selectedKeys.value.size > 0 || text.value.trim())

function submit() {
  if (!canSubmit.value) return

  // Build slots array from selected keys
  const slots = []
  for (const side of props.mission.sides) {
    for (const squad of side.squads) {
      squad.slots.forEach((roleName, i) => {
        if (isSelected(side.name, squad.name, i)) {
          slots.push({ side: side.name, squad: squad.name, number: i + 1, name: roleName })
        }
      })
    }
  }

  gamesStore.addSlotRequest(props.gameId, {
    playerId: props.playerId,
    slots,
    text: text.value.trim(),
  })

  emit('close')
}
</script>

<template>
  <BaseModal title="Запросить слот" wide @close="emit('close')">
    <!-- Side tabs -->
    <div class="flex gap-1 mb-4 bg-neutral-800 rounded-lg p-1">
      <button v-for="(side, idx) in mission.sides" :key="side.name"
        @click="activeSide = idx"
        :class="[
          'flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2',
          activeSide === idx
            ? [SIDE_COLORS[side.color]?.bg || 'bg-neutral-700', SIDE_COLORS[side.color]?.text || 'text-neutral-200', 'border', SIDE_COLORS[side.color]?.border || 'border-neutral-600']
            : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700/50'
        ]">
        <span :class="[SIDE_COLORS[side.color]?.dot || 'bg-neutral-500', 'w-2 h-2 rounded-full']"></span>
        {{ side.name }}
        <span v-if="missionsStore.getSideTeam(mission, side.color, squadConfig.side) === 'ally'" class="text-[10px] font-medium uppercase text-emerald-400/70">МЫ</span>
        <span v-else-if="missionsStore.getSideTeam(mission, side.color, squadConfig.side) === 'enemy'" class="text-[10px] font-medium uppercase text-red-400/70">Враг</span>
        <span v-if="sideSelectedCount(side)" class="text-[10px] font-mono text-delta-green">{{ sideSelectedCount(side) }}</span>
      </button>
    </div>

    <!-- Vehicles info -->
    <div v-if="currentSide.vehicles" class="mb-3 px-3 py-2 bg-neutral-800/50 rounded-lg border border-neutral-800">
      <div class="text-[10px] text-neutral-500 uppercase tracking-wider mb-0.5">Техника</div>
      <div class="text-xs text-neutral-300 leading-relaxed">{{ currentSide.vehicles }}</div>
    </div>

    <p class="text-xs text-neutral-500 mb-3">
      Выберите желаемые слоты и/или напишите комментарий.
    </p>

    <!-- Squads and slots -->
    <div class="space-y-3 max-h-[40vh] overflow-y-auto pr-1 mb-4">
      <div v-for="squad in currentSide.squads" :key="squad.name"
        class="bg-neutral-800/50 rounded-lg overflow-hidden">
        <!-- Squad header -->
        <button
          @click="toggleSquad(currentSide.name, squad)"
          :class="[
            'w-full flex items-center justify-between px-3 py-2 text-left transition-colors',
            isSquadFullyActive(currentSide.name, squad)
              ? 'bg-delta-green/10 hover:bg-delta-green/15'
              : isSquadPartiallyActive(currentSide.name, squad)
                ? 'bg-neutral-700/30 hover:bg-neutral-700/50'
                : 'hover:bg-neutral-700/30'
          ]">
          <div class="flex items-center gap-2">
            <span :class="[
              'w-4 h-4 rounded border text-[10px] flex items-center justify-center shrink-0 transition-colors',
              isSquadFullyActive(currentSide.name, squad)
                ? 'bg-delta-green border-delta-green text-white'
                : isSquadPartiallyActive(currentSide.name, squad)
                  ? 'border-delta-green/50 bg-delta-green/20 text-delta-green'
                  : 'border-neutral-600 text-transparent'
            ]">
              <template v-if="isSquadFullyActive(currentSide.name, squad)">&#10003;</template>
              <template v-else-if="isSquadPartiallyActive(currentSide.name, squad)">&#8211;</template>
            </span>
            <span class="text-sm font-medium text-neutral-200">{{ squad.name }}</span>
          </div>
          <span class="text-[10px] font-mono text-neutral-500">
            {{ squad.slots.filter((_, i) => isSelected(currentSide.name, squad.name, i)).length }}/{{ squad.slots.length }}
          </span>
        </button>

        <!-- Individual slots -->
        <div class="px-2 pb-2 pt-1 flex flex-wrap gap-1">
          <button v-for="(roleName, slotIdx) in squad.slots" :key="slotIdx"
            @click="toggleSlot(currentSide.name, squad.name, slotIdx)"
            :class="[
              'px-2.5 py-1.5 rounded-md text-xs transition-all border',
              isSelected(currentSide.name, squad.name, slotIdx)
                ? 'bg-delta-green/15 border-delta-green/40 text-delta-green hover:bg-delta-green/25'
                : 'bg-neutral-800 border-neutral-700 text-neutral-500 hover:text-neutral-300 hover:border-neutral-500'
            ]">
            <span class="font-mono text-[10px] opacity-50 mr-1">{{ slotIdx + 1 }}</span>
            {{ roleName }}
          </button>
        </div>
      </div>
    </div>

    <!-- Text input -->
    <textarea
      v-model="text"
      rows="2"
      placeholder="Комментарий (необязательно)..."
      class="w-full bg-neutral-800 border border-neutral-700 focus:border-delta-green rounded-lg px-3 py-2 text-sm text-neutral-300 outline-none resize-none transition-colors"
    ></textarea>

    <!-- Footer -->
    <div class="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
      <div class="text-xs text-neutral-500">
        Выбрано: <span class="text-delta-green font-mono">{{ selectedKeys.size }}</span> слотов
      </div>
      <div class="flex gap-2">
        <button @click="emit('close')" class="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors">
          Отмена
        </button>
        <button @click="submit" :disabled="!canSubmit"
          class="px-4 py-2 bg-delta-green hover:bg-delta-green/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Отправить
        </button>
      </div>
    </div>
  </BaseModal>
</template>
