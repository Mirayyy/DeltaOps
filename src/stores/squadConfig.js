import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDoc, setDoc, squadConfigRef } from '../firebase/firestore'
import { isFirebaseConfigured } from '../firebase/config'

/**
 * Squad identity config — stored in Firestore `config/squad`.
 *
 * Dual ownership:
 *   App writes:       siteUrl, siteName, contacts, description
 *   Extension writes: name, tag, logo, status, server, side, guaranteedSlots, recruitment,
 *                     createdAt, projectMemberSince, scrapedAt
 *   Both can edit ALL fields through the Settings page.
 */

const DEFAULTS = {
  // Identity
  name: 'DELTA',
  tag: 'DELTA',
  logo: '',
  // Site
  siteUrl: 'https://mirayyy.github.io/DeltaOps/',
  siteName: 'DeltaOps',
  // Squad info
  status: '',
  server: 'T2',
  side: 'red',
  guaranteedSlots: 0,
  recruitment: 'open',
  createdAt: '',
  projectMemberSince: '',
  // Content (markdown)
  contacts: [],  // array of player UIDs
  description: '',
}

export const useSquadConfig = defineStore('squadConfig', () => {
  const config = ref({ ...DEFAULTS })
  const loaded = ref(false)

  // Convenience computed (used across components)
  const name = computed(() => config.value.name)
  const logo = computed(() => config.value.logo)
  const siteUrl = computed(() => config.value.siteUrl)
  const siteName = computed(() => config.value.siteName)
  const tag = computed(() => config.value.tag)
  const server = computed(() => config.value.server)
  const side = computed(() => config.value.side)
  const recruitment = computed(() => config.value.recruitment)
  const status = computed(() => config.value.status)
  const guaranteedSlots = computed(() => config.value.guaranteedSlots)
  const createdAt = computed(() => config.value.createdAt)
  const contacts = computed(() => config.value.contacts)
  const description = computed(() => config.value.description)

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
        // Migration: contacts was previously string/nicknames array, now UIDs array
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
    name, logo, siteUrl, siteName, tag, server, side,
    recruitment, status, guaranteedSlots, createdAt, contacts, description,
    fetch, save,
  }
})
