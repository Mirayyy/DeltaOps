import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  attendanceRef,
  deleteDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  weekConfigRef,
} from '../firebase/firestore'
import { getFrozenWeekDates } from '../utils/gameWeek'

function normalizeWeek(data) {
  if (!data?.weekId || !data?.friday || !data?.saturday) return null
  return {
    weekId: data.weekId,
    friday: data.friday,
    saturday: data.saturday,
    source: data.source || 'attendance',
  }
}

function buildLockedWeek(source, now = new Date()) {
  const dates = getFrozenWeekDates(now)
  return {
    weekId: dates.weekId,
    friday: dates.friday,
    saturday: dates.saturday,
    source,
  }
}

async function hasAttendanceActivity() {
  const snapshot = await getDocs(attendanceRef)
  return snapshot.docs.some((docSnap) => {
    const records = docSnap.data()?.records
    return Array.isArray(records) && records.some(r => r?.attendance && r.attendance !== 'no_response')
  })
}

export const useWeekStateStore = defineStore('weekState', () => {
  const lockedWeek = ref(null)
  const loading = ref(false)
  const loaded = ref(false)

  let inFlight = null

  const hasLockedWeek = computed(() => !!lockedWeek.value)

  async function saveLockedWeek(week) {
    await setDoc(weekConfigRef, {
      ...week,
      lockedAt: serverTimestamp(),
    }, { merge: true })
  }

  async function fetchOrBootstrap() {
    if (inFlight) return inFlight

    inFlight = (async () => {
      loading.value = true
      try {
        const snap = await getDoc(weekConfigRef)
        if (snap.exists()) {
          lockedWeek.value = normalizeWeek(snap.data())
          return lockedWeek.value
        }

        const shouldBootstrap = await hasAttendanceActivity()
        if (shouldBootstrap) {
          const week = buildLockedWeek('bootstrap')
          await saveLockedWeek(week)
          lockedWeek.value = week
          return week
        }

        lockedWeek.value = null
        return null
      } finally {
        loaded.value = true
        loading.value = false
        inFlight = null
      }
    })()

    return inFlight
  }

  async function ensureLockedForAttendance() {
    if (lockedWeek.value) return lockedWeek.value
    if (inFlight) await inFlight
    if (lockedWeek.value) return lockedWeek.value

    loading.value = true
    try {
      const snap = await getDoc(weekConfigRef)
      if (snap.exists()) {
        lockedWeek.value = normalizeWeek(snap.data())
        return lockedWeek.value
      }

      const week = buildLockedWeek('attendance')
      await saveLockedWeek(week)
      lockedWeek.value = week
      return week
    } finally {
      loaded.value = true
      loading.value = false
    }
  }

  async function clearLockedWeek() {
    loading.value = true
    try {
      await deleteDoc(weekConfigRef).catch(() => {})
      lockedWeek.value = null
    } finally {
      loaded.value = true
      loading.value = false
    }
  }

  return {
    lockedWeek,
    loading,
    loaded,
    hasLockedWeek,
    fetchOrBootstrap,
    ensureLockedForAttendance,
    clearLockedWeek,
  }
})
