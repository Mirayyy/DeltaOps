import { defineStore } from 'pinia'
import { ref } from 'vue'
import { GAME_IDS } from '../utils/constants'
import { cloneForAudit, logEntitySnapshot } from '../utils/auditLog'
import { useAppConfig } from './appConfig'
import { useAuthStore } from './auth'
import { useMissionsStore } from './missions'
import { useRosterStore } from './roster'
import { useTelegram } from '../composables/useTelegram'

export const useGamesStore = defineStore('games', () => {
  // { [gameId]: { schedule, date, sourceUrl, version, slots[], task, updatedAt, updatedBy } }
  const games = ref({})
  const slotRequests = ref({})
  const loading = ref(false)
  const appConfig = useAppConfig()
  const auth = useAuthStore()
  const missionsStore = useMissionsStore()
  const roster = useRosterStore()
  const telegram = useTelegram()

  // Slot memory: when a slot is removed and re-added, its data persists
  const slotMemory = ref({}) // { [gameId]: { [slotKey]: slotData } }

  function normalizeSlotRequest(request = {}) {
    const slots = Array.isArray(request.slots)
      ? request.slots
          .map(slot => ({
            side: slot.side || '',
            squad: slot.squad || '',
            number: Number(slot.number) || 0,
            name: slot.name || '',
          }))
          .sort((left, right) =>
            `${left.side}::${left.squad}::${left.number}::${left.name}`.localeCompare(
              `${right.side}::${right.squad}::${right.number}::${right.name}`,
              'ru'
            )
          )
      : []

    return {
      text: String(request.text || '').trim(),
      slots,
    }
  }

  function isSlotRequestChanged(previous, next) {
    if (!previous) return true
    return JSON.stringify(normalizeSlotRequest(previous)) !== JSON.stringify(normalizeSlotRequest(next))
  }

  async function notifyLineupResponsibles(gameId, request, previousRequest) {
    if (!telegram.isConfigured) return

    if (!appConfig.loaded) {
      await appConfig.fetch()
    }
    if (!roster.players.length) {
      await roster.fetchPlayers()
    }
    if (!missionsStore.getMission(gameId)) {
      await missionsStore.fetchMissions()
    }

    const responsibleIds = Array.isArray(appConfig.config.lineupResponsibleIds)
      ? [...new Set(appConfig.config.lineupResponsibleIds.filter(Boolean))]
      : []
    if (!responsibleIds.length) return

    const actorPlayerId = auth.player?.uid || null
    const recipientIds = responsibleIds.filter(playerId => playerId !== actorPlayerId)
    if (!recipientIds.length) return

    const mission = missionsStore.getMission(gameId)
    const requesterName = roster.resolveNickname(request.playerId)
    const actorName = actorPlayerId ? roster.resolveNickname(actorPlayerId) : ''
    const message = telegram.buildLineupRequestNotification({
      gameId,
      gameDate: games.value[gameId]?.date || '',
      missionTitle: mission?.title || '',
      requesterName,
      actorName,
      slots: request.slots || [],
      text: request.text || '',
      isUpdate: Boolean(previousRequest),
    })

    for (const responsibleId of recipientIds) {
      const responsiblePlayer = roster.getPlayer(responsibleId)
      const responsibleTelegramId = responsiblePlayer?.telegramId
      if (!responsibleTelegramId) continue

      const result = await telegram.sendMessage(message, { chatId: responsibleTelegramId })
      if (!result.ok) {
        console.warn(`Failed to notify lineup responsible ${responsibleId}:`, result.error)
      }
    }
  }

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
    const { onSnapshot, gamesRef, slotRequestsRef } = await import('../firebase/firestore')

    const unsub = onSnapshot(gamesRef, (snapshot) => {
      const data = {}
      snapshot.docs.forEach(d => { data[d.id] = d.data() })
      games.value = data
    })
    unsubscribes.push(unsub)

    const requestsUnsub = onSnapshot(slotRequestsRef, (snapshot) => {
      const data = {}
      snapshot.docs.forEach((docSnap) => {
        const request = { id: docSnap.id, ...docSnap.data() }
        if (!request.gameId) return
        if (!data[request.gameId]) data[request.gameId] = []
        data[request.gameId].push(request)
      })

      Object.values(data).forEach((items) => {
        items.sort((a, b) => {
          const left = typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : 0
          const right = typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : 0
          return left - right
        })
      })

      slotRequests.value = data
    })
    unsubscribes.push(requestsUnsub)
  }

  async function saveGameFirestore(gameId, data) {
    const { doc, setDoc, serverTimestamp, db } = await import('../firebase/firestore')
    await setDoc(doc(db, 'games', gameId), { ...data, updatedAt: serverTimestamp() }, { merge: true })
  }

  function buildSlotRequestId(gameId, playerId) {
    return `${gameId}__${playerId}`
  }

  async function saveSlotRequestFirestore(gameId, playerId, data) {
    const { doc, setDoc, serverTimestamp, db } = await import('../firebase/firestore')
    const createdAt = data.createdAt || serverTimestamp()
    await setDoc(doc(db, 'slotRequests', buildSlotRequestId(gameId, playerId)), {
      ...data,
      gameId,
      playerId,
      createdAt,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }

  async function deleteSlotRequestFirestore(requestId) {
    const { doc, deleteDoc, db } = await import('../firebase/firestore')
    await deleteDoc(doc(db, 'slotRequests', requestId))
  }

  async function deleteSlotRequestsForGames(gameIds) {
    if (!gameIds.length) return

    const { getDocs, slotRequestsRef } = await import('../firebase/firestore')
    const snapshot = await getDocs(slotRequestsRef)
    const staleRequests = snapshot.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      .filter(request => gameIds.includes(request.gameId))

    await Promise.all(staleRequests.map(request => deleteSlotRequestFirestore(request.id)))
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
    return slotRequests.value[gameId]?.length
      ? slotRequests.value[gameId]
      : (games.value[gameId]?.slotRequests || [])
  }

  async function addSlotRequest(gameId, { playerId, slots, text }) {
    const before = cloneForAudit(getSlotRequests(gameId).find(r => r.playerId === playerId) || null)
    const request = {
      gameId,
      playerId,
      slots,
      text,
      createdAt: before?.createdAt || null,
    }

    const changed = isSlotRequestChanged(before, request)

    await saveSlotRequestFirestore(gameId, playerId, request)
    if (changed) {
      await notifyLineupResponsibles(gameId, request, before)
    }
    await logEntitySnapshot({
      entityType: 'slotRequests',
      entityId: buildSlotRequestId(gameId, playerId),
      before,
      after: request,
      summary: `slotRequests - ${before ? 'update' : 'create'} - ${buildSlotRequestId(gameId, playerId)}`,
      metadata: {
        operation: 'set-slot-request',
        playerId,
        gameId,
      },
    })
  }

  async function removeSlotRequest(gameId, requestIdOrIndex) {
    const request = typeof requestIdOrIndex === 'number'
      ? getSlotRequests(gameId)[requestIdOrIndex]
      : getSlotRequests(gameId).find(item => item.id === requestIdOrIndex)

    if (!request) return

    if (!request.id) {
      if (!games.value[gameId]?.slotRequests) return
      const before = cloneForAudit(games.value[gameId])
      games.value[gameId].slotRequests.splice(requestIdOrIndex, 1)
      await persist(gameId, {
        before,
        summary: `games - update - ${gameId}`,
        metadata: {
          operation: 'remove-slot-request-legacy',
          index: requestIdOrIndex,
        },
      })
      return
    }

    const before = cloneForAudit(request)
    await deleteSlotRequestFirestore(request.id)
    await logEntitySnapshot({
      entityType: 'slotRequests',
      entityId: request.id,
      before,
      after: null,
      summary: `slotRequests - delete - ${request.id}`,
      metadata: {
        operation: 'remove-slot-request',
        gameId,
        playerId: request.playerId,
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
    await deleteSlotRequestsForGames([gameId])
    delete games.value[gameId]
    delete slotRequests.value[gameId]
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
    await deleteSlotRequestsForGames(GAME_IDS)
    games.value = {}
    slotRequests.value = {}
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
