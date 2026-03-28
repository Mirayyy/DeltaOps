<script setup>
import { SKILL_LEVELS } from '../../utils/constants'

const props = defineProps({
  role: { type: String, required: true },
  level: { type: String, required: true },
})

const config = SKILL_LEVELS[props.level] || SKILL_LEVELS.beginner
</script>

<template>
  <span
    :class="[config.color, 'text-xs px-2 py-0.5 rounded-full text-white inline-flex items-center gap-1']"
  >
    {{ role }}
  </span>
</template>
