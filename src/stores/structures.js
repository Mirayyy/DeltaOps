import { defineStore } from 'pinia'
import { ref } from 'vue'

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
      await loadFirestore()
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

    await saveStructureFirestore(structure)
  }

  async function deleteStructure(id) {
    structures.value = structures.value.filter(s => s.id !== id)
    await deleteStructureFirestore(id)
  }

  return {
    structures, loading,
    fetchStructures, getStructure, saveStructure, deleteStructure,
  }
})
