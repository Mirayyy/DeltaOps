<script setup>
import { computed } from 'vue'
import { READINESS_STATUSES } from '../../utils/constants'

const props = defineProps({
  gameId: { type: String, required: true },
  gameLabel: { type: String, required: true },
  gameDate: { type: String, default: '' },
  currentStatus: { type: String, default: 'no_response' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['change'])

const buttons = [
  { status: 'confirmed', label: 'Буду', shortLabel: 'Буду', color: 'bg-status-confirmed', hoverColor: 'hover:bg-status-confirmed/80' },
  { status: 'tentative', label: 'Возможно', shortLabel: 'Возм.', color: 'bg-status-tentative', hoverColor: 'hover:bg-status-tentative/80' },
  { status: 'absent', label: 'Не буду', shortLabel: 'Не буду', color: 'bg-status-absent', hoverColor: 'hover:bg-status-absent/80' },
]

const cardClass = computed(() => {
  const base = 'rounded-xl p-2 md:p-3 flex flex-col transition-colors duration-200 border'
  switch (props.currentStatus) {
    case 'confirmed': return base + ' bg-green-500/8 border-green-500/25'
    case 'tentative': return base + ' bg-yellow-500/8 border-yellow-500/25'
    case 'absent': return base + ' bg-red-500/8 border-red-500/25'
    default: return base + ' bg-neutral-800 border-neutral-800'
  }
})
</script>

<template>
  <div :class="cardClass">
    <div class="flex items-center justify-between mb-1.5 md:mb-2">
      <div>
        <div class="text-[10px] md:text-sm font-medium">{{ gameLabel }}</div>
        <div class="text-[9px] md:text-xs text-neutral-500">{{ gameDate }}</div>
      </div>
      <span
        :class="[
          READINESS_STATUSES[currentStatus]?.color || 'bg-neutral-600',
          'w-2 h-2 md:w-3 md:h-3 rounded-full'
        ]"
      ></span>
    </div>

    <div class="flex gap-1 md:gap-1.5">
      <button
        v-for="btn in buttons"
        :key="btn.status"
        @click="!disabled && emit('change', gameId, btn.status)"
        :disabled="disabled"
        :class="[
          'flex-1 py-1.5 text-[11px] md:text-xs font-medium rounded-lg transition-all text-center',
          currentStatus === btn.status
            ? btn.color + ' text-white shadow-lg scale-[1.02]'
            : 'bg-neutral-700/60 text-neutral-400 ' + btn.hoverColor + ' hover:text-white',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        ]"
      >
        <span class="hidden md:inline">{{ btn.label }}</span>
        <span class="md:hidden">{{ btn.shortLabel }}</span>
      </button>
    </div>
  </div>
</template>
