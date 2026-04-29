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
  siteUrl: 'https://mirayyy.github.io/DeltaOps/',
  githubUrl: '',
  firestoreUrl: '',
}

function normalizeSiteUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const clean = raw.replace(/\/?#\/?$/, '/')
  return clean.endsWith('/') ? clean : clean + '/'
}

export const useAppConfig = defineStore('appConfig', () => {
  const config = ref({ ...DEFAULTS })
  const loaded = ref(false)

  // Convenience computed
  const siteName = computed(() => config.value.siteName)
  const siteUrl = computed(() => {
    const raw = config.value.siteUrl || import.meta.env.VITE_SITE_URL || window.location.origin
    return normalizeSiteUrl(raw)
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
        config.value.siteUrl = normalizeSiteUrl(config.value.siteUrl)
      }
    } catch (e) {
      console.warn('App config load failed, using defaults:', e.message)
    }
    loaded.value = true
  }

  async function save(data) {
    const next = { ...data }
    if ('siteUrl' in next) next.siteUrl = normalizeSiteUrl(next.siteUrl)

    config.value = { ...config.value, ...next }
    await setDoc(configRef, config.value, { merge: true })
  }

  return {
    config, loaded,
    siteName, siteUrl, githubUrl, firestoreUrl,
    fetch, save,
  }
})
