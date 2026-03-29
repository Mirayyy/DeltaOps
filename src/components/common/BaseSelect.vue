<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

const props = defineProps({
  modelValue: { default: null },
  options: { type: Array, required: true },
  // options: [{ value, label }] or ['string', ...]
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'md' }, // 'sm' | 'md'
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const root = ref(null)
const listRef = ref(null)
const dropUp = ref(false)
const dropStyle = ref({})

// Normalize options to { value, label }
const normalizedOptions = computed(() =>
  props.options.map(o =>
    typeof o === 'object' && o !== null
      ? { value: o.value, label: o.label ?? String(o.value) }
      : { value: o, label: String(o) }
  )
)

const selectedLabel = computed(() => {
  const found = normalizedOptions.value.find(o => o.value === props.modelValue)
  return found ? found.label : props.placeholder || '—'
})

const isPlaceholder = computed(() => {
  return !normalizedOptions.value.some(o => o.value === props.modelValue)
})

function updatePosition() {
  const rect = root.value?.getBoundingClientRect()
  if (!rect) return

  const spaceBelow = window.innerHeight - rect.bottom
  dropUp.value = spaceBelow < 220 && rect.top > spaceBelow

  dropStyle.value = {
    position: 'fixed',
    left: `${rect.left}px`,
    minWidth: `${rect.width}px`,
    maxWidth: `${window.innerWidth - rect.left - 16}px`,
    ...(dropUp.value
      ? { bottom: `${window.innerHeight - rect.top + 4}px` }
      : { top: `${rect.bottom + 4}px` }
    ),
  }
}

function toggle() {
  if (props.disabled) return
  if (!open.value) {
    updatePosition()
  }
  open.value = !open.value
}

function select(val) {
  emit('update:modelValue', val)
  open.value = false
}

function onClickOutside(e) {
  if (root.value && !root.value.contains(e.target) &&
      listRef.value && !listRef.value.contains(e.target)) {
    open.value = false
  }
}

function onScroll() {
  if (open.value) updatePosition()
}

// Scroll active option into view when opening
watch(open, async (val) => {
  if (val) {
    await nextTick()
    const active = listRef.value?.querySelector('[data-active="true"]')
    if (active) active.scrollIntoView({ block: 'nearest' })
  }
})

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  window.addEventListener('scroll', onScroll, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside)
  window.removeEventListener('scroll', onScroll, true)
})

const sizeClasses = computed(() => {
  if (props.size === 'sm') return { trigger: 'px-2 py-1 text-xs', item: 'px-2.5 py-1.5 text-xs' }
  return { trigger: 'px-3 py-2 text-sm', item: 'px-3 py-2 text-sm' }
})
</script>

<template>
  <div ref="root" class="relative" :class="disabled ? 'opacity-50 pointer-events-none' : ''">
    <!-- Trigger -->
    <button
      type="button"
      @click="toggle"
      :class="[
        'flex items-center justify-between gap-2 w-full rounded-lg border transition-colors text-left',
        sizeClasses.trigger,
        open
          ? 'bg-[#1a1a1a] border-orange-500/60'
          : 'bg-[#1a1a1a] border-[#2e2e2e] hover:border-[#444]',
      ]"
    >
      <span :class="isPlaceholder ? 'text-neutral-500' : 'text-neutral-200'" class="truncate">
        {{ selectedLabel }}
      </span>
      <svg :class="['w-3 h-3 text-neutral-500 shrink-0 transition-transform duration-150', open ? 'rotate-180' : '']"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown (fixed to viewport, escapes overflow:hidden) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="opacity-0 scale-[0.97]"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-[0.97]"
      >
        <div v-if="open" ref="listRef"
          :style="dropStyle"
          class="z-[9999] max-h-52 overflow-y-auto rounded-lg border border-[#333] bg-[#191919] shadow-xl shadow-black/50 py-1 w-max"
        >
          <button
            v-for="opt in normalizedOptions"
            :key="opt.value"
            type="button"
            :data-active="opt.value === modelValue"
            @click="select(opt.value)"
            :class="[
              'w-full text-left transition-colors cursor-pointer whitespace-nowrap',
              sizeClasses.item,
              opt.value === modelValue
                ? 'bg-orange-500/15 text-orange-400'
                : 'text-neutral-300 hover:bg-[#252525] hover:text-white',
            ]"
          >
            {{ opt.label }}
          </button>
          <div v-if="!normalizedOptions.length" class="px-3 py-2 text-xs text-neutral-500">Нет вариантов</div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
