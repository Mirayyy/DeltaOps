<script setup>
import { computed } from 'vue'
import BaseModal from './BaseModal.vue'

const props = defineProps({
  title: { type: String, default: 'Подтверждение действия' },
  message: { type: String, default: '' },
  details: { type: Array, default: () => [] },
  confirmLabel: { type: String, default: 'Подтвердить' },
  cancelLabel: { type: String, default: 'Отмена' },
  tone: { type: String, default: 'danger' },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'close'])

const confirmClass = computed(() => {
  if (props.tone === 'warning') {
    return 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
  }
  if (props.tone === 'neutral') {
    return 'bg-neutral-700 hover:bg-neutral-600 text-white'
  }
  return 'bg-red-600 hover:bg-red-500 text-white'
})
</script>

<template>
  <BaseModal :title="title" @close="emit('close')">
    <div class="space-y-4">
      <p v-if="message" class="text-sm leading-6 text-neutral-300">
        {{ message }}
      </p>

      <div v-if="details.length" class="rounded-xl border border-neutral-800 bg-neutral-950/70 px-4 py-3">
        <div
          v-for="detail in details"
          :key="detail"
          class="text-xs leading-5 text-neutral-400"
        >
          {{ detail }}
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-1">
        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          @click="emit('confirm')"
          :disabled="busy"
          :class="[
            'rounded-lg px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60',
            confirmClass,
          ]"
        >
          {{ busy ? '...' : confirmLabel }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>
