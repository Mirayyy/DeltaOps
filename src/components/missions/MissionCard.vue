<script setup>
import { computed } from 'vue'
import { SIDE_COLORS } from '../../utils/constants'

const props = defineProps({
  mission: { type: Object, default: null },
  gameLabel: { type: String, default: '' },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])

const stats = computed(() => {
  if (!props.mission) return null
  const m = props.mission
  const totalPlayers = m.sides.reduce((sum, s) => sum + (s.players || 0), 0)
  const totalSquads = m.sides.reduce((sum, s) => sum + (s.squads?.length || 0), 0)
  return { totalPlayers, totalSquads }
})

function sideColor(color) {
  return SIDE_COLORS[color] || SIDE_COLORS.blue
}
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
    class="group bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-700 transition-all cursor-pointer">

    <!-- Top bar with side colors -->
    <div class="flex h-1">
      <div v-for="side in mission.sides" :key="side.name"
        :class="[sideColor(side.color).dot, 'flex-1']"
        :style="{ flex: side.players }">
      </div>
    </div>

    <div class="p-4">
      <!-- Header -->
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="min-w-0">
          <div class="text-[10px] tracking-wider uppercase text-neutral-500 mb-0.5">{{ gameLabel }}</div>
          <h3 class="text-sm font-bold text-white truncate group-hover:text-delta-green transition-colors">
            {{ mission.title }}
          </h3>
        </div>
        <div class="shrink-0 text-[10px] px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-500 font-mono">
          v{{ mission.version }}
        </div>
      </div>

      <!-- Map + type -->
      <div class="flex items-center gap-2 mb-3 text-xs text-neutral-400">
        <span class="flex items-center gap-1">
          <svg class="w-3 h-3 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          {{ mission.map }}
        </span>
        <span class="text-neutral-700">|</span>
        <span>{{ stats.totalPlayers }} игроков</span>
      </div>

      <!-- Sides -->
      <div class="space-y-1.5">
        <div v-for="side in mission.sides" :key="side.name"
          class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-1.5">
            <span :class="[sideColor(side.color).dot, 'w-2 h-2 rounded-full shrink-0']"></span>
            <span :class="sideColor(side.color).text">{{ side.name }}</span>
            <span v-if="side.role && side.role !== 'Неопределено'" class="text-neutral-600">({{ side.role }})</span>
          </div>
          <span class="font-mono text-neutral-500">{{ side.players }}</span>
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
      <div v-if="!compact && mission.description" class="mt-2 text-[11px] text-neutral-500 line-clamp-2 leading-relaxed">
        {{ mission.description }}
      </div>
    </div>
  </div>
</template>
