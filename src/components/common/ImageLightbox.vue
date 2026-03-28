<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  images: { type: Array, required: true },
  startIndex: { type: Number, default: 0 },
})

const emit = defineEmits(['close'])

const index = ref(props.startIndex)
const containerEl = ref(null)

watch(() => props.startIndex, (v) => { index.value = v })

// Auto-focus for keyboard nav
watch(containerEl, (el) => {
  if (el) nextTick(() => el.focus())
}, { immediate: true })

function prev() {
  index.value = (index.value - 1 + props.images.length) % props.images.length
}

function next() {
  index.value = (index.value + 1) % props.images.length
}

function onKey(e) {
  if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'ArrowRight') next()
  else if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      ref="containerEl"
      class="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      @click.self="emit('close')"
      @keydown="onKey"
      tabindex="0">

      <!-- Close -->
      <button @click="emit('close')"
        class="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10">
        <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Counter -->
      <div class="absolute top-4 left-4 text-white/40 text-sm font-mono z-10">
        {{ index + 1 }} / {{ images.length }}
      </div>

      <!-- Prev -->
      <button v-if="images.length > 1" @click="prev"
        class="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors z-10">
        <svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <!-- Image -->
      <img :src="images[index]"
        :alt="`Image ${index + 1}`"
        class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />

      <!-- Next -->
      <button v-if="images.length > 1" @click="next"
        class="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors z-10">
        <svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  </Teleport>
</template>
