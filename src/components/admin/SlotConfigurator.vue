<script setup>
import { ref, computed } from 'vue'
import { useGamesStore } from '../../stores/games'
import { useMissionsStore } from '../../stores/missions'
import { useSquadConfig } from '../../stores/squadConfig'
import { SIDE_COLORS } from '../../utils/constants'
import BaseModal from '../common/BaseModal.vue'

const props = defineProps({
  gameId: { type: String, required: true },
  mission: { type: Object, required: true },
})

const emit = defineEmits(['close'])

const gamesStore = useGamesStore()
const missionsStore = useMissionsStore()
const squadConfig = useSquadConfig()

// Active side tab (index into mission.sides[])
const activeSide = ref(0)

const currentSide = computed(() => props.mission.sides[activeSide.value])

// Build a Set of currently active slot keys for O(1) lookup
const activeSlotKeys = computed(() => {
  const slots = gamesStore.getSlots(props.gameId)
  return new Set(slots.map(s => `${s.side}::${s.squad}::${s.number}`))
})

// Count active slots per side
function sideActiveCount(side) {
  const slots = gamesStore.getSlots(props.gameId)
  return slots.filter(s => s.side === side.name).length
}

// Count total slots in a side (from mission data)
function sideTotalCount(side) {
  return side.squads.reduce((sum, sq) => sum + sq.slots.length, 0)
}

function isSlotActive(sideName, squadName, slotIndex) {
  return activeSlotKeys.value.has(`${sideName}::${squadName}::${slotIndex + 1}`)
}

function toggle(sideName, squadName, slotIndex, roleName) {
  gamesStore.toggleSlot(props.gameId, {
    side: sideName,
    squad: squadName,
    number: slotIndex + 1,
    name: roleName,
  })
}

// Toggle entire squad at once
function toggleSquad(sideName, squad) {
  const allActive = squad.slots.every((_, i) => isSlotActive(sideName, squad.name, i))
  // If all active — remove all; otherwise — add missing
  squad.slots.forEach((roleName, i) => {
    const active = isSlotActive(sideName, squad.name, i)
    if (allActive && active) {
      toggle(sideName, squad.name, i, roleName)
    } else if (!allActive && !active) {
      toggle(sideName, squad.name, i, roleName)
    }
  })
}

function isSquadFullyActive(sideName, squad) {
  return squad.slots.every((_, i) => isSlotActive(sideName, squad.name, i))
}

function isSquadPartiallyActive(sideName, squad) {
  return squad.slots.some((_, i) => isSlotActive(sideName, squad.name, i)) && !isSquadFullyActive(sideName, squad)
}

// Select all / deselect all for current side
function selectAllCurrentSide() {
  const side = currentSide.value
  side.squads.forEach(squad => {
    squad.slots.forEach((roleName, i) => {
      if (!isSlotActive(side.name, squad.name, i)) {
        toggle(side.name, squad.name, i, roleName)
      }
    })
  })
}

function deselectAllCurrentSide() {
  const side = currentSide.value
  side.squads.forEach(squad => {
    squad.slots.forEach((roleName, i) => {
      if (isSlotActive(side.name, squad.name, i)) {
        toggle(side.name, squad.name, i, roleName)
      }
    })
  })
}

const currentSideAllActive = computed(() => {
  const side = currentSide.value
  return side.squads.every(sq => isSquadFullyActive(side.name, sq))
})
</script>

