<script setup>
defineProps({
  text: { type: String, default: 'Загрузка...' },
})
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 gap-3">
    <div class="w-8 h-8 border-2 border-neutral-700 border-t-delta-green rounded-full animate-spin"></div>
    <span class="text-sm text-neutral-500">{{ text }}</span>
  </div>
</template>
