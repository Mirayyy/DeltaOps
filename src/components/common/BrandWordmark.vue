<script setup>
import { computed } from 'vue'
import { useSquadConfig } from '../../stores/squadConfig'
import { useAppConfig } from '../../stores/appConfig'

const props = defineProps({
  variant: {
    type: String,
    default: 'header',
  },
  centered: {
    type: Boolean,
    default: false,
  },
})

const squad = useSquadConfig()
const app = useAppConfig()

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const primaryLabel = computed(() => {
  const primary = String(squad.tag || squad.name || '').trim()
  if (primary) return primary.toUpperCase()

  const fallback = String(app.siteName || '').trim()
  return fallback ? fallback.toUpperCase() : ''
})

const secondaryLabel = computed(() => {
  const siteName = String(app.siteName || '').trim()
  const primary = primaryLabel.value

  if (!siteName || !primary) return ''

  const withoutPrefix = siteName
    .replace(new RegExp(`^${escapeRegExp(primary)}(?:[\\s._-]*)`, 'i'), '')
    .trim()

  if (!withoutPrefix) return ''

  return withoutPrefix
    .replace(/^[^A-Za-zА-Яа-я0-9]+/, '')
    .trim()
    .toUpperCase()
})

const wrapperClass = computed(() => {
  const align = props.centered ? 'justify-center text-center' : 'justify-start text-left'

  if (props.variant === 'hero') {
    return `flex flex-wrap items-end gap-x-2 gap-y-1 ${align}`
  }

  if (props.variant === 'footer') {
    return `flex flex-wrap items-end gap-x-2 gap-y-0.5 ${align}`
  }

  return `flex flex-wrap items-end gap-x-2 gap-y-0.5 ${align}`
})

const primaryClass = computed(() => {
  if (props.variant === 'hero') {
    return 'text-5xl md:text-7xl font-black tracking-[0.08em] text-white leading-none'
  }

  if (props.variant === 'footer') {
    return 'text-sm md:text-base font-black tracking-[0.08em] text-white leading-none'
  }

  return 'text-lg md:text-xl font-black tracking-[0.08em] text-white leading-none'
})

const secondaryClass = computed(() => {
  if (props.variant === 'hero') {
    return 'pb-1 md:pb-1.5 text-sm md:text-xl font-light tracking-[0.16em] text-neutral-500 leading-none'
  }

  if (props.variant === 'footer') {
    return 'pb-0.5 text-[9px] md:text-[10px] font-light tracking-[0.12em] text-neutral-500 leading-none'
  }

  return 'pb-0.5 text-[10px] md:text-xs font-light tracking-[0.14em] text-neutral-500 leading-none'
})
</script>

<template>
  <div :class="wrapperClass">
    <span :class="primaryClass">{{ primaryLabel }}</span>
    <span v-if="secondaryLabel" :class="secondaryClass">{{ secondaryLabel }}</span>
  </div>
</template>
