import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isFirebaseConfigured } from '../firebase/config'

export const useArchiveStore = defineStore('archive', () => {
  const archives = ref([])  // [{ id, rotation, server, side, date, schedule, slots, records, ... }]
  const rotations = ref([]) // [{ id, name, startDate, endDate }]
  const loading = ref(false)

  // --- Demo / localStorage ---
  function loadDemo() {
    const savedArchives = localStorage.getItem('deltaops_archive')
    archives.value = savedArchives ? JSON.parse(savedArchives) : []

    const savedRotations = localStorage.getItem('deltaops_rotations')
    rotations.value = savedRotations ? JSON.parse(savedRotations) : [
      { id: 'rotation-demo', name: 'Ротация 1', startDate: '2026-01-01', endDate: null },
    ]
  }

  function saveDemo() {
    localStorage.setItem('deltaops_archive', JSON.stringify(archives.value))
    localStorage.setItem('deltaops_rotations', JSON.stringify(rotations.value))
  }

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
      if (isFirebaseConfigured) {
        await loadFirestore()
      } else {
        loadDemo()
      }
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
    const d = dateStr.slice(0, 10)
    return rotations.value.find(r => {
      if (!r.startDate || d < r.startDate) return false
      if (r.endDate && d > r.endDate) return false
      return true
    }) || getActiveRotation()
  }

  // --- Rotation CRUD ---
  async function createRotation(name, startDate, endDate = null, server = '', side = '') {
    const id = `rotation-${Date.now()}`
    const rotation = { id, name, startDate, endDate, server, side }
    rotations.value.push(rotation)

    if (isFirebaseConfigured) {
      const { doc, setDoc, db } = await import('../firebase/firestore')
      await setDoc(doc(db, 'rotations', id), rotation)
    } else {
      saveDemo()
    }
    return rotation
  }

  async function updateRotation(rotationId, updates) {
    const rotation = rotations.value.find(r => r.id === rotationId)
    if (!rotation) return
    Object.assign(rotation, updates)

    if (isFirebaseConfigured) {
      const { doc, updateDoc, db } = await import('../firebase/firestore')
      await updateDoc(doc(db, 'rotations', rotationId), updates)
    } else {
      saveDemo()
    }
  }

  async function deleteRotation(rotationId) {
    if (isFirebaseConfigured) {
      const { doc, deleteDoc, db } = await import('../firebase/firestore')
      await deleteDoc(doc(db, 'rotations', rotationId))
    }
    rotations.value = rotations.value.filter(r => r.id !== rotationId)
    if (!isFirebaseConfigured) saveDemo()
  }

  // --- Archiving ---

  /**
   * Archive a single game: copy slots from games store + records from attendance store → archive.
   * @param {object} params — { schedule, date, sourceUrl, version, server, side, slots, records, task, adminUid }
   */
  async function archiveGame({ schedule, date, sourceUrl, version, server, side, slots, records, task, adminUid }) {
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
      archivedAt: new Date().toISOString(),
      archivedBy: adminUid,
    }

    if (isFirebaseConfigured) {
      const { doc, setDoc, serverTimestamp, db } = await import('../firebase/firestore')
      await setDoc(doc(db, 'archive', id), { ...entry, archivedAt: serverTimestamp() })
    }

    archives.value.push(entry)
    if (!isFirebaseConfigured) saveDemo()
    return entry
  }

  // --- Query helpers ---

  /** Get all archive entries for a player (by playerId in slots or records) */
  function getPlayerHistory(playerId) {
    return archives.value
      .filter(a =>
        a.slots?.some(s => s.playerId === playerId) ||
        a.records?.some(r => r.playerId === playerId),
      )
      .sort((a, b) => b.date.localeCompare(a.date))
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
      if (record) {
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

  return {
    archives, rotations, loading,
    fetchArchives, getRotationStatus, getActiveRotation, getRotationForDate,
    createRotation, updateRotation, deleteRotation,
    archiveGame,
    getPlayerHistory, getPlayerSlotInArchive,
    getPlayerAttendanceStats, getPlayerOpticsStats,
  }
})
