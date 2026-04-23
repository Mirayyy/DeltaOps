import { defineStore } from 'pinia'
import { ref } from 'vue'
import { GAME_IDS } from '../utils/constants'

export const useGamesStore = defineStore('games', () => {
  // { [gameId]: { schedule, date, sourceUrl, version, slots[], task, updatedAt, updatedBy } }
  const games = ref({})
  const loading = ref(false)
  const initialized = ref(false)

  // Slot memory: when a slot is removed and re-added, its data persists
  const slotMemory = ref({}) // { [gameId]: { [slotKey]: slotData } }

  function getGame(gameId) {
    return games.value[gameId] || null
  }

  function getSlots(gameId) {
    return games.value[gameId]?.slots || []
  }

  function getPlayerSlot(gameId, playerId) {
    const slots = getSlots(gameId)
    return slots.find(s => s.playerId === playerId) || null
  }

  function getPlayerSlots(playerId) {
    const result = {}
    for (const gameId of GAME_IDS) {
      result[gameId] = getPlayerSlot(gameId, playerId)
    }
    return result
  }

  // --- Firestore ---
  let unsubscribes = []

  async function loadFirestore() {
    const { doc, getDoc, db, onSnapshot, collection } = await import('../firebase/firestore')
    const { gamesRef } = await import('../firebase/firestore')

    await new Promise((resolve, reject) => {
      let firstSnapshot = true
      const unsub = onSnapshot(gamesRef, (snapshot) => {
        const data = {}
        snapshot.docs.forEach(d => { data[d.id] = normalizeGame(d.id, d.data()) })
        games.value = data
        initialized.value = true
        if (firstSnapshot) {
          firstSnapshot = false
          resolve()
        }
      }, (error) => {
        if (firstSnapshot) {
          firstSnapshot = false
          reject(error)
        } else {
          console.error('Games snapshot error:', error)
        }
      })
      unsubscribes.push(unsub)
    })
  }

  async function saveGameFirestore(gameId, data) {
    const { doc, setDoc, serverTimestamp, db } = await import('../firebase/firestore')
    await setDoc(doc(db, 'games', gameId), { ...data, updatedAt: serverTimestamp() }, { merge: true })
  }

  async function replaceGameFirestore(gameId, data) {
    const { doc, setDoc, serverTimestamp, db } = await import('../firebase/firestore')
    await setDoc(doc(db, 'games', gameId), { ...data, updatedAt: serverTimestamp() })
  }

  async function mergeGameFirestore(gameId, partial) {
    const { doc, setDoc, serverTimestamp, db } = await import('../firebase/firestore')
    await setDoc(doc(db, 'games', gameId), { schedule: gameId, ...partial, updatedAt: serverTimestamp() }, { merge: true })
  }

  // --- Slot management ---

  function createEmptyGame(gameId) {
    return {
      schedule: gameId,
      date: '',
      sourceUrl: '',
      version: '',
      slots: [],
      task: '',
      slotRequests: [],
      updatedBy: null,
    }
  }

  function normalizeGame(gameId, game = {}) {
    return {
      ...createEmptyGame(gameId),
      ...game,
      schedule: game?.schedule || gameId,
      slots: Array.isArray(game?.slots) ? game.slots : [],
      slotRequests: Array.isArray(game?.slotRequests) ? game.slotRequests : [],
      task: typeof game?.task === 'string' ? game.task : '',
      date: typeof game?.date === 'string' ? game.date : '',
      sourceUrl: typeof game?.sourceUrl === 'string' ? game.sourceUrl : '',
      version: typeof game?.version === 'string' ? game.version : '',
    }
  }

  function ensureGame(gameId) {
    if (!games.value[gameId]) {
      games.value[gameId] = createEmptyGame(gameId)
    } else {
      games.value[gameId] = normalizeGame(gameId, games.value[gameId])
    }
    return games.value[gameId]
  }

  function buildResetGame(gameId, { preserveMeta = false } = {}) {
    const current = normalizeGame(gameId, games.value[gameId] || {})
    return {
      ...createEmptyGame(gameId),
      date: preserveMeta ? current.date || '' : '',
      sourceUrl: preserveMeta ? current.sourceUrl || '' : '',
      version: preserveMeta ? current.version || '' : '',
    }
  }

  /** Build a unique key for slot memory */
  function slotKey(slot) {
    return `${slot.side}::${slot.squad}::${slot.number}`
  }

  /** Toggle slot: add if missing, remove (but remember) if present */
  function toggleSlot(gameId, slot) {
    const game = ensureGame(gameId)
    const key = slotKey(slot)
    const existingIdx = game.slots.findIndex(s => slotKey(s) === key)

    if (existingIdx !== -1) {
      // Remember slot data before removing
      if (!slotMemory.value[gameId]) slotMemory.value[gameId] = {}
      slotMemory.value[gameId][key] = { ...game.slots[existingIdx] }
      game.slots.splice(existingIdx, 1)
    } else {
      // Restore from memory or create new
      const remembered = slotMemory.value[gameId]?.[key]
      game.slots.push(remembered || {
        side: slot.side,
        squad: slot.squad,
        number: slot.number,
        name: slot.name,
        playerId: null,
        equipment: [],
        optics: false,
        notes: '',
        fireteam: '',
        type: null,
        personalTask: '',
      })
    }

    persist(gameId)
  }

  /** Set all configured slots for a game at once */
  function setSlots(gameId, slots, updatedBy) {
    const game = ensureGame(gameId)
    game.slots = Array.isArray(slots) ? slots : []
    game.updatedBy = updatedBy
    persist(gameId)
  }

  async function clearLineup(gameId) {
    const next = buildResetGame(gameId, { preserveMeta: true })
    games.value[gameId] = next
    delete slotMemory.value[gameId]
    await replaceGameFirestore(gameId, next)
  }

  function assignPlayer(gameId, slotIndex, playerId) {
    const game = ensureGame(gameId)
    if (!game || !game.slots[slotIndex]) return

    // Unassign from any other slot in this game
    game.slots.forEach(s => {
      if (s.playerId === playerId) s.playerId = null
    })
    game.slots[slotIndex].playerId = playerId
    persist(gameId)
  }

  function unassignPlayer(gameId, slotIndex) {
    const game = ensureGame(gameId)
    if (!game || !game.slots[slotIndex]) return
    game.slots[slotIndex].playerId = null
    persist(gameId)
  }

  /** Remove a player from all slots in a game (e.g. when marked absent) */
  function unassignPlayerFromGame(gameId, playerId) {
    const game = ensureGame(gameId)
    if (!game) return
    let changed = false
    for (const slot of game.slots) {
      if (slot.playerId === playerId) {
        slot.playerId = null
        changed = true
      }
    }
    if (changed) persist(gameId)
  }

  function updateSlot(gameId, slotIndex, updates) {
    const game = ensureGame(gameId)
    if (!game || !game.slots[slotIndex]) return
    Object.assign(game.slots[slotIndex], updates)
    // Auto-derive optics from equipment
    const eq = game.slots[slotIndex].equipment || []
    game.slots[slotIndex].optics = eq.includes('Оптика')
    persist(gameId)
  }

  function setTask(gameId, task) {
    const game = ensureGame(gameId)
    game.task = task
    persist(gameId)
  }

  // --- Slot Requests ---

  function getSlotRequests(gameId) {
    return ensureGame(gameId).slotRequests
  }

  function addSlotRequest(gameId, { playerId, slots, text }) {
    const game = ensureGame(gameId)
    // Replace existing request from same player
    const idx = game.slotRequests.findIndex(r => r.playerId === playerId)
    const request = { playerId, slots, text, createdAt: new Date().toISOString() }
    if (idx !== -1) {
      game.slotRequests[idx] = request
    } else {
      game.slotRequests.push(request)
    }
    return mergeGameFirestore(gameId, { slotRequests: game.slotRequests })
  }

  function removeSlotRequest(gameId, index) {
    const game = ensureGame(gameId)
    game.slotRequests.splice(index, 1)
    persist(gameId)
  }

  function setGameMeta(gameId, { date, sourceUrl, version }) {
    const patch = {}
    if (date !== undefined) patch.date = date
    if (sourceUrl !== undefined) patch.sourceUrl = sourceUrl
    if (version !== undefined) patch.version = version
    if (!Object.keys(patch).length) return Promise.resolve()

    const game = ensureGame(gameId)
    if (date !== undefined) game.date = date
    if (sourceUrl !== undefined) game.sourceUrl = sourceUrl
    if (version !== undefined) game.version = version

    return mergeGameFirestore(gameId, patch)
  }

  // --- Persist helper ---
  function persist(gameId) {
    return saveGameFirestore(gameId, games.value[gameId])
  }

  // --- Public API ---
  async function fetchGames() {
    loading.value = true
    try {
      await loadFirestore()
    } finally {
      loading.value = false
    }
  }

  /** Clear a single game */
  async function clearGame(gameId) {
    const next = buildResetGame(gameId)
    games.value[gameId] = next
    delete slotMemory.value[gameId]
    await replaceGameFirestore(gameId, next)
  }

  /** Clear all games (new week reset) */
  async function clearGames() {
    const next = {}
    await Promise.all(GAME_IDS.map(async (gameId) => {
      const emptyGame = buildResetGame(gameId)
      next[gameId] = emptyGame
      await replaceGameFirestore(gameId, emptyGame)
    }))
    games.value = next
    slotMemory.value = {}
  }

  function cleanup() {
    unsubscribes.forEach(fn => fn())
    unsubscribes = []
  }

  return {
    games, loading, initialized,
    getGame, getSlots, getPlayerSlot, getPlayerSlots,
    fetchGames, clearLineup, clearGame, clearGames,
    toggleSlot, setSlots, assignPlayer, unassignPlayer, unassignPlayerFromGame, updateSlot,
    setTask, setGameMeta, getSlotRequests, addSlotRequest, removeSlotRequest, cleanup,
  }
})
