import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDoc, setDoc, squadConfigRef } from '../firebase/firestore'

/**
 * Squad identity config — stored in Firestore `config/squad`.
 *
 * Dual ownership:
 *   App writes:       contacts, recruitment, createdAt
 *   Extension writes: name, tag, logo, status, guaranteedSlots,
 *                     recruitment, createdAt, scrapedAt
 *
 * Site-level fields (siteName, siteUrl, etc.) live in config/app → appConfig store.
 */

const DEFAULTS = {
  name: 'DELTA',
  tag: 'DELTA',
  logo: '',
  status: '',
  server: '',
  side: '',
  guaranteedSlots: 0,
  recruitment: 'open',
  createdAt: '',
  contacts: [],  // array of player UIDs
  skillNames: [], // managed via Settings CRUD
  equipmentItems: [], // [{ name, color }] — managed via Settings CRUD
}

export const useSquadConfig = defineStore('squadConfig', () => {
  const config = ref({ ...DEFAULTS })
  const loaded = ref(false)

  // Convenience computed
  const name = computed(() => config.value.name)
  const logo = computed(() => config.value.logo)
  const tag = computed(() => config.value.tag)
  const status = computed(() => config.value.status)
  const server = computed(() => config.value.server)
  const side = computed(() => config.value.side)
  const recruitment = computed(() => config.value.recruitment)
  const guaranteedSlots = computed(() => config.value.guaranteedSlots)
  const createdAt = computed(() => config.value.createdAt)
  const contacts = computed(() => config.value.contacts)
  const skillNames = computed(() => config.value.skillNames)
  const equipmentItems = computed(() => config.value.equipmentItems)
  const equipmentNames = computed(() => (config.value.equipmentItems || []).map(e => e.name))
  const equipmentColorMap = computed(() => {
    const map = {}
    for (const e of config.value.equipmentItems || []) map[e.name] = e.color
    return map
  })

  // Derived
  const tsgUrl = computed(() => {
    const t = config.value.tag || config.value.name
    return t ? `https://tsgames.ru/squad/${t}` : ''
  })

  async function fetch() {
    if (loaded.value) return
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
    await setDoc(squadConfigRef, config.value, { merge: true })
  }

  return {
    config, loaded,
    name, logo, tag, status, server, side,
    recruitment, guaranteedSlots, createdAt, contacts, skillNames,
    equipmentItems, equipmentNames, equipmentColorMap,
    tsgUrl,
    fetch, save,
  }
})
