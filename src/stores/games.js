import { defineStore } from 'pinia'
import { ref } from 'vue'
import { GAME_IDS } from '../utils/constants'
import { cloneForAudit, logEntitySnapshot } from '../utils/auditLog'

export const useGamesStore = defineStore('games', () => {
  // { [gameId]: { schedule, date, sourceUrl, version, slots[], task, updatedAt, updatedBy } }
  const games = ref({})
  const loading = ref(false)

  // Slot memory: when a slot is removed and re-added, its data persists
  const slotMemory = ref({}) // { [gameId]: { [slotKey]: slotData } }

  function ensureGame(gameId) {
    if (!games.value[gameId]) {
      games.value[gameId] = { schedule: gameId, date: '', sourceUrl: '', version: '', slots: [], task: '' }
    }
    return games.value[gameId]
  }

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

    const unsub = onSnapshot(gamesRef, (snapshot) => {
      const data = {}
      snapshot.docs.forEach(d => { data[d.id] = d.data() })
      games.value = data
    })
    unsubscribes.push(unsub)
  }

  async function saveGameFirestore(gameId, data) {
    const { doc, setDoc, serverTimestamp, db } = await import('../firebase/firestore')
    await setDoc(doc(db, 'games', gameId), { ...data, updatedAt: serverTimestamp() }, { merge: true })
  }

  // --- Slot management ---

  /** Build a unique key for slot memory */
  function slotKey(slot) {
    return `${slot.side}::${slot.squad}::${slot.number}`
  }

  /** Toggle slot: add if missing, remove (but remember) if present */
  function toggleSlot(gameId, slot) {
    const before = cloneForAudit(getGame(gameId))
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

    void persist(gameId, {
      before,
      summary: `games - update - ${gameId}`,
      metadata: {
        operation: 'toggle-slot',
        slotKey: key,
      },
    })
  }

  /** Set all configured slots for a game at once */
  function setSlots(gameId, slots, updatedBy) {
    const before = cloneForAudit(getGame(gameId))
    const game = ensureGame(gameId)
    game.slots = slots
    game.updatedBy = updatedBy
    void persist(gameId, {
      before,
      summary: `games - ${before ? 'update' : 'create'} - ${gameId}`,
      metadata: {
        operation: 'set-slots',
        updatedBy,
      },
    })
  }

  function assignPlayer(gameId, slotIndex, playerId) {
    const game = games.value[gameId]
    if (!game || !game.slots[slotIndex]) return
    const before = cloneForAudit(game)

    // Unassign from any other slot in this game
    game.slots.forEach(s => {
      if (s.playerId === playerId) s.playerId = null
    })
    game.slots[slotIndex].playerId = playerId
    void persist(gameId, {
      before,
      summary: `games - update - ${gameId}`,
      metadata: {
        operation: 'assign-player',
        slotIndex,
        playerId,
      },
    })
  }

  function unassignPlayer(gameId, slotIndex) {
    const game = games.value[gameId]
    if (!game || !game.slots[slotIndex]) return
    const before = cloneForAudit(game)
    const playerId = game.slots[slotIndex].playerId
    game.slots[slotIndex].playerId = null
    void persist(gameId, {
      before,
      summary: `games - update - ${gameId}`,
      metadata: {
        operation: 'unassign-player',
        slotIndex,
        playerId,
      },
    })
  }

  /** Remove a player from all slots in a game (e.g. when marked absent) */
  function unassignPlayerFromGame(gameId, playerId) {
    const game = games.value[gameId]
    if (!game) return
    const before = cloneForAudit(game)
    let changed = false
    for (const slot of game.slots) {
      if (slot.playerId === playerId) {
        slot.playerId = null
        changed = true
      }
    }
    if (changed) {
      void persist(gameId, {
        before,
        summary: `games - update - ${gameId}`,
        metadata: {
          operation: 'unassign-player-from-game',
          playerId,
        },
      })
    }
  }

  function updateSlot(gameId, slotIndex, updates) {
    const game = games.value[gameId]
    if (!game || !game.slots[slotIndex]) return
    const before = cloneForAudit(game)
    Object.assign(game.slots[slotIndex], updates)
    // Auto-derive optics from equipment
    const eq = game.slots[slotIndex].equipment || []
    game.slots[slotIndex].optics = eq.includes('Оптика')
    void persist(gameId, {
      before,
      summary: `games - update - ${gameId}`,
      metadata: {
        operation: 'update-slot',
        slotIndex,
        updates,
      },
    })
  }

  function setTask(gameId, task) {
    const before = cloneForAudit(getGame(gameId))
    const game = ensureGame(gameId)
    game.task = task
    void persist(gameId, {
      before,
      summary: `games - ${before ? 'update' : 'create'} - ${gameId}`,
      metadata: {
        operation: 'set-task',
      },
    })
  }

  // --- Slot Requests ---

  function getSlotRequests(gameId) {
    return games.value[gameId]?.slotRequests || []
  }

  function addSlotRequest(gameId, { playerId, slots, text }) {
    const before = cloneForAudit(getGame(gameId))
    const game = ensureGame(gameId)
    if (!game.slotRequests) game.slotRequests = []
    // Replace existing request from same player
    const idx = game.slotRequests.findIndex(r => r.playerId === playerId)
    const request = { playerId, slots, text, createdAt: new Date().toISOString() }
    if (idx !== -1) {
      game.slotRequests[idx] = request
    } else {
      game.slotRequests.push(request)
    }
    void persist(gameId, {
      before,
      summary: `games - ${before ? 'update' : 'create'} - ${gameId}`,
      metadata: {
        operation: 'set-slot-request',
        playerId,
      },
    })
  }

  function removeSlotRequest(gameId, index) {
    if (!games.value[gameId]?.slotRequests) return
    const before = cloneForAudit(games.value[gameId])
    games.value[gameId].slotRequests.splice(index, 1)
    void persist(gameId, {
      before,
      summary: `games - update - ${gameId}`,
      metadata: {
        operation: 'remove-slot-request',
        index,
      },
    })
  }

  function setGameMeta(gameId, { date, sourceUrl, version }) {
    const before = cloneForAudit(getGame(gameId))
    const game = ensureGame(gameId)
    if (date !== undefined) game.date = date
    if (sourceUrl !== undefined) game.sourceUrl = sourceUrl
    if (version !== undefined) game.version = version
    void persist(gameId, {
      before,
      summary: `games - ${before ? 'update' : 'create'} - ${gameId}`,
      metadata: {
        operation: 'set-game-meta',
      },
    })
  }

  // --- Persist helper ---
  async function persist(gameId, { before = null, summary = '', metadata = null } = {}) {
    const after = games.value[gameId]
    await saveGameFirestore(gameId, after)
    await logEntitySnapshot({
      entityType: 'games',
      entityId: gameId,
      before,
      after,
      summary: summary || `games - ${before ? 'update' : 'create'} - ${gameId}`,
      metadata,
    })
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
    const { doc, deleteDoc, db } = await import('../firebase/firestore')
    const before = cloneForAudit(getGame(gameId))
    await deleteDoc(doc(db, 'games', gameId)).catch(() => {})
    delete games.value[gameId]
    delete slotMemory.value[gameId]
    await logEntitySnapshot({
      entityType: 'games',
      entityId: gameId,
      before,
      after: null,
      summary: `games - delete - ${gameId}`,
    })
  }

  /** Clear all games (new week reset) */
  async function clearGames() {
    const { doc, deleteDoc, db } = await import('../firebase/firestore')
    const existingGames = GAME_IDS
      .map(id => ({ id, before: cloneForAudit(getGame(id)) }))
      .filter(entry => entry.before)
    await Promise.all(GAME_IDS.map(id => deleteDoc(doc(db, 'games', id)).catch(() => {})))
    games.value = {}
    slotMemory.value = {}
    await Promise.all(existingGames.map(entry =>
      logEntitySnapshot({
        entityType: 'games',
        entityId: entry.id,
        before: entry.before,
        after: null,
        summary: `games - delete - ${entry.id}`,
        metadata: { operation: 'clear-games' },
      })
    ))
  }

  function cleanup() {
    unsubscribes.forEach(fn => fn())
    unsubscribes = []
  }

  return {
    games, loading,
    getGame, getSlots, getPlayerSlot, getPlayerSlots,
    fetchGames, clearGame, clearGames,
    toggleSlot, setSlots, assignPlayer, unassignPlayer, unassignPlayerFromGame, updateSlot,
    setTask, setGameMeta, getSlotRequests, addSlotRequest, removeSlotRequest, cleanup,
  }
})
