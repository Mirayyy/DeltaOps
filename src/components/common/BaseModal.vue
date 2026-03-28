<script setup>
defineProps({
  title: { type: String, default: '' },
  wide: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" @click.self="emit('close')">
      <div class="fixed inset-0 bg-black/60" @click="emit('close')"></div>
      <div
        :class="[
          'relative bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full my-auto max-h-[calc(100vh-2rem)] flex flex-col',
          wide ? 'max-w-2xl' : 'max-w-md'
        ]"
      >
        <div v-if="title" class="flex items-center justify-between px-5 py-4 border-b border-neutral-800 shrink-0">
          <h3 class="text-lg font-semibold">{{ title }}</h3>
          <button @click="emit('close')" class="text-neutral-500 hover:text-neutral-300 text-xl leading-none">&times;</button>
        </div>
        <div class="p-5 overflow-y-auto">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
