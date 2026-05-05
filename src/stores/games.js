import { defineStore } from 'pinia'
import { ref } from 'vue'
import { GAME_IDS } from '../utils/constants'
import { writeAuditLog } from '../utils/auditLog'

export const useGamesStore = defineStore('games', () => {
  // { [gameId]: { schedule, date, sourceUrl, version, slots[], task, updatedAt, updatedBy } }
  const games = ref({})
  const loading = ref(false)

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
    if (!games.value[gameId]) {
      games.value[gameId] = { schedule: gameId, date: '', sourceUrl: '', version: '', slots: [], task: '' }
    }
    const game = games.value[gameId]
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
    const existed = !!games.value[gameId]
    if (!games.value[gameId]) {
      games.value[gameId] = { schedule: gameId, date: '', sourceUrl: '', version: '', slots: [], task: '' }
    }
    games.value[gameId].slots = slots
    games.value[gameId].updatedBy = updatedBy
    persist(gameId)
    void writeAuditLog({
      action: existed ? 'update' : 'create',
      entityType: 'game',
      entityId: gameId,
      summary: `${existed ? 'Обновлена' : 'Создана'} расстановка ${gameId}`,
      details: {
        slotCount: slots.length,
        updatedBy,
      },
    })
  }

  function assignPlayer(gameId, slotIndex, playerId) {
    const game = games.value[gameId]
    if (!game || !game.slots[slotIndex]) return

    // Unassign from any other slot in this game
    game.slots.forEach(s => {
      if (s.playerId === playerId) s.playerId = null
    })
    game.slots[slotIndex].playerId = playerId
    persist(gameId)
    void writeAuditLog({
      action: 'update',
      entityType: 'game',
      entityId: gameId,
      summary: `Назначен игрок в ${gameId}`,
      details: {
        slotIndex,
        playerId,
        slot: game.slots[slotIndex],
      },
    })
  }

  function unassignPlayer(gameId, slotIndex) {
    const game = games.value[gameId]
    if (!game || !game.slots[slotIndex]) return
    const playerId = game.slots[slotIndex].playerId
    game.slots[slotIndex].playerId = null
    persist(gameId)
    void writeAuditLog({
      action: 'update',
      entityType: 'game',
      entityId: gameId,
      summary: `Снят игрок из слота ${gameId}`,
      details: {
        slotIndex,
        playerId,
      },
    })
  }

  /** Remove a player from all slots in a game (e.g. when marked absent) */
  function unassignPlayerFromGame(gameId, playerId) {
    const game = games.value[gameId]
    if (!game) return
    let changed = false
    for (const slot of game.slots) {
      if (slot.playerId === playerId) {
        slot.playerId = null
        changed = true
      }
    }
    if (changed) {
      persist(gameId)
      void writeAuditLog({
        action: 'update',
        entityType: 'game',
        entityId: gameId,
        summary: `Игрок снят со всех слотов ${gameId}`,
        details: { playerId },
      })
    }
  }

  function updateSlot(gameId, slotIndex, updates) {
    const game = games.value[gameId]
    if (!game || !game.slots[slotIndex]) return
    Object.assign(game.slots[slotIndex], updates)
    // Auto-derive optics from equipment
    const eq = game.slots[slotIndex].equipment || []
    game.slots[slotIndex].optics = eq.includes('Оптика')
    persist(gameId)
    void writeAuditLog({
      action: 'update',
      entityType: 'game',
      entityId: gameId,
      summary: `Обновлен слот ${gameId}`,
      details: {
        slotIndex,
        updates,
      },
    })
  }

  function setTask(gameId, task) {
    const existed = !!games.value[gameId]
    if (!games.value[gameId]) {
      games.value[gameId] = { schedule: gameId, date: '', sourceUrl: '', version: '', slots: [], task: '' }
    }
    games.value[gameId].task = task
    persist(gameId)
    void writeAuditLog({
      action: existed ? 'update' : 'create',
      entityType: 'game',
      entityId: gameId,
      summary: `${existed ? 'Обновлена' : 'Создана'} задача игры ${gameId}`,
      details: {
        taskLength: String(task || '').length,
      },
    })
  }

  // --- Slot Requests ---

  function getSlotRequests(gameId) {
    return games.value[gameId]?.slotRequests || []
  }

  function addSlotRequest(gameId, { playerId, slots, text }) {
    const existed = !!games.value[gameId]
    if (!games.value[gameId]) {
      games.value[gameId] = { schedule: gameId, date: '', sourceUrl: '', version: '', slots: [], task: '' }
    }
    if (!games.value[gameId].slotRequests) games.value[gameId].slotRequests = []
    // Replace existing request from same player
    const idx = games.value[gameId].slotRequests.findIndex(r => r.playerId === playerId)
    const request = { playerId, slots, text, createdAt: new Date().toISOString() }
    if (idx !== -1) {
      games.value[gameId].slotRequests[idx] = request
    } else {
      games.value[gameId].slotRequests.push(request)
    }
    persist(gameId)
    void writeAuditLog({
      action: existed ? 'update' : 'create',
      entityType: 'slot_request',
      entityId: `${gameId}:${playerId}`,
      summary: `Обновлен запрос слота ${gameId}`,
      details: {
        gameId,
        playerId,
        slots,
        text,
      },
    })
  }

  function removeSlotRequest(gameId, index) {
    if (!games.value[gameId]?.slotRequests) return
    const request = games.value[gameId].slotRequests[index]
    games.value[gameId].slotRequests.splice(index, 1)
    persist(gameId)
    void writeAuditLog({
      action: 'delete',
      entityType: 'slot_request',
      entityId: `${gameId}:${request?.playerId || index}`,
      summary: `Удален запрос слота ${gameId}`,
      details: request || { index },
    })
  }

  function setGameMeta(gameId, { date, sourceUrl, version }) {
    const existed = !!games.value[gameId]
    if (!games.value[gameId]) {
      games.value[gameId] = { schedule: gameId, date: '', sourceUrl: '', version: '', slots: [], task: '' }
    }
    if (date !== undefined) games.value[gameId].date = date
    if (sourceUrl !== undefined) games.value[gameId].sourceUrl = sourceUrl
    if (version !== undefined) games.value[gameId].version = version
    persist(gameId)
    void writeAuditLog({
      action: existed ? 'update' : 'create',
      entityType: 'game',
      entityId: gameId,
      summary: `${existed ? 'Обновлены' : 'Созданы'} метаданные игры ${gameId}`,
      details: { date, sourceUrl, version },
    })
  }

  // --- Persist helper ---
  function persist(gameId) {
    saveGameFirestore(gameId, games.value[gameId])
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
    await deleteDoc(doc(db, 'games', gameId)).catch(() => {})
    delete games.value[gameId]
    delete slotMemory.value[gameId]
    await writeAuditLog({
      action: 'delete',
      entityType: 'game',
      entityId: gameId,
      summary: `Удалена игра ${gameId}`,
    })
  }

  /** Clear all games (new week reset) */
  async function clearGames() {
    const { doc, deleteDoc, db } = await import('../firebase/firestore')
    await Promise.all(GAME_IDS.map(id => deleteDoc(doc(db, 'games', id)).catch(() => {})))
    games.value = {}
    slotMemory.value = {}
    await writeAuditLog({
      action: 'delete',
      entityType: 'game',
      entityId: 'all-current-games',
      summary: 'Удалены все текущие игры недели',
      details: { gameIds: GAME_IDS },
    })
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
