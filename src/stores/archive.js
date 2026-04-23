import { defineStore } from 'pinia'
import { ref } from 'vue'
import { GAME_IDS } from '../utils/constants'
import { useGamesStore } from './games'
import { useAttendanceStore } from './attendance'
import { useMissionsStore } from './missions'
import { buildGameDateMap, getResolvedGameDates, normalizeDate } from '../utils/gameDates'

const GAME_ORDER = GAME_IDS.reduce((acc, gameId, index) => {
  acc[gameId] = index
  return acc
}, {})

function getEntryKey(date, schedule) {
  return `${normalizeDate(date)}::${schedule || ''}`
}

function compareEntriesByDateDesc(a, b) {
  const dateDiff = (normalizeDate(b.date) || '').localeCompare(normalizeDate(a.date) || '')
  if (dateDiff !== 0) return dateDiff
  return (GAME_ORDER[a.schedule] ?? 99) - (GAME_ORDER[b.schedule] ?? 99)
}

function matchesSlotLocator(slot, slotLocator) {
  if (slot.playerId && slotLocator.playerId && slot.playerId === slotLocator.playerId) return true

  return slot.side === slotLocator.side &&
    slot.squad === slotLocator.squad &&
    slot.number === slotLocator.number &&
    slot.name === slotLocator.name
}

