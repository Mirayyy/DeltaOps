<script setup>
import { computed } from 'vue'
import { READINESS_STATUSES } from '../../utils/constants'

const props = defineProps({
  gameId: { type: String, required: true },
  gameLabel: { type: String, required: true },
  gameDate: { type: String, default: '' },
  currentStatus: { type: String, default: 'no_response' },
  disabled: { type: Boolean, default: false },
  slotInfo: { type: Object, default: null },
})

const emit = defineEmits(['change'])

const buttons = [
  { status: 'confirmed', label: 'Буду', color: 'bg-status-confirmed', hoverColor: 'hover:bg-status-confirmed/80' },
  { status: 'tentative', label: 'Возможно', color: 'bg-status-tentative', hoverColor: 'hover:bg-status-tentative/80' },
  { status: 'absent', label: 'Не буду', color: 'bg-status-absent', hoverColor: 'hover:bg-status-absent/80' },
]

const cardClass = computed(() => {
  const base = 'rounded-xl p-4 flex flex-col transition-colors duration-200 border'
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
    <!-- Game header -->
    <div class="flex items-center justify-between mb-3">
      <div>
        <div class="text-sm font-medium">{{ gameLabel }}</div>
        <div class="text-xs text-neutral-500">{{ gameDate }}</div>
      </div>
      <span
        :class="[
          READINESS_STATUSES[currentStatus]?.color || 'bg-neutral-600',
          'w-3 h-3 rounded-full'
        ]"
      ></span>
    </div>

    <!-- Status buttons -->
    <div class="flex gap-1.5 mb-2">
      <button
        v-for="btn in buttons"
        :key="btn.status"
        @click="!disabled && emit('change', gameId, btn.status)"
        :disabled="disabled"
        :class="[
          'flex-1 py-1.5 text-xs font-medium rounded-lg transition-all',
          currentStatus === btn.status
            ? btn.color + ' text-white shadow-lg scale-[1.02]'
            : 'bg-neutral-700/60 text-neutral-400 ' + btn.hoverColor + ' hover:text-white',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        ]"
      >
        {{ btn.label }}
      </button>
    </div>

    <!-- Assigned slot info -->
    <div v-if="slotInfo" class="mt-auto pt-2 border-t border-neutral-700/50">
      <div class="text-xs text-neutral-400">
        <span class="text-neutral-300 font-medium">{{ slotInfo.section }}</span>
        {{ slotInfo.roleName }}
      </div>
      <div v-if="slotInfo.equipment?.length" class="flex flex-wrap gap-1 mt-1">
        <span v-for="eq in slotInfo.equipment" :key="eq"
          class="text-[10px] px-1.5 py-0.5 bg-neutral-700 rounded text-neutral-300">
          {{ eq }}
        </span>
      </div>
    </div>
  </div>
</template>
