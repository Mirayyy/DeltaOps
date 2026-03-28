<script setup>
import { useToast } from '../../composables/useToast'

const { toasts, remove } = useToast()

function typeClass(type) {
  const map = {
    success: 'bg-green-600/90 border-green-500',
    error: 'bg-red-600/90 border-red-500',
    warning: 'bg-amber-600/90 border-amber-500',
    info: 'bg-neutral-700/90 border-neutral-600',
  }
  return map[type] || map.info
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <TransitionGroup name="toast">
        <div v-for="toast in toasts" :key="toast.id"
          :class="[typeClass(toast.type), 'pointer-events-auto px-4 py-2.5 rounded-lg border text-sm text-white shadow-xl backdrop-blur max-w-sm cursor-pointer']"
          @click="remove(toast.id)">
          {{ toast.message }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active { transition: all 0.3s ease; }
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from { opacity: 0; transform: translateX(40px); }
.toast-leave-to { opacity: 0; transform: translateX(40px); }
</style>
