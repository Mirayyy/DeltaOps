import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { POSITIONS } from '../utils/constants'

export const useRosterStore = defineStore('roster', () => {
  const players = ref([])
  const loading = ref(false)

  // --- Default sort: position rank → nickname ---
  function sortByPositionThenName(list) {
    return [...list].sort((a, b) => {
      const posA = POSITIONS.indexOf(a.position)
      const posB = POSITIONS.indexOf(b.position)
      const rankA = posA === -1 ? 999 : posA
      const rankB = posB === -1 ? 999 : posB
      if (rankA !== rankB) return rankA - rankB
      return (a.nickname || '').localeCompare(b.nickname || '', 'ru')
    })
  }

  // --- Computed ---
  const activePlayers = computed(() => sortByPositionThenName(players.value.filter(p => p.status === 'active')))
  const reservePlayers = computed(() => sortByPositionThenName(players.value.filter(p => p.status === 'reserve')))
  const bannedPlayers = computed(() => sortByPositionThenName(players.value.filter(p => p.status === 'banned')))
  const leftPlayers = computed(() => sortByPositionThenName(players.value.filter(p => p.status === 'left')))
  // Active + reserve + banned (full squad, excluding "left")
  const squadMembers = computed(() => sortByPositionThenName(players.value.filter(p => p.status !== 'left')))

  // O(1) lookup
  const playerMap = computed(() => {
    const map = {}
    for (const p of players.value) map[p.uid] = p
    return map
  })

  const nicknameMap = computed(() => {
    const map = {}
    for (const p of players.value) {
      if (p.nickname) map[p.nickname] = p
    }
    return map
  })

  // --- Lookups ---
  function getPlayer(uid) {
    return playerMap.value[uid] || null
  }

  function getPlayerByNickname(nickname) {
    return nicknameMap.value[nickname] || null
  }

  /** Resolve playerId → nickname (for UI display) */
  function resolveNickname(uid) {
    return playerMap.value[uid]?.nickname || uid
  }

  /** Resolve playerId → nickname color (empty string = default) */
  function getNicknameColor(uid) {
    return playerMap.value[uid]?.nicknameColor || ''
  }

  // --- Firestore mode ---
  const PLAYER_DEFAULTS = {
    nickname: '', email: '', position: 'Боец отряда', status: 'active',
    avatar: '', nicknameColor: '', steamUrl: '',
    telegramUsername: '', telegramId: null,
    discordId: '', discordUsername: '',
    skills: [], wishes: '', nicknameHistory: [],
  }

  async function loadFirestore() {
    const { playersRef, getDocs } = await import('../firebase/firestore')
    const snapshot = await getDocs(playersRef)
    players.value = sortByPositionThenName(snapshot.docs.map(doc => ({
      uid: doc.id,
      ...PLAYER_DEFAULTS,
      ...doc.data(),
    })))
  }

  // Whitelist of fields allowed in players/ documents
  const PLAYER_FIELDS = [
    'nickname', 'email', 'position', 'status', 'avatar', 'nicknameColor', 'steamUrl',
    'telegramUsername', 'telegramId', 'discordId', 'discordUsername',
    'skills', 'wishes', 'nicknameHistory', 'createdAt', 'updatedAt',
  ]

  function sanitizePlayerData(data) {
    const clean = {}
    for (const key of PLAYER_FIELDS) {
      if (key in data && data[key] !== undefined) clean[key] = data[key]
    }
    return clean
  }

  async function savePlayerFirestore(playerData) {
    const { doc, setDoc, serverTimestamp, db } = await import('../firebase/firestore')
    const ref = doc(db, 'players', playerData.uid)
    await setDoc(ref, { ...sanitizePlayerData(playerData), updatedAt: serverTimestamp() }, { merge: true })
  }

  async function deletePlayerFirestore(uid) {
    const { doc, deleteDoc, db } = await import('../firebase/firestore')
    await deleteDoc(doc(db, 'players', uid))
  }

  // --- Nickname index ---
  async function setNicknameIndex(nickname, playerId) {
    if (!nickname) return
    const { doc, setDoc, db } = await import('../firebase/firestore')
    await setDoc(doc(db, 'nicknameIndex', nickname), { playerId })
  }

  async function deleteNicknameIndex(nickname) {
    if (!nickname) return
    const { doc, deleteDoc, db } = await import('../firebase/firestore')
    await deleteDoc(doc(db, 'nicknameIndex', nickname))
  }

  // --- User role management on status transitions ---

  /** Downgrade linked user to 'guest' when player leaves (skip admins) */
  async function downgradeLinkedUser(email) {
    if (!email) return
    try {
      const { query, where, getDocs, doc, setDoc, db } = await import('../firebase/firestore')
      const { collection } = await import('firebase/firestore')
      const usersRef = collection(db, 'users')
      const q = query(usersRef, where('email', '==', email))
      const snap = await getDocs(q)
      for (const userDoc of snap.docs) {
        const data = userDoc.data()
        if (data.role === 'admin') continue // never downgrade admins
        if (data.role !== 'guest') {
          await setDoc(doc(db, 'users', userDoc.id), { role: 'guest' }, { merge: true })
        }
      }
    } catch (e) {
      console.warn('downgradeLinkedUser failed:', e.message)
    }
  }

  /** Upgrade linked user from 'guest' to 'member' when player returns */
  async function upgradeLinkedUser(email) {
    if (!email) return
    try {
      const { query, where, getDocs, doc, setDoc, db } = await import('../firebase/firestore')
      const { collection } = await import('firebase/firestore')
      const usersRef = collection(db, 'users')
      const q = query(usersRef, where('email', '==', email))
      const snap = await getDocs(q)
      for (const userDoc of snap.docs) {
        const data = userDoc.data()
        if (data.role === 'guest') {
          await setDoc(doc(db, 'users', userDoc.id), { role: 'member' }, { merge: true })
        }
      }
    } catch (e) {
      console.warn('upgradeLinkedUser failed:', e.message)
    }
  }

  // --- Public API ---
  async function fetchPlayers() {
    loading.value = true
    try {
      await loadFirestore()
    } finally {
      loading.value = false
    }
  }

  async function addPlayer(playerData) {
    const uid = `p-${Date.now()}`
    const newPlayer = {
      uid,
      ...PLAYER_DEFAULTS,
      ...playerData,
      status: playerData.status || 'active',
    }

    await savePlayerFirestore(newPlayer)
    await setNicknameIndex(newPlayer.nickname, uid)
    players.value.push(newPlayer)
    return newPlayer
  }

  async function updatePlayer(uid, updates) {
    const idx = players.value.findIndex(p => p.uid === uid)
    if (idx === -1) return

    const currentPlayer = players.value[idx]
    const oldNickname = currentPlayer.nickname

    // --- Role management on status transition ---
    if (updates.status && currentPlayer.status !== updates.status) {
      if (currentPlayer.status !== 'left' && updates.status === 'left') {
        await downgradeLinkedUser(currentPlayer.email)
      } else if (currentPlayer.status === 'left' && updates.status !== 'left') {
        await upgradeLinkedUser(currentPlayer.email)
      }
    }

    const updated = { ...currentPlayer, ...updates }

    await savePlayerFirestore(updated)
    // If nickname changed, atomic swap in nicknameIndex
    if (updates.nickname && updates.nickname !== oldNickname) {
      const { doc, writeBatch, db } = await import('../firebase/firestore')
      const batch = writeBatch(db)
      if (oldNickname) batch.delete(doc(db, 'nicknameIndex', oldNickname))
      batch.set(doc(db, 'nicknameIndex', updates.nickname), { playerId: uid })
      await batch.commit()
    }
    players.value[idx] = updated
  }

  async function removePlayer(uid) {
    const player = getPlayer(uid)
    // Atomic batch: delete player + nicknameIndex together
    const { doc, writeBatch, db } = await import('../firebase/firestore')
    const batch = writeBatch(db)
    batch.delete(doc(db, 'players', uid))
    if (player?.nickname) batch.delete(doc(db, 'nicknameIndex', player.nickname))
    await batch.commit()
    players.value = players.value.filter(p => p.uid !== uid)
  }

  /** Mark player as left + downgrade linked user to guest */
  async function markAsLeft(uid) {
    await updatePlayer(uid, { status: 'left' })
  }

  return {
    players, loading,
    activePlayers, reservePlayers, bannedPlayers, leftPlayers, squadMembers,
    playerMap, nicknameMap,
    getPlayer, getPlayerByNickname, resolveNickname, getNicknameColor,
    fetchPlayers, addPlayer, updatePlayer, removePlayer, markAsLeft,
  }
})
