import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDoc, setDoc, configRef } from '../firebase/firestore'
import { firebaseProjectId } from '../firebase/config'

/**
 * App/site config — stored in Firestore `config/app`.
 * Separate from squad identity: only the UI writes these fields.
 */

const DEFAULTS = {
  siteName: 'DELTAops',
  siteUrl: '',
  githubUrl: '',
  firestoreUrl: '',
}

export const useAppConfig = defineStore('appConfig', () => {
  const config = ref({ ...DEFAULTS })
  const loaded = ref(false)

  // Convenience computed
  const siteName = computed(() => config.value.siteName)
  const siteUrl = computed(() => {
    const raw = config.value.siteUrl || import.meta.env.VITE_SITE_URL || window.location.origin
    return raw.endsWith('/') ? raw : raw + '/'
  })
  const githubUrl = computed(() => config.value.githubUrl)
  const firestoreUrl = computed(() =>
    config.value.firestoreUrl ||
    (firebaseProjectId ? `https://console.firebase.google.com/project/${firebaseProjectId}/firestore` : '')
  )

  async function fetch() {
    if (loaded.value) return
    try {
      const snap = await getDoc(configRef)
      if (snap.exists()) {
        config.value = { ...DEFAULTS, ...snap.data() }
      }
    } catch (e) {
      console.warn('App config load failed, using defaults:', e.message)
    }
    loaded.value = true
  }

  async function save(data) {
    config.value = { ...config.value, ...data }
    await setDoc(configRef, config.value, { merge: true })
  }

  return {
    config, loaded,
    siteName, siteUrl, githubUrl, firestoreUrl,
    fetch, save,
  }
})
