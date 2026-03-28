import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { isFirebaseConfigured } from '../firebase/config'

const DEMO_PLAYERS = [
  {
    uid: 'p-demo-1', nickname: 'HardKil', email: 'hardkil@example.com',
    position: 'Командир отряда', status: 'active', avatar: '',
    steamUrl: '', telegramUsername: '', telegramId: null,
    discordId: '', discordUsername: '',
    skills: [{ skillName: 'Снайпер', level: 'experienced' }, { skillName: 'БПЛА', level: 'intermediate' }],
    wishes: '', nicknameHistory: [],
  },
  {
    uid: 'p-demo-2', nickname: 'Mirrox', email: 'mirrox@example.com',
    position: 'Заместитель Командира отряда', status: 'active', avatar: '',
    steamUrl: '', telegramUsername: '', telegramId: null,
    discordId: '', discordUsername: '',
    skills: [{ skillName: 'Снайпер', level: 'experienced' }, { skillName: 'БПЛА', level: 'experienced' }],
    wishes: '', nicknameHistory: [],
  },
  {
    uid: 'p-demo-3', nickname: 'Asriel', email: 'asriel@example.com',
    position: 'Штабист', status: 'active', avatar: '',
    steamUrl: '', telegramUsername: '', telegramId: null,
    discordId: '', discordUsername: '',
    skills: [
      { skillName: 'ПТРК', level: 'experienced' }, { skillName: 'ПЗРК', level: 'intermediate' },
      { skillName: 'СПГ / АГС / МК', level: 'experienced' }, { skillName: 'Сапер (Многоразовый)', level: 'intermediate' },
      { skillName: 'БПЛА', level: 'beginner' }, { skillName: 'БМП', level: 'beginner' },
      { skillName: 'Танк', level: 'beginner' }, { skillName: 'Вертолёт [Б]', level: 'beginner' },
    ],
    wishes: '', nicknameHistory: [],
  },
  {
    uid: 'p-demo-4', nickname: 'Priest', email: 'priest@example.com',
    position: 'Боец отряда', status: 'active', avatar: '',
    steamUrl: '', telegramUsername: '', telegramId: null,
    discordId: '', discordUsername: '',
    skills: [], wishes: '', nicknameHistory: [],
  },
  {
    uid: 'p-demo-5', nickname: 'BORDO', email: 'bordo@example.com',
    position: 'Боец отряда', status: 'active', avatar: '',
    steamUrl: '', telegramUsername: '', telegramId: null,
    discordId: '', discordUsername: '',
    skills: [
      { skillName: 'Самолет', level: 'experienced' }, { skillName: 'ПТРК', level: 'intermediate' },
      { skillName: 'Снайпер', level: 'intermediate' }, { skillName: 'БПЛА', level: 'intermediate' },
      { skillName: 'Вертолёт [Б]', level: 'beginner' },
    ],
    wishes: '', nicknameHistory: [],
  },
  {
    uid: 'p-demo-6', nickname: 'Koreec', email: 'koreec@example.com',
    position: 'Боец отряда', status: 'active', avatar: '',
    steamUrl: '', telegramUsername: '', telegramId: null,
    discordId: '', discordUsername: '',
    skills: [
      { skillName: 'Танк', level: 'experienced' }, { skillName: 'БМП', level: 'experienced' },
      { skillName: 'ПВО', level: 'intermediate' },
    ],
    wishes: '', nicknameHistory: [],
  },
  {
    uid: 'p-demo-7', nickname: 'Desmond', email: 'desmond@example.com',
    position: 'Боец запаса', status: 'reserve', avatar: '',
    steamUrl: '', telegramUsername: '', telegramId: null,
    discordId: '', discordUsername: '',
    skills: [
      { skillName: 'БМП', level: 'intermediate' }, { skillName: 'Танк', level: 'beginner' },
      { skillName: 'ПВО', level: 'beginner' }, { skillName: 'Вертолёт [Т]', level: 'beginner' },
      { skillName: 'Вертолёт [Б]', level: 'beginner' }, { skillName: 'Самолет', level: 'beginner' },
    ],
    wishes: '', nicknameHistory: [],
  },
  {
    uid: 'p-demo-8', nickname: 'hron', email: 'hron@example.com',
    position: 'Боец запаса', status: 'reserve', avatar: '',
    steamUrl: '', telegramUsername: '', telegramId: null,
    discordId: '', discordUsername: '',
    skills: [], wishes: '', nicknameHistory: [],
  },
]

