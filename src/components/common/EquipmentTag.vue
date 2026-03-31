<script setup>
import { computed } from 'vue'
import { useSquadConfig } from '../../stores/squadConfig'

const props = defineProps({
  name: { type: String, required: true },
})

const squad = useSquadConfig()
const colorClass = computed(() => squad.equipmentColorMap[props.name] || 'bg-neutral-600')
</script>

<template>
  <span :class="[colorClass, 'text-xs px-2 py-0.5 rounded text-white font-medium']">
    {{ name }}
  </span>
</template>
