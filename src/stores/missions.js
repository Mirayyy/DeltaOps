import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { isFirebaseConfigured } from '../firebase/config'
import { GAME_IDS } from '../utils/constants'

const DEMO_MISSIONS = {
  friday_1: {
    title: 'Пальмира',
    map: 'Алтис',
    authors: ['Koreec'],
    version: '30',
    downloadLink: '',
    description: 'Освобождение древней части города от сил повстанцев. Штурмовая операция с применением тяжелой техники.',
    sidesRaw: 'НАПА: 102 (Атака) VS ЧДКЗ: 94 (Оборона)',
    additionalConditions: '',
    sourceUrl: 'https://tsgames.ru/missions/ss_Palmira',
    sides: [
      {
        name: 'Синие', color: 'blue', role: 'Атака', players: 102,
        vehicles: 'БМП-2 х4, Т-72Б х2, МТ-ЛБ х6',
        squads: [
          { name: 'Alpha-1-1', size: 11, slots: ['Командир отделения', 'Пулеметчик', 'Гренадер', 'Стрелок', 'Стрелок', 'Стрелок', 'Стрелок', 'Медик', 'Стрелок-помощник', 'Снайпер', 'Стрелок'] },
          { name: 'Alpha-1-2', size: 11, slots: ['Командир отделения', 'Пулеметчик', 'Гренадер', 'Стрелок', 'Стрелок', 'Стрелок', 'Стрелок', 'Медик', 'Стрелок-помощник', 'Снайпер', 'Стрелок'] },
          { name: 'Alpha-2-1', size: 9, slots: ['Командир отделения', 'Пулеметчик', 'Гренадер', 'Стрелок', 'Стрелок', 'Стрелок', 'Медик', 'Стрелок', 'Стрелок'] },
          { name: 'Alpha-2-2', size: 9, slots: ['Командир отделения', 'Пулеметчик', 'Гренадер', 'Стрелок', 'Стрелок', 'Стрелок', 'Медик', 'Стрелок', 'Стрелок'] },
          { name: 'Alpha-3-1', size: 3, slots: ['Командир экипажа', 'Наводчик', 'Водитель'] },
          { name: 'Alpha-3-2', size: 3, slots: ['Командир экипажа', 'Наводчик', 'Водитель'] },
          { name: 'Alpha-4-1', size: 3, slots: ['Оператор БПЛА', 'Оператор БПЛА', 'Охранение'] },
          { name: 'Alpha-HQ', size: 5, slots: ['Командир роты', 'Заместитель', 'Связист', 'Медик', 'Сапер'] },
        ],
        gallery: [],
      },
      {
        name: 'Красные', color: 'red', role: 'Оборона', players: 94,
        vehicles: 'Т-55 х2, БТР-80 х3, ЗУ-23-2 х2, ДШК х4',
        squads: [
          { name: 'Bravo-1-1', size: 11, slots: ['Командир отделения', 'Пулеметчик', 'Гренадер', 'Стрелок', 'Стрелок', 'Стрелок', 'Стрелок', 'Медик', 'Стрелок', 'Стрелок', 'Стрелок'] },
          { name: 'Bravo-1-2', size: 11, slots: ['Командир отделения', 'Пулеметчик', 'Гренадер', 'Стрелок', 'Стрелок', 'Стрелок', 'Стрелок', 'Медик', 'Стрелок', 'Стрелок', 'Стрелок'] },
          { name: 'Bravo-2-1', size: 9, slots: ['Командир отделения', 'Пулеметчик', 'Стрелок', 'Стрелок', 'Стрелок', 'Стрелок', 'Медик', 'Стрелок', 'Стрелок'] },
          { name: 'Bravo-HQ', size: 4, slots: ['Командир роты', 'Заместитель', 'Связист', 'Медик'] },
        ],
        gallery: [],
      },
    ],
    scrapedAt: '2026-03-27T06:28:27.551Z',
  },
  friday_2: {
    title: 'Two Waves',
    map: 'Стратис',
    authors: ['AleM'],
    version: '21',
    downloadLink: '',
    description: 'Две волны высадки на побережье. Морская пехота против укреплённых позиций.',
    sidesRaw: 'USMC: 98 (Неопределено) VS МП РФ: 98 (Неопределено)',
    additionalConditions: 'Время суток случайное',
    sourceUrl: 'https://tsgames.ru/missions/AM_Two_Waves',
    sides: [
      {
        name: 'Синие', color: 'blue', role: 'Неопределено', players: 98,
        vehicles: 'AAV-7 х4, LAV-25 х2, HMMWV х6',
        squads: [
          { name: 'Alpha-1-1', size: 11, slots: ['Squad Leader', 'Machine Gunner', 'Grenadier', 'Rifleman', 'Rifleman', 'Rifleman', 'Rifleman', 'Medic', 'Rifleman', 'Rifleman', 'Rifleman'] },
          { name: 'Alpha-1-2', size: 11, slots: ['Squad Leader', 'Machine Gunner', 'Grenadier', 'Rifleman', 'Rifleman', 'Rifleman', 'Rifleman', 'Medic', 'Rifleman', 'Rifleman', 'Rifleman'] },
          { name: 'Alpha-HQ', size: 4, slots: ['Company Commander', 'XO', 'RTO', 'Medic'] },
        ],
        gallery: [],
      },
      {
        name: 'Красные', color: 'red', role: 'Неопределено', players: 98,
        vehicles: 'БТР-80 х4, БРДМ-2 х3',
        squads: [
          { name: 'Bravo-1-1', size: 11, slots: ['Командир отделения', 'Пулеметчик', 'Гренадер', 'Стрелок', 'Стрелок', 'Стрелок', 'Стрелок', 'Медик', 'Стрелок', 'Стрелок', 'Стрелок'] },
          { name: 'Bravo-1-2', size: 11, slots: ['Командир отделения', 'Пулеметчик', 'Гренадер', 'Стрелок', 'Стрелок', 'Стрелок', 'Стрелок', 'Медик', 'Стрелок', 'Стрелок', 'Стрелок'] },
          { name: 'Bravo-HQ', size: 4, slots: ['Командир роты', 'Заместитель', 'Связист', 'Медик'] },
        ],
        gallery: [],
      },
    ],
    scrapedAt: '2026-03-26T18:00:00.000Z',
  },
  saturday_1: {
    title: 'Стервятники',
    map: 'Чернарусь (стар.)',
    authors: ['AleM'],
    version: '4',
    downloadLink: '',
    description: 'Крупномасштабная операция с тремя сторонами. Бои за контроль территории.',
    sidesRaw: 'Бойцы фронта «наср-а-ла»: 100 (Оборона) VS ВКС России: 10 + САА: 86 (Атака)',
    additionalConditions: 'Красные + Зеленые vs Синие',
    sourceUrl: 'https://tsgames.ru/missions/AM_Vultures',
    sides: [
      {
        name: 'Синие', color: 'blue', role: 'Оборона', players: 100,
        vehicles: 'Т-55 х3, Shilka х1, БТР-60 х6',
        squads: [
          { name: 'Alpha-1-1', size: 13, slots: ['Командир отделения', 'Пулеметчик', 'Пулеметчик', 'Гренадер', 'Стрелок', 'Стрелок', 'Стрелок', 'Стрелок', 'Стрелок', 'Медик', 'Стрелок', 'Стрелок', 'Стрелок'] },
          { name: 'Alpha-2-1', size: 13, slots: ['Командир отделения', 'Пулеметчик', 'Пулеметчик', 'Гренадер', 'Стрелок', 'Стрелок', 'Стрелок', 'Стрелок', 'Стрелок', 'Медик', 'Стрелок', 'Стрелок', 'Стрелок'] },
        ],
        gallery: [],
      },
      {
        name: 'Красные', color: 'red', role: 'Атака', players: 10,
        vehicles: 'Су-25 х2, Ка-52 х1',
        squads: [
          { name: 'Bravo-Air', size: 5, slots: ['Пилот', 'Пилот', 'Пилот', 'Оператор', 'Оператор'] },
        ],
        gallery: [],
      },
      {
        name: 'Зеленые', color: 'green', role: 'Атака', players: 86,
        vehicles: 'Т-72Б х2, БМП-2 х4, МТ-ЛБ х4',
        squads: [
          { name: 'Charlie-1-1', size: 11, slots: ['Командир отделения', 'Пулеметчик', 'Гренадер', 'Стрелок', 'Стрелок', 'Стрелок', 'Стрелок', 'Медик', 'Стрелок', 'Стрелок', 'Стрелок'] },
          { name: 'Charlie-1-2', size: 11, slots: ['Командир отделения', 'Пулеметчик', 'Гренадер', 'Стрелок', 'Стрелок', 'Стрелок', 'Стрелок', 'Медик', 'Стрелок', 'Стрелок', 'Стрелок'] },
          { name: 'Charlie-HQ', size: 4, slots: ['Командир роты', 'Заместитель', 'Связист', 'Медик'] },
        ],
        gallery: [],
      },
    ],
    scrapedAt: '2026-03-26T14:00:00.000Z',
  },
  saturday_2: null,
}

