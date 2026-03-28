import { ref } from 'vue'

const toasts = ref([])
let nextId = 0

export function useToast() {
  function show(message, type = 'info', duration = 3000) {
    const id = nextId++
    toasts.value.push({ id, message, type })
    if (duration > 0) {
      setTimeout(() => remove(id), duration)
    }
  }

  function success(message, duration) { show(message, 'success', duration) }
  function error(message, duration) { show(message, 'error', duration || 5000) }
  function warning(message, duration) { show(message, 'warning', duration || 4000) }
  function info(message, duration) { show(message, 'info', duration) }

  function remove(id) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return { toasts, show, success, error, warning, info, remove }
}
