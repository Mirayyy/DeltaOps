<script setup>
import { computed } from 'vue'
import { PLAYER_STATUSES } from '../../utils/constants'

const props = defineProps({
  status: { type: String, required: true },
  size: { type: String, default: 'sm' },
})

const config = computed(() => PLAYER_STATUSES[props.status] || { label: props.status, color: 'bg-neutral-600' })
</script>

<template>
  <span
    :class="[
      config.color,
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1',
      'rounded-full text-white font-medium inline-block'
    ]"
  >
    {{ config.label }}
  </span>
</template>
