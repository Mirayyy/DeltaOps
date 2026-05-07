<script setup>
import { computed } from 'vue'
import { useSquadConfig } from '../../stores/squadConfig'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: String, default: 'sm' },
})

const squad = useSquadConfig()
const colorClass = computed(() => squad.equipmentColorMap[props.name] || 'bg-neutral-600')
const sizeClass = computed(() => {
  if (props.size === 'md') return 'text-[13px] px-2.5 py-1 font-semibold'
  return 'text-xs px-2 py-0.5 font-medium'
})
</script>

<template>
  <span :class="[colorClass, sizeClass, 'rounded text-white break-all shadow-sm']">
    {{ name }}
  </span>
</template>
