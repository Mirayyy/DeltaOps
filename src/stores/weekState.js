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
import { getDefaultWeekDates, getFrozenWeekDates } from '../utils/gameWeek'
import { auditedWrite, cloneForAudit } from '../utils/auditLog'

function normalizeWeek(data) {
  if (!data?.weekId || !data?.friday || !data?.saturday) return null
  return {
    weekId: data.weekId,
    friday: data.friday,
    saturday: data.saturday,
    source: data.source || 'attendance',
  }
}

function buildLockedWeek(source, resolveDates = getDefaultWeekDates, now = new Date()) {
  const dates = resolveDates(now)
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

  async function saveLockedWeek(week, audit = {}) {
    await auditedWrite({ ...audit, action: 'create', eventType: 'week.locked', entityType: 'week',
      entityId: week.weekId, before: null, after: week, metadata: { automatic: true },
    }, () => setDoc(weekConfigRef, {
      ...week,
      lockedAt: serverTimestamp(),
    }, { merge: true }))
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
          const week = buildLockedWeek('bootstrap', getFrozenWeekDates)
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

  async function ensureLockedForAttendance(audit = {}) {
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
      await saveLockedWeek(week, audit)
      lockedWeek.value = week
      return week
    } finally {
      loaded.value = true
      loading.value = false
    }
  }

  async function clearLockedWeek(audit = {}) {
    loading.value = true
    try {
      const before = cloneForAudit(lockedWeek.value)
      await auditedWrite({ ...audit, action: 'delete', eventType: 'week.unlocked', entityType: 'week',
        entityId: before?.weekId || 'current', before, after: null,
      }, () => deleteDoc(weekConfigRef))
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
