<script setup>
import { computed } from 'vue'
import { SIDE_COLORS } from '../../utils/constants'
import { useMissionsStore } from '../../stores/missions'
import { useSquadConfig } from '../../stores/squadConfig'

const props = defineProps({
  mission: { type: Object, default: null },
  gameLabel: { type: String, default: '' },
  compact: { type: Boolean, default: false },
  lineupStatus: { type: Object, default: null },
})

const emit = defineEmits(['click'])

const stats = computed(() => {
  if (!props.mission) return null
  const m = props.mission
  const totalPlayers = m.sides.reduce((sum, s) => sum + (s.players || 0), 0)
  const totalSquads = m.sides.reduce((sum, s) => sum + (s.squads?.length || 0), 0)
  return { totalPlayers, totalSquads }
})

const missionsStore = useMissionsStore()
const squadConfig = useSquadConfig()

function sideColor(color) {
  return SIDE_COLORS[color] || SIDE_COLORS.blue
}

const groupedSides = computed(() => missionsStore.getGroupedSides(props.mission, squadConfig.side))
const hasCommandHighlight = computed(() => Boolean(props.lineupStatus?.hasSideCommanderSlot))
</script>

<template>
  <!-- Empty state -->
  <div v-if="!mission"
    class="bg-neutral-900/60 border border-neutral-800/50 border-dashed rounded-xl p-4 flex flex-col items-center justify-center min-h-[120px]">
    <div class="text-neutral-700 text-xs mb-1">{{ gameLabel }}</div>
    <div class="text-neutral-600 text-[11px]">Миссия не загружена</div>
  </div>

  <!-- Mission card -->
  <div v-else
    @click="emit('click', mission)"
    :class="[
      'group flex h-full flex-col bg-neutral-900 border rounded-xl overflow-hidden transition-all cursor-pointer',
      hasCommandHighlight
        ? 'border-amber-500/50 shadow-[0_0_0_1px_rgba(245,158,11,0.2),0_0_28px_rgba(245,158,11,0.12)] hover:border-amber-400/70'
        : 'border-neutral-800 hover:border-neutral-700'
    ]">

    <!-- Top bar with side colors -->
    <div class="flex h-1">
      <div v-for="side in mission.sides" :key="side.name"
        :class="[sideColor(side.color).dot, 'flex-1']"
        :style="{ flex: side.players }">
      </div>
    </div>

      <div class="flex min-h-0 flex-1 flex-col p-4 min-w-0">
      <!-- Header -->
      <div class="flex items-start justify-between gap-2 mb-2 min-w-0">
        <div class="min-w-0 flex-1">
          <div class="text-[10px] tracking-wider uppercase text-neutral-500 mb-0.5">{{ gameLabel }}</div>
          <h3 class="text-base font-bold text-white break-words leading-tight group-hover:text-delta-green transition-colors">
            {{ mission.title }}
          </h3>
        </div>
        <div class="shrink-0 text-[10px] px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-500 font-mono">
          v{{ mission.version }}
        </div>
      </div>

      <!-- Map + type -->
      <div class="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400 min-w-0">
        <span class="flex items-center gap-1">
          <svg class="w-3 h-3 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          {{ mission.map }}
        </span>
        <span class="text-neutral-700">|</span>
        <span>{{ stats.totalPlayers }} игроков</span>
      </div>

      <!-- Sides: grouped by ally/enemy when rotation data available -->
      <div v-if="groupedSides" class="space-y-2">
        <div v-if="groupedSides.ally.length">
          <div class="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Союзники</div>
          <div v-for="side in groupedSides.ally" :key="side.name"
            class="flex items-center justify-between text-xs">
            <div class="min-w-0 flex flex-1 items-center gap-1.5">
              <span :class="[sideColor(side.color).dot, 'w-2 h-2 rounded-full shrink-0']"></span>
              <span :class="[sideColor(side.color).text, 'shrink-0']">{{ side.name }}</span>
              <span v-if="missionsStore.getSideFaction(mission, side.color)" class="min-w-0 break-words text-neutral-500">{{ missionsStore.getSideFaction(mission, side.color) }}</span>
              <span v-if="side.role && side.role !== 'Неопределено'" class="shrink-0 text-neutral-600">({{ side.role }})</span>
            </div>
            <span class="shrink-0 pl-2 font-mono text-neutral-500">{{ side.players }}</span>
          </div>
        </div>
        <div v-if="groupedSides.enemy.length">
          <div class="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Противники</div>
          <div v-for="side in groupedSides.enemy" :key="side.name"
            class="flex items-center justify-between text-xs">
            <div class="min-w-0 flex flex-1 items-center gap-1.5">
              <span :class="[sideColor(side.color).dot, 'w-2 h-2 rounded-full shrink-0']"></span>
              <span :class="[sideColor(side.color).text, 'shrink-0']">{{ side.name }}</span>
              <span v-if="missionsStore.getSideFaction(mission, side.color)" class="min-w-0 break-words text-neutral-500">{{ missionsStore.getSideFaction(mission, side.color) }}</span>
              <span v-if="side.role && side.role !== 'Неопределено'" class="shrink-0 text-neutral-600">({{ side.role }})</span>
            </div>
            <span class="shrink-0 pl-2 font-mono text-neutral-500">{{ side.players }}</span>
          </div>
        </div>
      </div>
      <!-- Fallback: flat list when no rotation data -->
      <div v-else class="space-y-1.5">
        <div v-for="side in mission.sides" :key="side.name"
          class="flex items-center justify-between text-xs">
          <div class="min-w-0 flex flex-1 items-center gap-1.5">
            <span :class="[sideColor(side.color).dot, 'w-2 h-2 rounded-full shrink-0']"></span>
            <span :class="[sideColor(side.color).text, 'shrink-0']">{{ side.name }}</span>
            <span v-if="missionsStore.getSideFaction(mission, side.color)" class="min-w-0 break-words text-neutral-500">{{ missionsStore.getSideFaction(mission, side.color) }}</span>
            <span v-if="side.role && side.role !== 'Неопределено'" class="shrink-0 text-neutral-600">({{ side.role }})</span>
          </div>
          <span class="shrink-0 pl-2 font-mono text-neutral-500">{{ side.players }}</span>
        </div>
      </div>

      <!-- Vehicles preview (compact) -->
      <div v-if="!compact && mission.sides.some(s => s.vehicles)" class="mt-3 pt-3 border-t border-neutral-800/50">
        <div class="flex items-center gap-1 text-[10px] text-neutral-600">
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span>Техника задействована</span>
        </div>
      </div>

      <!-- Description (compact omits) -->
      <div v-if="!compact && mission.description" class="mt-2 text-xs text-neutral-500 line-clamp-3 leading-relaxed break-words">
        {{ mission.description }}
      </div>

      <div v-if="!compact && lineupStatus" class="mt-auto pt-3 border-t border-neutral-800/50 space-y-2">
        <div class="text-[11px] font-medium" :class="lineupStatus.configured ? 'text-delta-green' : 'text-neutral-500'">
          {{ lineupStatus.configured ? 'Расстановка настроена' : 'Расстановка пуста' }}
        </div>
        <div class="flex flex-wrap gap-2 text-[11px]">
          <div class="min-w-[5.5rem] flex-1 rounded-lg border border-neutral-800 bg-neutral-950/60 px-2.5 py-2">
            <div class="text-[10px] uppercase tracking-wider text-neutral-600">Слотов</div>
            <div class="mt-1 font-mono text-lg leading-none text-neutral-200">{{ lineupStatus.totalSlots }}</div>
          </div>
          <div class="min-w-[5.5rem] flex-1 rounded-lg border border-neutral-800 bg-neutral-950/60 px-2.5 py-2">
            <div class="text-[10px] uppercase tracking-wider text-neutral-600">Резерв</div>
            <div class="mt-1 font-mono text-lg leading-none text-amber-300">{{ lineupStatus.reserveSlots }}</div>
          </div>
          <div class="min-w-[5.5rem] flex-1 rounded-lg border border-neutral-800 bg-neutral-950/60 px-2.5 py-2">
            <div class="text-[10px] uppercase tracking-wider text-neutral-600">Назначено</div>
            <div class="mt-1 font-mono text-lg leading-none text-delta-green">{{ lineupStatus.assignedSlots }}</div>
          </div>
          <div class="min-w-[5.5rem] flex-1 rounded-lg border border-neutral-800 bg-neutral-950/60 px-2.5 py-2">
            <div class="text-[10px] uppercase tracking-wider text-neutral-600">Свободно</div>
            <div class="mt-1 font-mono text-lg leading-none text-neutral-200">{{ lineupStatus.freeSlots }}</div>
          </div>
        </div>
        <div class="rounded-lg border border-neutral-800 bg-neutral-950/60 px-2.5 py-2 text-[11px]">
          <div class="text-[10px] uppercase tracking-wider text-neutral-600">Не расставлено</div>
          <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="inline-flex items-center gap-1.5 text-status-confirmed">
              <span class="h-2 w-2 rounded-full bg-status-confirmed"></span>
              <span class="font-mono">{{ lineupStatus.unassignedConfirmed }}</span>
              <span class="text-neutral-400">Буду</span>
            </span>
            <span class="inline-flex items-center gap-1.5 text-status-tentative">
              <span class="h-2 w-2 rounded-full bg-status-tentative"></span>
              <span class="font-mono">{{ lineupStatus.unassignedTentative }}</span>
              <span class="text-neutral-400">Возможно</span>
            </span>
          </div>
        </div>
        <div
          :class="[
            'inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-[11px]',
            lineupStatus.slotRequests > 0
              ? 'border border-red-500/30 bg-red-500/10 text-red-200'
              : 'border border-neutral-800 bg-neutral-950/60 text-neutral-500'
          ]"
        >
          Запросы слотов:
          <span :class="lineupStatus.slotRequests > 0 ? 'font-mono text-red-300' : 'font-mono text-neutral-300'">
            {{ lineupStatus.slotRequests }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
