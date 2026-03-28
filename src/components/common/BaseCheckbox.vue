<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  checked: { type: [Boolean, null], default: null },
  disabled: { type: Boolean, default: false },
  label: { type: String, default: '' },
  size: { type: String, default: 'md' }, // 'sm' | 'md'
})

const emit = defineEmits(['update:modelValue', 'change'])

// Support both v-model and :checked/@change patterns
// checked=null means "use modelValue" (v-model mode)
const isChecked = computed(() =>
  props.checked !== null ? props.checked : props.modelValue
)

function toggle() {
  if (props.disabled) return
  const next = !isChecked.value
  emit('update:modelValue', next)
  emit('change', next)
}

const boxSize = computed(() =>
  props.size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
)
</script>

<template>
  <div
    :class="[
      'inline-flex items-center gap-1.5 cursor-pointer select-none',
      disabled ? 'opacity-40 !cursor-not-allowed' : '',
    ]"
    role="checkbox"
    :aria-checked="isChecked"
    @click.stop="toggle"
  >
    <!-- Box -->
    <span
      :class="[
        'relative shrink-0 rounded border transition-all duration-100',
        boxSize,
        isChecked
          ? 'bg-orange-500 border-orange-500'
          : 'bg-[#1a1a1a] border-[#444] hover:border-[#666]',
      ]"
    >
      <svg v-if="isChecked" class="absolute inset-0 w-full h-full p-[2px] text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.5 8.5L6.5 11.5L12.5 4.5" />
      </svg>
    </span>

    <!-- Label -->
    <span v-if="label || $slots.default" class="text-neutral-400">
      <slot>{{ label }}</slot>
    </span>
  </div>
</template>