<template>
  <BaseModal title="Настроить слоты" wide @close="emit('close')">
    <!-- Side tabs: grouped when rotation data available -->
    <template v-if="missionsStore.getGroupedSides(mission, squadConfig.side)">
      <div class="mb-4 space-y-2">
        <div v-for="group in [
          { label: 'Союзники', sides: missionsStore.getGroupedSides(mission, squadConfig.side).ally },
          { label: 'Противники', sides: missionsStore.getGroupedSides(mission, squadConfig.side).enemy }
        ]" :key="group.label">
          <template v-if="group.sides.length">
            <div class="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 px-1">{{ group.label }}</div>
            <div class="flex gap-1 bg-neutral-800 rounded-lg p-1">
              <button v-for="side in group.sides" :key="side.name"
                @click="activeSide = mission.sides.indexOf(side)"
                :class="[
                  'flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2',
                  activeSide === mission.sides.indexOf(side)
                    ? [SIDE_COLORS[side.color]?.bg || 'bg-neutral-700', SIDE_COLORS[side.color]?.text || 'text-neutral-200', 'border', SIDE_COLORS[side.color]?.border || 'border-neutral-600']
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700/50'
                ]">
                <span :class="[SIDE_COLORS[side.color]?.dot || 'bg-neutral-500', 'w-2 h-2 rounded-full']"></span>
                {{ side.name }}
                <span class="text-[10px] font-mono opacity-60">{{ sideActiveCount(side) }}/{{ sideTotalCount(side) }}</span>
              </button>
            </div>
          </template>
        </div>
      </div>
    </template>
    <!-- Fallback: flat tabs -->
    <div v-else class="flex gap-1 mb-4 bg-neutral-800 rounded-lg p-1">
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
        <span class="text-[10px] font-mono opacity-60">{{ sideActiveCount(side) }}/{{ sideTotalCount(side) }}</span>
      </button>
    </div>

    <!-- Vehicles info -->
    <div v-if="currentSide.vehicles" class="mb-3 px-3 py-2 bg-neutral-800/50 rounded-lg border border-neutral-800">
      <div class="text-[10px] text-neutral-500 uppercase tracking-wider mb-0.5">Техника</div>
      <div class="text-xs text-neutral-300 leading-relaxed">{{ currentSide.vehicles }}</div>
    </div>

    <!-- Bulk actions -->
    <div class="flex items-center justify-between mb-3">
      <p class="text-xs text-neutral-500">
        Кликай на слот чтобы добавить/убрать. Данные назначений сохраняются.
      </p>
      <button
        @click="currentSideAllActive ? deselectAllCurrentSide() : selectAllCurrentSide()"
        class="text-xs px-2 py-1 rounded border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors shrink-0 ml-2">
        {{ currentSideAllActive ? 'Снять все' : 'Выбрать все' }}
      </button>
    </div>

    <!-- Squads and slots -->
    <div class="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
      <div v-for="squad in currentSide.squads" :key="squad.name"
        class="bg-neutral-800/50 rounded-lg overflow-hidden">
        <!-- Squad header (clickable to toggle whole squad) -->
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
            {{ squad.slots.filter((_, i) => isSlotActive(currentSide.name, squad.name, i)).length }}/{{ squad.slots.length }}
          </span>
        </button>

        <!-- Individual slots -->
        <div class="px-2 pb-2 pt-1 flex flex-wrap gap-1">
          <button v-for="(roleName, slotIdx) in squad.slots" :key="slotIdx"
            @click="toggle(currentSide.name, squad.name, slotIdx, roleName)"
            :class="[
              'px-2.5 py-1.5 rounded-md text-xs transition-all border',
              isSlotActive(currentSide.name, squad.name, slotIdx)
                ? 'bg-delta-green/15 border-delta-green/40 text-delta-green hover:bg-delta-green/25'
                : 'bg-neutral-800 border-neutral-700 text-neutral-500 hover:text-neutral-300 hover:border-neutral-500'
            ]">
            <span class="font-mono text-[10px] opacity-50 mr-1">{{ slotIdx + 1 }}</span>
            {{ roleName }}
          </button>
        </div>
      </div>
    </div>

    <!-- Footer stats -->
    <div class="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
      <div class="text-xs text-neutral-500">
        Выбрано: <span class="text-delta-green font-mono">{{ gamesStore.getSlots(gameId).length }}</span> слотов
      </div>
      <button @click="emit('close')"
        class="px-4 py-2 bg-delta-green hover:bg-delta-green/80 text-white text-sm font-medium rounded-lg transition-colors">
        Готово
      </button>
    </div>
  </BaseModal>
</template>
