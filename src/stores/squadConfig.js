import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDoc, setDoc, squadConfigRef } from '../firebase/firestore'
import { isFirebaseConfigured } from '../firebase/config'

/**
 * Squad identity config — stored in Firestore `config/squad`.
 *
 * Dual ownership:
 *   App writes:       siteName, siteUrl, version, githubUrl, contacts, recruitment, createdAt
 *   Extension writes: name, tag, logo, status, server, side, guaranteedSlots,
 *                     recruitment, createdAt, projectMemberSince, scrapedAt
 *   Both can edit ALL fields through the Settings page.
 *
 * Note: server/side are also on rotations (primary UI source).
 *       Extension still writes them here for reference.
 */

const DEFAULTS = {
  // Identity
  name: 'DELTA',
  tag: 'DELTA',
  logo: '',
  status: '',
  guaranteedSlots: 0,
  recruitment: 'open',
  createdAt: '',
  contacts: [],  // array of player UIDs
  // Site
  siteName: 'DeltaOps',
  siteUrl: '',
  version: '1.0',
  githubUrl: '',
}

export const useSquadConfig = defineStore('squadConfig', () => {
  const config = ref({ ...DEFAULTS })
  const loaded = ref(false)

  // Convenience computed
  const name = computed(() => config.value.name)
  const logo = computed(() => config.value.logo)
  const tag = computed(() => config.value.tag)
  const siteName = computed(() => config.value.siteName)
  const siteUrl = computed(() => config.value.siteUrl)
  const version = computed(() => config.value.version)
  const githubUrl = computed(() => config.value.githubUrl)
  const status = computed(() => config.value.status)
  const recruitment = computed(() => config.value.recruitment)
  const guaranteedSlots = computed(() => config.value.guaranteedSlots)
  const createdAt = computed(() => config.value.createdAt)
  const contacts = computed(() => config.value.contacts)

  // Derived
  const tsgUrl = computed(() => {
    const t = config.value.tag || config.value.name
    return t ? `https://tsgames.ru/squad/${t}` : ''
  })

  async function fetch() {
    if (loaded.value) return
    if (!isFirebaseConfigured) {
      loaded.value = true
      return
    }
    try {
      const snap = await getDoc(squadConfigRef)
      if (snap.exists()) {
        const data = snap.data()
        // Migration: contacts was previously string/nicknames, now UIDs array
        if (typeof data.contacts === 'string') {
          data.contacts = []
        }
        config.value = { ...DEFAULTS, ...data }
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

  return {
    config, loaded,
    name, logo, tag, siteName, siteUrl, version, githubUrl,
    status, recruitment, guaranteedSlots, createdAt, contacts,
    tsgUrl,
    fetch, save,
  }
})