export const useRosterStore = defineStore('roster', () => {
  const players = ref([])
  const loading = ref(false)

  // --- Computed ---
  const activePlayers = computed(() => players.value.filter(p => p.status === 'active'))
  const reservePlayers = computed(() => players.value.filter(p => p.status === 'reserve'))
  const bannedPlayers = computed(() => players.value.filter(p => p.status === 'banned'))
  const leftPlayers = computed(() => players.value.filter(p => p.status === 'left'))

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

  // --- Demo/localStorage mode ---
  function loadDemo() {
    const saved = localStorage.getItem('deltaops_players')
    players.value = saved ? JSON.parse(saved) : [...DEMO_PLAYERS]
  }

  function saveDemo() {
    localStorage.setItem('deltaops_players', JSON.stringify(players.value))
  }

  // --- Firestore mode ---
  const PLAYER_DEFAULTS = {
    nickname: '', email: '', position: 'Боец отряда', status: 'active',
    avatar: '', steamUrl: '',
    telegramUsername: '', telegramId: null,
    discordId: '', discordUsername: '',
    skills: [], wishes: '', nicknameHistory: [],
  }

  async function loadFirestore() {
    const { playersRef, getDocs } = await import('../firebase/firestore')
    const snapshot = await getDocs(playersRef)
    players.value = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...PLAYER_DEFAULTS,
      ...doc.data(),
    }))
  }

  // Whitelist of fields allowed in players/ documents
  const PLAYER_FIELDS = [
    'nickname', 'email', 'position', 'status', 'avatar', 'steamUrl',
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
    if (!isFirebaseConfigured || !nickname) return
    const { doc, setDoc, db } = await import('../firebase/firestore')
    await setDoc(doc(db, 'nicknameIndex', nickname), { playerId })
  }

  async function deleteNicknameIndex(nickname) {
    if (!isFirebaseConfigured || !nickname) return
    const { doc, deleteDoc, db } = await import('../firebase/firestore')
    await deleteDoc(doc(db, 'nicknameIndex', nickname))
  }

  // --- Public API ---
  async function fetchPlayers() {
    loading.value = true
    try {
      if (isFirebaseConfigured) {
        await loadFirestore()
      } else {
        loadDemo()
      }
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

    if (isFirebaseConfigured) {
      await savePlayerFirestore(newPlayer)
      await setNicknameIndex(newPlayer.nickname, uid)
    }
    players.value.push(newPlayer)
    if (!isFirebaseConfigured) saveDemo()
    return newPlayer
  }

  async function updatePlayer(uid, updates) {
    const idx = players.value.findIndex(p => p.uid === uid)
    if (idx === -1) return

    const oldNickname = players.value[idx].nickname
    const updated = { ...players.value[idx], ...updates }

    if (isFirebaseConfigured) {
      await savePlayerFirestore(updated)
      // If nickname changed, update nicknameIndex + nicknameHistory
      if (updates.nickname && updates.nickname !== oldNickname) {
        await deleteNicknameIndex(oldNickname)
        await setNicknameIndex(updates.nickname, uid)
      }
    }
    players.value[idx] = updated
    if (!isFirebaseConfigured) saveDemo()
  }

  async function removePlayer(uid) {
    const player = getPlayer(uid)
    if (isFirebaseConfigured) {
      await deletePlayerFirestore(uid)
      if (player?.nickname) await deleteNicknameIndex(player.nickname)
    }
    players.value = players.value.filter(p => p.uid !== uid)
    if (!isFirebaseConfigured) saveDemo()
  }

  /** Mark player as left + downgrade linked user to guest */
  async function markAsLeft(uid) {
    await updatePlayer(uid, { status: 'left' })
  }

  return {
    players, loading,
    activePlayers, reservePlayers, bannedPlayers, leftPlayers,
    playerMap, nicknameMap,
    getPlayer, getPlayerByNickname, resolveNickname,
    fetchPlayers, addPlayer, updatePlayer, removePlayer, markAsLeft,
  }
})
