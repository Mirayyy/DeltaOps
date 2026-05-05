import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDoc, setDoc, configRef } from '../firebase/firestore'
import { firebaseProjectId } from '../firebase/config'
import { writeAuditLog } from '../utils/auditLog'

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

function getBasePath() {
  const base = import.meta.env.BASE_URL || '/'
  return base.endsWith('/') ? base : base + '/'
}

function getDefaultSiteUrl() {
  if (typeof window === 'undefined') return DEFAULTS.siteUrl
  return new URL(getBasePath(), window.location.origin).toString()
}

function normalizeSiteUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return getDefaultSiteUrl()

  const clean = raw.replace(/\/?#\/?$/, '/')

  try {
    const url = new URL(clean)
    const basePath = getBasePath()

    if (basePath !== '/' && (url.pathname === '/' || url.pathname === '')) {
      url.pathname = basePath
    }

    return url.toString()
  } catch {
    return clean.endsWith('/') ? clean : clean + '/'
  }
}

export const useAppConfig = defineStore('appConfig', () => {
  const config = ref({ ...DEFAULTS })
  const loaded = ref(false)

  // Convenience computed
  const siteName = computed(() => config.value.siteName)
  const siteUrl = computed(() => {
    const raw = config.value.siteUrl || import.meta.env.VITE_SITE_URL || getDefaultSiteUrl()
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

    const previous = { ...config.value }
    config.value = { ...config.value, ...next }
    await setDoc(configRef, config.value, { merge: true })
    await writeAuditLog({
      action: 'update',
      entityType: 'app_config',
      entityId: 'config/app',
      summary: 'Обновлены настройки сайта',
      details: {
        updatedKeys: Object.keys(next || {}),
        previous,
        next: config.value,
      },
    })
  }

  return {
    config, loaded,
    siteName, siteUrl, githubUrl, firestoreUrl,
    fetch, save,
  }
})
