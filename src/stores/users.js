import { defineStore } from 'pinia'
import { ref } from 'vue'

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

  async function setRole(userId, role) {
    const { doc, setDoc, db } = await import('../firebase/firestore')
    await setDoc(doc(db, 'users', userId), { role }, { merge: true })
    const idx = users.value.findIndex(u => u.uid === userId)
    if (idx !== -1) users.value[idx] = { ...users.value[idx], role }
  }

  return { users, loading, fetchUsers, setRole }
})
