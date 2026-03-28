import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { isFirebaseConfigured } from '../firebase/config'

const DEMO_CONTENT = {
  awards: [
    {
      icon: 'https://stats.tsgames.ru/icons/d_mad.svg',
      title: 'Operation AR',
      description: 'За успешное проведение операции Абсолютная решимость',
      type: 'squad',
      playerUid: null,
      showOnLanding: true,
    },
    {
      icon: 'https://stats.tsgames.ru/icons/sqd-gold.svg',
      title: '1 место',
      description: '1 место в статистике Отрядов по результатам ротации Лето 25 — Зима 25',
      type: 'squad',
      playerUid: null,
      showOnLanding: true,
    },
    {
      icon: 'https://stats.tsgames.ru/icons/sqd-silver.svg',
      title: '2 место',
      description: '2 место в статистике Отрядов по результатам ротации Зима 24 — Лето 25',
      type: 'squad',
      playerUid: null,
      showOnLanding: true,
    },
  ],
  aboutMarkdown: `**DELTA** — отряд на проекте **TSG (Tushino Serious Games)**, платформа Arma 3.

Создан **17.12.2024**, участник проекта с **07.12.2025**.

Специализируемся на выполнении сложных боевых задач: СПН, БПЛА, спецрасчёты, бронетехника. Действуем автономно от основных сил стороны, что позволяет вносить максимальный вклад в победу. Каждая миссия разбирается заранее — готовимся к играм серьёзно.`,
}

const DOC_ID = 'landing'

let _awardIdCounter = 0
function ensureAwardId(award) {
  if (!award._id) award._id = `award-${Date.now()}-${_awardIdCounter++}`
  // Ensure new fields exist on legacy data
  if (!award.type) award.type = 'squad'
  if (award.playerUid === undefined) award.playerUid = null
  if (award.showOnLanding === undefined) award.showOnLanding = true
  return award
}

export const useWebContentStore = defineStore('webContent', () => {
  const awards = ref([])
  const aboutMarkdown = ref('')
  const loading = ref(false)

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

  // --- Demo ---
  function loadDemo() {
    const saved = localStorage.getItem('deltaops_webContent')
    if (saved) {
      const data = JSON.parse(saved)
      awards.value = (data.awards || []).map(ensureAwardId)
      aboutMarkdown.value = data.aboutMarkdown || ''
    } else {
      awards.value = DEMO_CONTENT.awards.map(a => ensureAwardId({ ...a }))
      aboutMarkdown.value = DEMO_CONTENT.aboutMarkdown
    }
  }

  function cleanAwards() {
    return awards.value.map(({ _id, ...rest }) => rest)
  }

  function saveDemo() {
    localStorage.setItem('deltaops_webContent', JSON.stringify({
      awards: cleanAwards(),
      aboutMarkdown: aboutMarkdown.value,
    }))
  }

  // --- Firestore ---
  async function loadFirestore() {
    const { doc, getDoc, db } = await import('../firebase/firestore')
    const snap = await getDoc(doc(db, 'webContent', DOC_ID))
    if (snap.exists()) {
      const data = snap.data()
      awards.value = (data.awards || []).map(ensureAwardId)
      aboutMarkdown.value = data.aboutMarkdown || ''
    } else {
      awards.value = DEMO_CONTENT.awards.map(a => ensureAwardId({ ...a }))
      aboutMarkdown.value = DEMO_CONTENT.aboutMarkdown
    }
  }

  async function saveFirestore() {
    const { doc, setDoc, db } = await import('../firebase/firestore')
    await setDoc(doc(db, 'webContent', DOC_ID), {
      awards: cleanAwards(),
      aboutMarkdown: aboutMarkdown.value,
    })
  }

  // --- Public API ---
  async function fetchContent() {
    loading.value = true
    try {
      if (isFirebaseConfigured) {
        await loadFirestore()
      } else {
        loadDemo()
      }
    } catch (e) {
      console.warn('webContent fetch error:', e)
      loadDemo()
    } finally {
      loading.value = false
    }
  }

  async function saveContent() {
    if (isFirebaseConfigured) {
      await saveFirestore()
    } else {
      saveDemo()
    }
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