export const useArchiveStore = defineStore('archive', () => {
  const archives = ref([])  // [{ id, rotation, server, side, date, schedule, slots, records, ... }]
  const rotations = ref([]) // [{ id, name, startDate, endDate }]
  const loading = ref(false)

  // --- Firestore ---
  async function loadFirestore() {
    const { archiveRef, rotationsRef, getDocs } = await import('../firebase/firestore')
    const [archSnap, rotSnap] = await Promise.all([
      getDocs(archiveRef),
      getDocs(rotationsRef),
    ])
    archives.value = archSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    rotations.value = rotSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  // --- Public API ---
  async function fetchArchives() {
    loading.value = true
    try {
      await loadFirestore()
    } finally {
      loading.value = false
    }
  }

  // --- Rotation status (computed from dates) ---
  function getRotationStatus(rotation) {
    const today = new Date().toISOString().slice(0, 10)
    const start = rotation.startDate || ''
    const end = rotation.endDate || ''

    if (start && today < start) return 'upcoming'
    if (end && today > end) return 'past'
    return 'active'
  }

  function getActiveRotation() {
    return rotations.value.find(r => getRotationStatus(r) === 'active') || null
  }

  function getRotationForDate(dateStr) {
    const d = normalizeDate(dateStr)
    if (!d) return getActiveRotation()
    return rotations.value.find(r => {
      if (!r.startDate || d < r.startDate) return false
      if (r.endDate && d > r.endDate) return false
      return true
    }) || getActiveRotation()
  }

  // --- Rotation CRUD ---
  async function createRotation(name, startDate, endDate = null) {
    const id = `rotation-${Date.now()}`
    const rotation = { id, name, startDate, endDate }
    rotations.value.push(rotation)

    const { doc, setDoc, db } = await import('../firebase/firestore')
    await setDoc(doc(db, 'rotations', id), rotation)
    return rotation
  }

  async function updateRotation(rotationId, updates) {
    const rotation = rotations.value.find(r => r.id === rotationId)
    if (!rotation) return
    Object.assign(rotation, updates)

    const { doc, updateDoc, db } = await import('../firebase/firestore')
    await updateDoc(doc(db, 'rotations', rotationId), updates)
  }

  async function deleteRotation(rotationId) {
    const { doc, deleteDoc, db } = await import('../firebase/firestore')
    await deleteDoc(doc(db, 'rotations', rotationId))
    rotations.value = rotations.value.filter(r => r.id !== rotationId)
  }

  // --- Archiving ---

  /**
   * Archive a single game: copy slots from games store + records from attendance store → archive.
   * @param {object} params — { schedule, date, sourceUrl, version, server, side, slots, records, task, missionTitle, adminUid }
   */
  async function archiveGame({ schedule, date, sourceUrl, version, server, side, slots, records, task, missionTitle, adminUid }) {
    const rotation = date ? getRotationForDate(date) : getActiveRotation()
    const id = `${date}-${schedule}`

    // Prevent duplicate archive
    if (archives.value.some(a => a.id === id)) {
      console.warn(`Archive ${id} already exists, skipping`)
      return null
    }

    const entry = {
      id,
      rotation: rotation?.id || '',
      server: server || '',
      side: side || '',
      date,
      schedule,
      sourceUrl: sourceUrl || '',
      version: version || '',
      slots: slots || [],
      records: records || [],
      task: task || '',
      missionTitle: missionTitle || '',
      archivedAt: new Date().toISOString(),
      archivedBy: adminUid,
    }

    const { doc, setDoc, serverTimestamp, db } = await import('../firebase/firestore')
    await setDoc(doc(db, 'archive', id), { ...entry, archivedAt: serverTimestamp() })

    archives.value.push(entry)
    return entry
  }

  function buildComparisonEntries({ players = [], rotationId = 'all' } = {}) {
    const archiveEntries = archives.value
      .filter(entry => rotationId === 'all' || entry.rotation === rotationId)
      .map(entry => ({ ...entry, isLive: false }))

    const archivedKeys = new Set(archives.value.map(entry => getEntryKey(entry.date, entry.schedule)))

    const liveEntries = []
    const activeRotation = getActiveRotation()
    const gamesStore = useGamesStore()
    const attendanceStore = useAttendanceStore()
    const missionsStore = useMissionsStore()
    const resolvedDates = buildGameDateMap(getResolvedGameDates({
      now: new Date(),
      gamesById: gamesStore.games,
      attendanceById: attendanceStore.attendance,
      archives: archives.value,
    }))

    for (const gameId of GAME_IDS) {
      const game = gamesStore.getGame(gameId)
      const resolvedDate = game?.date || attendanceStore.getGameAttendance(gameId)?.date || resolvedDates[gameId] || ''
      const key = getEntryKey(resolvedDate, gameId)
      if (archivedKeys.has(key)) continue

      const rotation = getRotationForDate(resolvedDate) || activeRotation
      if (rotationId !== 'all' && rotation?.id !== rotationId) continue

      liveEntries.push({
        id: `live-${gameId}`,
        rotation: rotation?.id || '',
        server: game?.server || '',
        side: game?.side || '',
        date: resolvedDate,
        schedule: gameId,
        sourceUrl: game?.sourceUrl || '',
        version: game?.version || '',
        slots: (game?.slots || []).map(slot => ({ ...slot })),
        records: players.map(player => ({
          playerId: player.uid,
          attendance: attendanceStore.getPlayerAttendance(gameId, player.uid),
        })),
        task: game?.task || '',
        missionTitle: missionsStore.getMission(gameId)?.title || '',
        isLive: true,
      })
    }

    return [...archiveEntries, ...liveEntries].sort(compareEntriesByDateDesc)
  }

  // --- Query helpers ---

  /** Get all archive entries for a player (by playerId in slots or records) */
  function getPlayerHistory(playerId) {
    return archives.value
      .filter(a =>
        a.slots?.some(s => s.playerId === playerId) ||
        a.records?.some(r => r.playerId === playerId),
      )
      .sort(compareEntriesByDateDesc)
  }

  /** Get player's slot from an archive entry */
  function getPlayerSlotInArchive(archiveEntry, playerId) {
    return archiveEntry.slots?.find(s => s.playerId === playerId) || null
  }

  // --- Attendance stats (computed from archive) ---

  function getPlayerAttendanceStats(playerId, rotationId = null) {
    const relevant = rotationId
      ? archives.value.filter(a => a.rotation === rotationId)
      : archives.value

    let total = 0
    let confirmed = 0

    for (const entry of relevant) {
      const record = entry.records?.find(r => r.playerId === playerId)
      if (record && record.attendance !== 'no_response') {
        total++
        if (record.attendance === 'confirmed') confirmed++
      }
    }

    return {
      totalGames: total,
      attendedGames: confirmed,
      attendanceRate: total > 0 ? confirmed / total : 0,
    }
  }

  // --- Optics stats (computed from archive) ---

  function getPlayerOpticsStats(playerId, rotationId = null) {
    const relevant = rotationId
      ? archives.value.filter(a => a.rotation === rotationId)
      : archives.value

    let gamesPlayed = 0
    let gamesWithOptics = 0

    for (const entry of relevant) {
      const slot = entry.slots?.find(s => s.playerId === playerId)
      if (slot) {
        gamesPlayed++
        if (slot.optics) gamesWithOptics++
      }
    }

    return {
      gamesPlayed,
      gamesWithOptics,
      opticsRate: gamesPlayed > 0 ? gamesWithOptics / gamesPlayed : 0,
    }
  }

  async function updateArchiveAttendance(archiveId, playerId, status) {
    const archiveIndex = archives.value.findIndex(entry => entry.id === archiveId)
    if (archiveIndex === -1) return

    const entry = archives.value[archiveIndex]
    const nextRecords = [...(entry.records || [])]
    const recordIndex = nextRecords.findIndex(record => record.playerId === playerId)

    if (status === 'no_response') {
      if (recordIndex !== -1) nextRecords.splice(recordIndex, 1)
    } else if (recordIndex === -1) {
      nextRecords.push({ playerId, attendance: status })
    } else {
      nextRecords[recordIndex] = { ...nextRecords[recordIndex], attendance: status }
    }

    const nextSlots = (entry.slots || []).map(slot =>
      slot.playerId === playerId && status !== 'confirmed'
        ? { ...slot, optics: false }
        : slot,
    )

    const { doc, updateDoc, db } = await import('../firebase/firestore')
    await updateDoc(doc(db, 'archive', archiveId), {
      records: nextRecords,
      slots: nextSlots,
    })
    archives.value[archiveIndex] = { ...entry, records: nextRecords, slots: nextSlots }
  }

  async function updateArchiveSlotOptics(archiveId, slotLocator, optics) {
    const archiveIndex = archives.value.findIndex(entry => entry.id === archiveId)
    if (archiveIndex === -1) return

    const entry = archives.value[archiveIndex]
    let matched = false
    const nextSlots = (entry.slots || []).map(slot => {
      if (matchesSlotLocator(slot, slotLocator)) {
        matched = true
        return { ...slot, optics }
      }
      return slot
    })

    if (!matched) return

    const { doc, updateDoc, db } = await import('../firebase/firestore')
    await updateDoc(doc(db, 'archive', archiveId), { slots: nextSlots })
    archives.value[archiveIndex] = { ...entry, slots: nextSlots }
  }

  return {
    archives, rotations, loading,
    fetchArchives, getRotationStatus, getActiveRotation, getRotationForDate,
    createRotation, updateRotation, deleteRotation,
    archiveGame,
    buildComparisonEntries,
    getPlayerHistory, getPlayerSlotInArchive,
    getPlayerAttendanceStats, getPlayerOpticsStats,
    updateArchiveAttendance, updateArchiveSlotOptics,
  }
})
