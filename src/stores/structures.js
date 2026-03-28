import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isFirebaseConfigured } from '../firebase/config'

const DEMO_STRUCTURES = [
  {
    id: 'struct-default',
    name: 'Стандартная структура',
    slots: [
      { slotNumber: 1, section: '1-3', slotId: '1-3', roleName: 'Отделение 1-3', type: 'КО', equipment: ['Бинокль', 'ДВ', 'GPS'] },
      { slotNumber: 2, section: '1-3', slotId: '1-3 1', roleName: 'Командир группы 1', type: '', equipment: [] },
      { slotNumber: 3, section: '1-3', slotId: '1-3 2', roleName: 'Стрелок', type: '', equipment: [] },
      { slotNumber: 4, section: '1-3', slotId: '1-3 3', roleName: 'Стрелок', type: '', equipment: ['Оптика'] },
      { slotNumber: 5, section: '1-3', slotId: '1-3 4', roleName: 'Гранатомётчик', type: '', equipment: [] },
      { slotNumber: 6, section: '1-3', slotId: '1-3 5', roleName: 'Пулемётчик', type: '', equipment: [] },
      { slotNumber: 7, section: '1-3', slotId: '1-3 6', roleName: 'Медик', type: '', equipment: [] },
      { slotNumber: 8, section: '2-3', slotId: '2-3', roleName: 'Отделение 2-3', type: 'КО', equipment: ['Бинокль', 'ДВ'] },
      { slotNumber: 9, section: '2-3', slotId: '2-3 1', roleName: 'Командир группы 2', type: '', equipment: [] },
      { slotNumber: 10, section: '2-3', slotId: '2-3 2', roleName: 'Стрелок', type: '', equipment: [] },
      { slotNumber: 11, section: '2-3', slotId: '2-3 3', roleName: 'Стрелок', type: '', equipment: ['Оптика'] },
      { slotNumber: 12, section: '2-3', slotId: '2-3 4', roleName: 'Снайпер', type: '', equipment: ['Оптика'] },
      { slotNumber: 13, section: '2-3', slotId: '2-3 5', roleName: 'Сапер', type: '', equipment: ['Минка'] },
      { slotNumber: 14, section: '2-3', slotId: '2-3 6', roleName: 'Медик', type: '', equipment: [] },
      { slotNumber: 15, section: 'Техника', slotId: 'Техника', roleName: 'Техника', type: 'КО', equipment: [] },
      { slotNumber: 16, section: 'Техника', slotId: 'Техника 1', roleName: 'Водитель БМП', type: '', equipment: [] },
      { slotNumber: 17, section: 'Техника', slotId: 'Техника 2', roleName: 'Наводчик БМП', type: '', equipment: [] },
    ],
  },
]

/**
 * Auto-generates slotId from section headers and row positions.
 * Replicates the fillStructure() logic from Google Sheets.
 */
export function generateSlotIds(slots) {
  let currentSection = ''
  let counter = 0

  return slots.map(slot => {
    // Section header: type === 'КО' or first in new section
    if (slot.type === 'КО') {
      currentSection = slot.section
      counter = 0
      return { ...slot, slotId: currentSection }
    }

    if (currentSection) {
      counter++
      return { ...slot, slotId: `${currentSection} ${counter}`, section: currentSection }
    }

    return { ...slot, slotId: '' }
  })
}

export const useStructuresStore = defineStore('structures', () => {
  const structures = ref([])
  const loading = ref(false)

  // --- Demo / localStorage ---
  function loadDemo() {
    const saved = localStorage.getItem('deltaops_structures')
    structures.value = saved ? JSON.parse(saved) : DEMO_STRUCTURES.map(s => ({ ...s }))
  }

  function saveDemo() {
    localStorage.setItem('deltaops_structures', JSON.stringify(structures.value))
  }

  // --- Firestore ---
  async function loadFirestore() {
    const { structuresRef, getDocs } = await import('../firebase/firestore')
    const snapshot = await getDocs(structuresRef)
    structures.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  }

  async function saveStructureFirestore(structure) {
    const { doc, setDoc, serverTimestamp, db } = await import('../firebase/firestore')
    const ref = doc(db, 'structures', structure.id)
    await setDoc(ref, { ...structure, updatedAt: serverTimestamp() })
  }

  async function deleteStructureFirestore(id) {
    const { doc, deleteDoc, db } = await import('../firebase/firestore')
    await deleteDoc(doc(db, 'structures', id))
  }

  // --- Public API ---
  async function fetchStructures() {
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

  function getStructure(id) {
    return structures.value.find(s => s.id === id) || null
  }

  async function saveStructure(structure) {
    const idx = structures.value.findIndex(s => s.id === structure.id)
    // Regenerate slot IDs
    structure.slots = generateSlotIds(structure.slots)

    if (idx === -1) {
      structures.value.push(structure)
    } else {
      structures.value[idx] = structure
    }

    if (isFirebaseConfigured) {
      await saveStructureFirestore(structure)
    } else {
      saveDemo()
    }
  }

  async function deleteStructure(id) {
    structures.value = structures.value.filter(s => s.id !== id)
    if (isFirebaseConfigured) {
      await deleteStructureFirestore(id)
    } else {
      saveDemo()
    }
  }

  return {
    structures, loading,
    fetchStructures, getStructure, saveStructure, deleteStructure,
  }
})
