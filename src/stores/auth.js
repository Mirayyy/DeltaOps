import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/config'
import { isAdmin, isMember } from '../utils/permissions'

export const useAuthStore = defineStore('auth', () => {
  const firebaseUser = ref(null)
  const user = ref(null)       // users/{uid}
  const player = ref(null)     // players/{stableId}
  const loading = ref(true)

  // --- Computed ---
  const isLoggedIn = computed(() => !!firebaseUser.value)
  const isPlayerLinked = computed(() => !!player.value)
  const userRole = computed(() => user.value?.role || 'guest')
  const isUserAdmin = computed(() => isAdmin(userRole.value))
  const isUserMember = computed(() => isMember(userRole.value))
  const playerStatus = computed(() => player.value?.status || null)

  const viewMode = computed(() => {
    if (!isLoggedIn.value || !user.value) return 'guest'
    if (userRole.value === 'guest') return 'guest'
    if (playerStatus.value === 'left') return 'restricted'
    return 'member'
  })

  // --- Fetch or create user document ---
  async function fetchOrCreateUser(fbUser) {
    try {
      const { doc, getDoc, setDoc, serverTimestamp, db } = await import('../firebase/firestore')
      const userDocRef = doc(db, 'users', fbUser.uid)
      const snap = await Promise.race([
        getDoc(userDocRef),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 10000)),
      ])

      if (snap.exists()) {
        await setDoc(userDocRef, { lastLoginAt: serverTimestamp() }, { merge: true })
        return { uid: snap.id, ...snap.data() }
      }

      // First login — guest
      const newUser = {
        email: fbUser.email,
        displayName: fbUser.displayName || '',
        photoURL: fbUser.photoURL || '',
        role: 'guest',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      }
      await setDoc(userDocRef, newUser)
      return { uid: fbUser.uid, ...newUser }
    } catch (e) {
      console.warn('fetchOrCreateUser failed:', e.message)
      return null
    }
  }

  // --- Find player by email ---
  async function fetchPlayerByEmail(email) {
    if (!email) return null
    try {
      const { playersRef, query, where, getDocs } = await import('../firebase/firestore')
      const q = query(playersRef, where('email', '==', email))
      const snapshot = await getDocs(q)
      if (snapshot.empty) return null
      const playerDoc = snapshot.docs[0]
      return { uid: playerDoc.id, ...playerDoc.data() }
    } catch (e) {
      console.warn('fetchPlayerByEmail failed:', e.message)
      return null
    }
  }

  // --- Auto-link: found player → upgrade to member ---
  async function tryAutoLink(userData, foundPlayer) {
    if (!userData || !foundPlayer) return userData
    if (userData.role !== 'guest') return userData
    try {
      const { doc, setDoc, serverTimestamp, db } = await import('../firebase/firestore')
      await setDoc(doc(db, 'users', userData.uid), {
        role: 'member',
        lastLoginAt: serverTimestamp(),
      }, { merge: true })
      return { ...userData, role: 'member' }
    } catch (e) {
      console.warn('tryAutoLink failed:', e.message)
      return userData
    }
  }

  // --- Resolve user + player ---
  async function resolveAuth(fbUser) {
    let userData = await fetchOrCreateUser(fbUser)
    const foundPlayer = await fetchPlayerByEmail(fbUser.email)

    if (foundPlayer) {
      userData = await tryAutoLink(userData, foundPlayer)
    }

    user.value = userData
    player.value = foundPlayer
  }

  // --- Init ---
  let initPromise = null

  function init() {
    if (initPromise) return initPromise

    if (!auth) {
      loading.value = false
      initPromise = Promise.resolve()
      return initPromise
    }

    initPromise = (async () => {
      const timeout = setTimeout(() => {
        console.warn('Auth init timeout — proceeding without auth')
        loading.value = false
      }, 15000)

      // Process redirect result FIRST (Safari/iOS returns here after Google login)
      try {
        const { handleRedirectResult } = await import('../firebase/auth')
        await handleRedirectResult()
      } catch {}

      // Now listen for auth state — redirect user (if any) is already resolved
      await new Promise((resolve) => {
        onAuthStateChanged(auth, async (fbUser) => {
          clearTimeout(timeout)
          firebaseUser.value = fbUser
          if (fbUser) {
            await resolveAuth(fbUser)
          } else {
            user.value = null
            player.value = null
          }
          loading.value = false
          resolve()
        })
      })
    })()
    return initPromise
  }

  function waitForInit() {
    return initPromise || Promise.resolve()
  }

  // --- Login ---
  async function login() {
    const { signInWithGoogle } = await import('../firebase/auth')
    const fbUser = await signInWithGoogle()
    if (!fbUser) return // redirect flow — page will reload
    firebaseUser.value = fbUser
    await resolveAuth(fbUser)
  }

  // --- Logout ---
  async function logout() {
    const { signOut } = await import('../firebase/auth')
    await signOut()
    firebaseUser.value = null
    user.value = null
    player.value = null
  }

  // --- Admin: update user role ---
  async function updateUserRole(userId, role) {
    const { doc, setDoc, db } = await import('../firebase/firestore')
    await setDoc(doc(db, 'users', userId), { role }, { merge: true })
  }

  return {
    firebaseUser, user, player, loading,
    isLoggedIn, isPlayerLinked, userRole, isUserAdmin, isUserMember, playerStatus, viewMode,
    init, waitForInit, login, logout, updateUserRole,
  }
})