export const useMissionsStore = defineStore('missions', () => {
  const missions = ref({})
  const loading = ref(false)
  const error = ref(null)

  function getMission(gameId) {
    return missions.value[gameId] || null
  }

  const availableMissions = computed(() => {
    return Object.entries(missions.value)
      .filter(([, m]) => m != null)
      .map(([slot, m]) => ({ slot, ...m }))
  })

  function getMissionStats(mission) {
    if (!mission) return null
    const totalPlayers = mission.sides.reduce((sum, s) => sum + (s.players || 0), 0)
    const totalSquads = mission.sides.reduce((sum, s) => sum + (s.squads?.length || 0), 0)
    const hasVehicles = mission.sides.some(s => s.vehicles && s.vehicles.trim() !== '')
    return { totalPlayers, totalSquads, hasVehicles }
  }

  // --- Demo ---
  function loadDemo() {
    const saved = localStorage.getItem('deltaops_missions')
    missions.value = saved ? JSON.parse(saved) : { ...DEMO_MISSIONS }
  }

  // --- Firestore ---
  async function loadFirestore() {
    const { doc, getDoc, db } = await import('../firebase/firestore')
    const results = {}
    await Promise.all(GAME_IDS.map(async (gameId) => {
      try {
        const docRef = doc(db, 'missions', gameId)
        const snapshot = await getDoc(docRef)
        results[gameId] = snapshot.exists() ? snapshot.data() : null
      } catch (e) {
        console.warn(`Failed to fetch mission ${gameId}:`, e.message)
        results[gameId] = null
      }
    }))
    missions.value = results
  }

  // --- Public API ---
  async function fetchMissions() {
    loading.value = true
    error.value = null
    try {
      if (isFirebaseConfigured) {
        await loadFirestore()
      } else {
        loadDemo()
      }
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function refreshMissions() {
    await fetchMissions()
  }

  async function clearMission(gameId) {
    if (isFirebaseConfigured) {
      const { doc, deleteDoc, db } = await import('../firebase/firestore')
      await deleteDoc(doc(db, 'missions', gameId)).catch(() => {})
    }
    delete missions.value[gameId]
  }

  async function clearMissions() {
    if (!isFirebaseConfigured) {
      missions.value = {}
      return
    }
    const { doc, deleteDoc, db } = await import('../firebase/firestore')
    await Promise.all(GAME_IDS.map(async (gameId) => {
      try { await deleteDoc(doc(db, 'missions', gameId)) } catch (e) { /* ignore */ }
    }))
    missions.value = {}
  }

  return {
    missions, loading, error,
    getMission, availableMissions, getMissionStats,
    fetchMissions, refreshMissions, clearMission, clearMissions,
  }
})
