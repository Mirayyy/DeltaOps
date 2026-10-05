<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import BaseSelect from '../components/common/BaseSelect.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'
import { useAuditLogsStore } from '../stores/auditLogs'
import { useRosterStore } from '../stores/roster'
import { describeAuditLog, ENTITY_LABELS } from '../utils/auditFormat.js'

const auditLogs = useAuditLogsStore()
const roster = useRosterStore()
const search = ref('')
const entityFilter = ref('all')
const eventFilter = ref('all')
const actorFilter = ref('all')
const outcomeFilter = ref('all')
const dateFrom = ref('')
const dateTo = ref('')
const operationFilter = ref('')
const rosterError = ref(false)
const rows = computed(() => auditLogs.logs.map(log => describeAuditLog(log, roster.players)))
const entityOptions = computed(() => [
  { value: 'all', label: 'Все разделы' },
  ...[...new Set(auditLogs.logs.map(log => log.entityType).filter(Boolean))]
    .map(value => ({ value, label: ENTITY_LABELS[value] || value })).sort((a, b) => a.label.localeCompare(b.label, 'ru')),
])
const eventOptions = computed(() => [
  { value: 'all', label: 'Все события' },
  ...[...new Map(rows.value.map(row => [row.eventType || row.raw.action, { value: row.eventType || row.raw.action, label: row.title }])).values()]
    .sort((a, b) => a.label.localeCompare(b.label, 'ru')),
])
const actorOptions = computed(() => [
  { value: 'all', label: 'Все авторы' },
  ...[...new Map(rows.value.map(row => [row.raw.actor?.uid || 'unknown', {
    value: row.raw.actor?.uid || 'unknown', label: row.actor.label,
  }])).values()].sort((a, b) => a.label.localeCompare(b.label, 'ru')),
])
const outcomeOptions = [
  { value: 'all', label: 'Все результаты' }, { value: 'success', label: 'Успешно' },
  { value: 'failure', label: 'Ошибка' }, { value: 'partial', label: 'Частично' }, { value: 'skipped', label: 'Пропущено' },
]
const filteredLogs = computed(() => {
  const words = search.value.trim().toLocaleLowerCase('ru').split(/\s+/).filter(Boolean)
  const from = dateFrom.value ? new Date(dateFrom.value + 'T00:00:00').getTime() : null
  const until = dateTo.value ? new Date(dateTo.value + 'T23:59:59.999').getTime() : null
  return rows.value.filter(row => {
    const time = row.raw.createdAtIso ? new Date(row.raw.createdAtIso).getTime() : NaN
    if (entityFilter.value !== 'all' && row.raw.entityType !== entityFilter.value) return false
    if (eventFilter.value !== 'all' && (row.eventType || row.raw.action) !== eventFilter.value) return false
    if (actorFilter.value !== 'all' && (row.raw.actor?.uid || 'unknown') !== actorFilter.value) return false
    if (outcomeFilter.value !== 'all' && row.outcome !== outcomeFilter.value) return false
    if (operationFilter.value && row.raw.operationId !== operationFilter.value) return false
    if (from != null && (!Number.isFinite(time) || time < from)) return false
    if (until != null && (!Number.isFinite(time) || time > until)) return false
    return words.every(word => row.search.includes(word))
  })
})
const filtersActive = computed(() => search.value || entityFilter.value !== 'all' || eventFilter.value !== 'all'
  || actorFilter.value !== 'all' || outcomeFilter.value !== 'all' || dateFrom.value || dateTo.value || operationFilter.value)

