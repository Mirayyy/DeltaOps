import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDoc, setDoc, squadConfigRef } from '../firebase/firestore'
import { isFirebaseConfigured } from '../firebase/config'

/**
 * Squad identity config — stored in Firestore `config/squad`.
 * When forking for another squad, just change the document in DB.
 */

const DEFAULTS = {
  name: 'DELTA',
  logo: 'https://tsgames.ru/images/tsg_squad/J0/fB/R6jwSt75lUXL-iBtTpIfUQpYAzLEP9EW.png',
  siteUrl: 'https://mirayyy.github.io/DeltaOps/',
  siteName: 'DeltaOps',
}

export const useSquadConfig = defineStore('squadConfig', () => {
  const config = ref({ ...DEFAULTS })
  const loaded = ref(false)

  const name = computed(() => config.value.name)
  const logo = computed(() => config.value.logo)
  const siteUrl = computed(() => config.value.siteUrl)
  const siteName = computed(() => config.value.siteName)

  async function fetch() {
    if (loaded.value) return
    if (!isFirebaseConfigured) {
      loaded.value = true
      return
    }
    try {
      const snap = await getDoc(squadConfigRef)
      if (snap.exists()) {
        config.value = { ...DEFAULTS, ...snap.data() }
      }
    } catch (e) {
      console.warn('Squad config load failed, using defaults:', e.message)
    }
    loaded.value = true
  }

  async function save(data) {
    config.value = { ...config.value, ...data }
    if (isFirebaseConfigured) {
      await setDoc(squadConfigRef, config.value, { merge: true })
    }
  }

  return { config, loaded, name, logo, siteUrl, siteName, fetch, save }
})
