import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth'
import { timestampIso } from '../utils/auditFormat.js'

const PAGE_SIZE = 100

export const useAuditLogsStore = defineStore('auditLogs', () => {
  const logs = ref([])
  const loading = ref(false)
  const error = ref('')
  const hasMore = ref(true)
  let cursor = null
  let generation = 0

  async function fetchLogs({ reset = false } = {}) {
    if (loading.value && !reset) return
    if (reset) {
      generation++
      cursor = null
      logs.value = []
      hasMore.value = true
    }
    if (!hasMore.value) return
    const request = generation
    loading.value = true
    error.value = ''
    try {
      const { logsRef, getDocs, query, orderBy, limit, startAfter } = await import('../firebase/firestore')
      const constraints = [orderBy('createdAt', 'desc')]
      if (cursor) constraints.push(startAfter(cursor))
      const snapshot = await getDocs(query(logsRef, ...constraints, limit(PAGE_SIZE)))
      if (request !== generation) return
      const existing = new Set(logs.value.map(log => log.id))
      logs.value.push(...snapshot.docs.filter(d => !existing.has(d.id)).map(d => ({
        ...d.data(), id: d.id, createdAtIso: timestampIso(d.data().createdAt),
      })))
      cursor = snapshot.docs.at(-1) || cursor
      hasMore.value = snapshot.docs.length === PAGE_SIZE
    } catch (err) {
      if (request === generation) error.value = 'Не удалось загрузить журнал. Проверьте подключение и права доступа.'
      console.warn('audit logs read failed:', err.message)
    } finally {
      if (request === generation) loading.value = false
    }
  }

  async function logEvent(entry) {
    if (!useAuthStore().isLoggedIn) return false
    const data = JSON.parse(JSON.stringify(entry))
    try {
      const { logsRef, doc, setDoc, serverTimestamp } = await import('../firebase/firestore')
      await setDoc(doc(logsRef), {
        action: data.action, entityType: data.entityType, entityId: data.entityId || '',
        summary: data.summary || '', before: data.before ?? null, after: data.after ?? null,
        metadata: data.metadata ?? null, actor: data.actor,
        severity: data.severity || 'info', outcome: data.outcome || 'success',
        schemaVersion: 2, eventType: data.eventType || '', operationId: data.operationId || '',
        context: data.context || {}, references: data.references || {},
        createdAt: serverTimestamp(),
      })
      return true
    } catch (err) {
      console.warn('audit log write failed:', err.message)
      return false
    }
  }

  function cleanup() {
    generation++
    loading.value = false
    logs.value = []
    cursor = null
    hasMore.value = true
    error.value = ''
  }

  return { logs, loading, error, hasMore, fetchLogs, logEvent, cleanup }
})