function resetFilters() {
  search.value = ''; entityFilter.value = 'all'; eventFilter.value = 'all'
  actorFilter.value = 'all'; outcomeFilter.value = 'all'
  dateFrom.value = ''; dateTo.value = ''; operationFilter.value = ''
}
function formatDate(value) {
  if (!value) return 'Время неизвестно'
  return new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function outcomeLabel(outcome) {
  return { success: 'Успешно', failure: 'Ошибка', partial: 'Частично', skipped: 'Пропущено' }[outcome] || outcome
}
onMounted(async () => {
  await Promise.all([
    auditLogs.fetchLogs({ reset: true }),
    roster.fetchPlayers().catch(() => { rosterError.value = true }),
  ])
})
onUnmounted(() => auditLogs.cleanup())
</script>

<template>
  <div class="pb-20 md:pb-0 max-w-6xl mx-auto">
    <div class="flex items-start justify-between gap-4 mb-5">
      <div>
        <h1 class="text-2xl font-bold">Журнал действий</h1>
        <p class="text-sm text-neutral-400 mt-1">Кто, что и когда изменил</p>
      </div>
      <button :disabled="auditLogs.loading" @click="auditLogs.fetchLogs({ reset: true })"
        class="px-3 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-40">Обновить</button>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-5 space-y-3">
      <label class="block text-xs text-neutral-400">
        Поиск по позывному, действию или изменению
        <input v-model="search" type="search" placeholder="Например: Сокол, оптика, Пятница 1"
          class="mt-1 w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-neutral-200 focus:border-delta-green outline-none" />
      </label>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label class="text-xs text-neutral-400">Раздел<BaseSelect v-model="entityFilter" :options="entityOptions" size="sm" class="mt-1" /></label>
        <label class="text-xs text-neutral-400">Событие<BaseSelect v-model="eventFilter" :options="eventOptions" size="sm" class="mt-1" /></label>
        <label class="text-xs text-neutral-400">Автор<BaseSelect v-model="actorFilter" :options="actorOptions" size="sm" class="mt-1" /></label>
        <label class="text-xs text-neutral-400">Результат<BaseSelect v-model="outcomeFilter" :options="outcomeOptions" size="sm" class="mt-1" /></label>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <label class="text-xs text-neutral-400">С даты<input v-model="dateFrom" type="date" class="block mt-1 bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm text-neutral-200 [color-scheme:dark]" /></label>
        <label class="text-xs text-neutral-400">По дату<input v-model="dateTo" type="date" class="block mt-1 bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm text-neutral-200 [color-scheme:dark]" /></label>
        <button v-if="filtersActive" @click="resetFilters" class="text-sm text-neutral-400 hover:text-white py-1.5">Сбросить фильтры</button>
      </div>
      <p v-if="operationFilter" class="text-xs text-amber-300">Показаны события выбранной операции. <button @click="operationFilter = ''" class="underline">Показать все</button></p>
    </div>

    <p class="text-xs text-neutral-400 mb-4">
      Найдено: {{ filteredLogs.length }} · Загружено: {{ auditLogs.logs.length }}.
      {{ auditLogs.hasMore ? 'Поиск и фильтры работают по загруженным записям. Для более ранних событий загрузите ещё.' : 'Загружена вся доступная история.' }}
      Время — в часовом поясе устройства.
    </p>
    <p v-if="rosterError" class="text-xs text-amber-300 mb-3">Не удалось загрузить текущие позывные. Сохранённые в событиях позывные доступны.</p>
    <div v-if="auditLogs.error" role="alert" class="border border-red-800 rounded-xl p-4 mb-4 text-sm text-red-300">
      {{ auditLogs.error }}
      <button @click="auditLogs.fetchLogs()" class="underline ml-2">Повторить</button>
    </div>
    <LoadingSpinner v-if="auditLogs.loading && !auditLogs.logs.length" />
    <div v-else-if="!filteredLogs.length && !auditLogs.error" class="bg-neutral-900 rounded-xl border border-neutral-800 p-6 text-sm text-neutral-400">
      {{ filtersActive ? 'В загруженных записях ничего не найдено.' : 'Журнал пока пуст.' }}
    </div>

    <div class="space-y-3">
      <article v-for="row in filteredLogs" :key="row.id" class="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
        <div class="flex flex-wrap justify-between gap-2 text-xs text-neutral-400 mb-2">
          <div><span class="font-semibold text-neutral-200">{{ row.actor.label }}</span><span v-if="row.actor.current"> · текущий позывной</span><span v-if="row.raw.metadata?.automatic"> · автоматически</span></div>
          <time :datetime="row.raw.createdAtIso || undefined">{{ formatDate(row.raw.createdAtIso) }}</time>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-sm font-semibold text-white">{{ row.title }}<span v-if="row.target" class="text-neutral-300"> · {{ row.target }}</span></h2>
          <span class="text-[11px] border border-neutral-700 rounded px-2 py-0.5 text-neutral-400">{{ row.entity }}</span>
          <span v-if="row.outcome !== 'success'" class="text-xs rounded px-2 py-0.5" :class="row.outcome === 'failure' ? 'bg-red-950 text-red-300' : 'bg-amber-950 text-amber-300'">{{ outcomeLabel(row.outcome) }}</span>
        </div>
        <p v-if="row.context" class="text-xs text-neutral-400 mt-1">{{ row.context }}</p>
        <p v-if="row.raw.metadata?.error" class="text-sm text-red-300 mt-2 break-words">{{ row.raw.metadata.error.message || row.raw.metadata.error }}</p>
        <p v-if="row.outcome === 'failure' || row.outcome === 'partial'" class="text-xs text-amber-300 mt-2">Изменения ниже описывают попытку операции. Успешные этапы смотрите в связанных событиях.</p>
        <div v-if="row.changes.length" class="mt-3 space-y-1.5">
          <div v-for="change in row.changes.slice(0, 3)" :key="change.path" class="text-sm break-words">
            <span class="text-neutral-400">{{ change.label }}: </span>
            <span class="text-neutral-400">{{ change.from.length > 160 ? change.from.slice(0, 160) + '…' : change.from }}</span>
            <span class="text-neutral-500 mx-1">→</span>
            <span class="text-neutral-200">{{ change.to.length > 160 ? change.to.slice(0, 160) + '…' : change.to }}</span>
          </div>
          <details v-if="row.changes.length > 3 || row.changes.some(c => c.from.length > 160 || c.to.length > 160)" class="text-sm">
            <summary class="text-neutral-400 cursor-pointer">Все изменения ({{ row.changes.length }})</summary>
            <dl class="mt-2 space-y-3">
              <div v-for="change in row.changes" :key="change.path" class="border-l-2 border-neutral-700 pl-3">
                <dt class="text-neutral-300">{{ change.label }}</dt>
                <dd class="text-neutral-400 whitespace-pre-wrap break-words">Было: {{ change.from }}</dd>
                <dd class="text-neutral-200 whitespace-pre-wrap break-words">Стало: {{ change.to }}</dd>
              </div>
            </dl>
          </details>
        </div>
        <div class="flex flex-wrap items-start gap-x-4 gap-y-2 mt-3 text-xs text-neutral-400">
          <button v-if="row.raw.operationId" @click="operationFilter = row.raw.operationId" class="hover:text-white underline">Связанные события</button>
          <details class="min-w-0 w-full">
            <summary class="cursor-pointer hover:text-white">Исходная запись и данные учётки</summary>
            <pre class="mt-2 p-3 bg-neutral-950 rounded-lg text-[11px] text-neutral-400 overflow-x-auto whitespace-pre-wrap break-all">{{ JSON.stringify(row.raw, null, 2) }}</pre>
          </details>
        </div>
      </article>
    </div>
    <div v-if="auditLogs.hasMore && !auditLogs.error" class="flex justify-center mt-6">
      <button :disabled="auditLogs.loading" @click="auditLogs.fetchLogs()" class="rounded-lg border border-neutral-700 px-5 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-40">
        {{ auditLogs.loading ? 'Загрузка…' : 'Загрузить ещё 100 записей' }}
      </button>
    </div>
  </div>
</template>
