import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth'

function normalizeTimestamp(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  if (typeof value === 'string') return value
  try {
    return new Date(value).toISOString()
  } catch {
    return null
  }
}

export const useAuditLogsStore = defineStore('auditLogs', () => {
  const logs = ref([])
  const loading = ref(false)

  let unsubscribe = null

  function actorFromAuth() {
    const auth = useAuthStore()
    return {
      uid: auth.user?.uid || auth.firebaseUser?.uid || '',
      displayName: auth.user?.displayName || auth.firebaseUser?.displayName || '',
      email: auth.user?.email || auth.firebaseUser?.email || '',
      role: auth.userRole || 'guest',
    }
  }

  async function fetchLogs() {
    if (unsubscribe) return

    loading.value = true
    const { logsRef, onSnapshot, query, orderBy, limit } = await import('../firebase/firestore')

    unsubscribe = onSnapshot(
      query(logsRef, orderBy('createdAt', 'desc'), limit(500)),
      (snapshot) => {
        logs.value = snapshot.docs.map((docSnap) => {
          const data = docSnap.data()
          return {
            id: docSnap.id,
            ...data,
            createdAtIso: normalizeTimestamp(data.createdAt),
          }
        })
        loading.value = false
      },
      (error) => {
        console.warn('audit logs snapshot failed:', error.message)
        loading.value = false
      },
    )
  }

  async function logEvent({
    action,
    entityType,
    entityId = '',
    summary = '',
    details = null,
    severity = 'info',
  }) {
    const auth = useAuthStore()
    if (!auth.isLoggedIn) return false

    try {
      const { collection, doc, setDoc, serverTimestamp, db } = await import('../firebase/firestore')
      const actor = actorFromAuth()
      const ref = doc(collection(db, 'logs'))
      await setDoc(ref, {
        action,
        entityType,
        entityId,
        summary,
        details,
        severity,
        actor,
        createdAt: serverTimestamp(),
      })
      return true
    } catch (error) {
      console.warn('audit log write failed:', error.message)
      return false
    }
  }

  function cleanup() {
    unsubscribe?.()
    unsubscribe = null
  }

  return {
    logs,
    loading,
    fetchLogs,
    logEvent,
    cleanup,
  }
})
