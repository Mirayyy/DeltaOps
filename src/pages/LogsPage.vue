<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import BaseSelect from '../components/common/BaseSelect.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'
import { useAuditLogsStore } from '../stores/auditLogs'

const auditLogs = useAuditLogsStore()

const actionFilter = ref('all')
const entityFilter = ref('all')

const actionOptions = computed(() => {
  const values = [...new Set(auditLogs.logs.map(log => log.action).filter(Boolean))].sort()
  return [
    { value: 'all', label: 'Все действия' },
    ...values.map(value => ({ value, label: value })),
  ]
})

const entityOptions = computed(() => {
  const values = [...new Set(auditLogs.logs.map(log => log.entityType).filter(Boolean))].sort()
  return [
    { value: 'all', label: 'Все сущности' },
    ...values.map(value => ({ value, label: value })),
  ]
})

const filteredLogs = computed(() => {
  return auditLogs.logs.filter((log) => {
    if (actionFilter.value !== 'all' && log.action !== actionFilter.value) return false
    if (entityFilter.value !== 'all' && log.entityType !== entityFilter.value) return false
    return true
  })
})

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatActor(actor) {
  if (!actor) return '—'
  return actor.displayName || actor.email || actor.uid || '—'
}

function prettyDetails(details) {
  if (!details) return ''
  return JSON.stringify(details, null, 2)
}

onMounted(async () => {
  await auditLogs.fetchLogs()
})

onUnmounted(() => {
  auditLogs.cleanup()
})
</script>

<template>
  <div class="pb-20 md:pb-0 max-w-6xl mx-auto">
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold">Логи</h1>
        <p class="text-sm text-neutral-500">Создание, редактирование и удаление с автором действий</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full sm:w-[28rem]">
        <BaseSelect v-model="actionFilter" :options="actionOptions" size="sm" />
        <BaseSelect v-model="entityFilter" :options="entityOptions" size="sm" />
      </div>
    </div>

    <LoadingSpinner v-if="auditLogs.loading" />

    <template v-else>
      <div v-if="!filteredLogs.length" class="bg-neutral-900 rounded-xl border border-neutral-800 p-6 text-sm text-neutral-500">
        Логи пока пустые
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="log in filteredLogs"
          :key="log.id"
          class="bg-neutral-900 rounded-xl border border-neutral-800 p-4"
        >
          <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2 mb-1">
                <span class="text-sm font-semibold text-white">{{ log.summary || log.action }}</span>
                <span class="text-[10px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-400 uppercase tracking-wide">
                  {{ log.entityType || 'system' }}
                </span>
                <span class="text-[10px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-500">
                  {{ log.action }}
                </span>
              </div>

              <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                <span>Автор: <span class="text-neutral-300">{{ formatActor(log.actor) }}</span></span>
                <span v-if="log.actor?.email">{{ log.actor.email }}</span>
                <span>Время: <span class="text-neutral-300">{{ formatDate(log.createdAtIso) }}</span></span>
                <span v-if="log.entityId">ID: <span class="text-neutral-300">{{ log.entityId }}</span></span>
              </div>
            </div>
          </div>

          <details v-if="log.details" class="mt-3">
            <summary class="text-xs text-neutral-500 cursor-pointer hover:text-neutral-300 transition-colors">
              Детали
            </summary>
            <pre class="mt-2 p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-[11px] text-neutral-400 overflow-x-auto whitespace-pre-wrap">{{ prettyDetails(log.details) }}</pre>
          </details>
        </div>
      </div>
    </template>
  </div>
</template>
