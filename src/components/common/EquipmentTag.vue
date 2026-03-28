<script setup>
import { EQUIPMENT_COLORS } from '../../utils/constants'

const props = defineProps({
  name: { type: String, required: true },
})

const colorClass = EQUIPMENT_COLORS[props.name] || 'bg-neutral-600'
</script>

<template>
  <span :class="[colorClass, 'text-xs px-2 py-0.5 rounded text-white font-medium']">
    {{ name }}
  </span>
</template>
