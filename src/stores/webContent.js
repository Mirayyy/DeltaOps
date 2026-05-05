import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { cloneForAudit, logEntitySnapshot } from '../utils/auditLog'

let _awardIdCounter = 0
function ensureAwardId(award) {
  if (!award._id) award._id = `award-${Date.now()}-${_awardIdCounter++}`
  if (!award.type) award.type = 'squad'
  if (award.playerUid === undefined) award.playerUid = null
  if (award.showOnLanding === undefined) award.showOnLanding = true
  return award
}

export const useWebContentStore = defineStore('webContent', () => {
  const awards = ref([])
  const aboutMarkdown = ref('')
  const loading = ref(false)
  const persistedSnapshot = ref({
    awards: [],
    aboutMarkdown: '',
  })

  // --- Computed filters ---
  const landingAwards = computed(() =>
    awards.value.filter(a => a.showOnLanding)
  )

  function getPlayerAwards(playerUid) {
    return awards.value.filter(a => a.type === 'player' && a.playerUid === playerUid)
  }

  const squadAwards = computed(() =>
    awards.value.filter(a => a.type === 'squad')
  )

  function cleanAwards() {
    return awards.value.map(({ _id, ...rest }) => rest)
  }

  // --- Firestore (reads/writes config/squad) ---
  async function loadFirestore() {
    const { getDoc, squadConfigRef } = await import('../firebase/firestore')
    const snap = await getDoc(squadConfigRef)
    if (snap.exists()) {
      const data = snap.data()
      awards.value = (data.awards || []).map(ensureAwardId)
      aboutMarkdown.value = data.aboutMarkdown || ''
      persistedSnapshot.value = {
        awards: cloneForAudit(data.awards || []),
        aboutMarkdown: cloneForAudit(data.aboutMarkdown || ''),
      }
    }
  }

  async function saveFirestore() {
    const { setDoc, squadConfigRef } = await import('../firebase/firestore')
    await setDoc(squadConfigRef, {
      awards: cleanAwards(),
      aboutMarkdown: aboutMarkdown.value,
    }, { merge: true })
  }

  // --- Public API ---
  async function fetchContent() {
    loading.value = true
    try {
      await loadFirestore()
    } catch (e) {
      console.warn('webContent fetch error:', e)
    } finally {
      loading.value = false
    }
  }

  async function saveContent() {
    const before = cloneForAudit(persistedSnapshot.value)
    const after = {
      awards: cleanAwards(),
      aboutMarkdown: aboutMarkdown.value,
    }
    await saveFirestore()
    persistedSnapshot.value = cloneForAudit(after)
    await logEntitySnapshot({
      entityType: 'config',
      entityId: 'web-content',
      before,
      after,
      summary: 'config - update - web-content',
      metadata: {
        operation: 'save-web-content',
      },
    })
  }

  // --- Award CRUD ---
  function addAward() {
    awards.value.push(ensureAwardId({
      icon: '', title: '', description: '',
      type: 'squad', playerUid: null, showOnLanding: true,
    }))
  }

  function removeAward(index) {
    awards.value.splice(index, 1)
  }

  async function moveAward(index, direction) {
    const target = index + direction
    if (target < 0 || target >= awards.value.length) return
    const arr = [...awards.value]
    ;[arr[index], arr[target]] = [arr[target], arr[index]]
    awards.value = arr
    await saveContent()
  }

  return {
    awards, aboutMarkdown, loading,
    landingAwards, squadAwards, getPlayerAwards,
    fetchContent, saveContent,
    addAward, removeAward, moveAward,
  }
})
