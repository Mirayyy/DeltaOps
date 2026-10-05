import { defineStore } from 'pinia'
import { ref } from 'vue'
import { cloneForAudit, auditedWrite } from '../utils/auditLog'

export const useUsersStore = defineStore('users', () => {
  const users = ref([])
  const loading = ref(false)

  async function fetchUsers() {
    loading.value = true
    try {
      const { usersRef, getDocs } = await import('../firebase/firestore')
      const snapshot = await getDocs(usersRef)
      users.value = snapshot.docs.map(doc => ({
        uid: doc.id,
        email: '',
        displayName: '',
        photoURL: '',
        role: 'guest',
        createdAt: null,
        lastLoginAt: null,
        ...doc.data(),
      }))
    } catch (e) {
      console.warn('fetchUsers failed:', e.message)
    } finally {
      loading.value = false
    }
  }

  async function setRole(userId, role, audit = {}) {
    const { doc, getDoc, setDoc, db } = await import('../firebase/firestore')
    const snap = await getDoc(doc(db, 'users', userId))
    if (!snap.exists()) throw new Error('Учётная запись не найдена')
    const before = cloneForAudit({ uid: userId, ...snap.data() })
    if (before.role === role) return
    const after = { ...before, role }
    await auditedWrite({
      ...audit,
      eventType: audit.eventType || 'user.role',
      entityType: 'users',
      entityId: userId,
      before,
      after,
      summary: `users - update - ${userId}`,
    }, () => setDoc(doc(db, 'users', userId), { role }, { merge: true }))
    const idx = users.value.findIndex(u => u.uid === userId)
    if (idx !== -1) users.value[idx] = after
  }

  return { users, loading, fetchUsers, setRole }
})
