<script setup>
import { ref, onMounted, computed } from 'vue'
import { useArchiveStore } from '../stores/archive'
import { useGamesStore } from '../stores/games'
import { useAttendanceStore } from '../stores/attendance'
import { useWebContentStore } from '../stores/webContent'
import { useRosterStore } from '../stores/roster'
import { GAME_IDS } from '../utils/constants'
import { isFirebaseConfigured } from '../firebase/config'
import { useSquadConfig } from '../stores/squadConfig'
import { useAppConfig } from '../stores/appConfig'
import { useToast } from '../composables/useToast'
import BaseSelect from '../components/common/BaseSelect.vue'
import BaseCheckbox from '../components/common/BaseCheckbox.vue'

const archive = useArchiveStore()
const gamesStore = useGamesStore()
const attendanceStore = useAttendanceStore()
const webContent = useWebContentStore()
const roster = useRosterStore()
const toast = useToast()
const squadConfig = useSquadConfig()
const appConfig = useAppConfig()

// ═══════════════════════════════════════
// SQUAD FORM
// ═══════════════════════════════════════

const squadForm = ref({})
const savingSquad = ref(false)

function initSquadForm() {
  const c = squadConfig.config
  squadForm.value = {
    name: c.name || '',
    tag: c.tag || '',
    logo: c.logo || '',
    status: c.status || '',
    guaranteedSlots: c.guaranteedSlots || 0,
    recruitment: c.recruitment || 'open',
    server: c.server || '',
    side: c.side || '',
    createdAt: c.createdAt || '',
    contacts: Array.isArray(c.contacts) ? [...c.contacts] : [],
  }
}

const recruitmentOptions = [
  { value: 'open', label: 'Открыт' },
  { value: 'closed', label: 'Закрыт' },
]
const serverOptions = [
  { value: '', label: '—' },
  { value: 'T2', label: 'T2' },
  { value: 'T3', label: 'T3' },
]
const sideOptions = [
  { value: '', label: '—' },
  { value: 'red', label: 'Красные' },
  { value: 'blue', label: 'Синие' },
]

// Contact player selector
const contactToAdd = ref(null)

const availableContactOptions = computed(() => {
  const selected = new Set(squadForm.value.contacts || [])
  return [
    { value: null, label: '— Выберите игрока —' },
    ...roster.activePlayers
      .filter(p => !selected.has(p.uid))
      .map(p => ({ value: p.uid, label: p.nickname })),
  ]
})

function contactPlayerName(uid) {
  const p = roster.getPlayer(uid)
  return p ? p.nickname : uid
}

function addContact() {
  if (!contactToAdd.value) return
  if (!squadForm.value.contacts.includes(contactToAdd.value)) {
    squadForm.value.contacts.push(contactToAdd.value)
  }
  contactToAdd.value = null
}

function removeContact(uid) {
  squadForm.value.contacts = squadForm.value.contacts.filter(id => id !== uid)
}

// TSG URL (derived from tag)
const tsgUrl = computed(() => {
  const t = squadForm.value.tag || squadForm.value.name
  return t ? `https://tsgames.ru/squad/${t}` : ''
})

async function saveSquadConfig() {
  savingSquad.value = true
  try {
    const data = {
      ...squadForm.value,
      guaranteedSlots: parseInt(squadForm.value.guaranteedSlots, 10) || 0,
    }
    await squadConfig.save(data)
    // Also save aboutMarkdown (description on landing page)
    await webContent.saveContent()
    toast.success('Настройки отряда сохранены')
  } catch (e) {
    toast.error('Ошибка: ' + e.message)
  }
  savingSquad.value = false
}

// ═══════════════════════════════════════
// ROTATIONS
// ═══════════════════════════════════════

const newRotation = ref({ name: '', startDate: '', endDate: '' })
const creating = ref(false)
const archiving = ref(false)
const deleting = ref(null)

const editingRotationId = ref(null)
const editForm = ref({ name: '', startDate: '', endDate: '' })

const statusConfig = {
  active: { label: 'Активна', class: 'bg-green-500/20 text-green-400 border-green-500/30' },
  upcoming: { label: 'Скоро', class: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  past: { label: 'Прошла', class: 'bg-neutral-700/30 text-neutral-500 border-neutral-600/30' },
}

function rotationGamesCount(rotationId) {
  return archive.archives.filter(a => a.rotation === rotationId).length
}

const hasUnfinalizedWeek = computed(() => {
  for (const id of GAME_IDS) {
    const slots = gamesStore.getSlots(id)
    if (slots.length > 0) return true
    const game = attendanceStore.getGameAttendance(id)
    if (game.records?.some(r => r.attendance && r.attendance !== 'no_response')) return true
  }
  return false
})

async function handleCreate() {
  if (!newRotation.value.name.trim() || !newRotation.value.startDate || creating.value) return
  creating.value = true
  try {
    await archive.createRotation(
      newRotation.value.name.trim(),
      newRotation.value.startDate,
      newRotation.value.endDate || null,
    )
    newRotation.value = { name: '', startDate: '', endDate: '' }
    toast.success('Ротация создана')
  } catch (e) {
    toast.error('Ошибка: ' + e.message)
  } finally {
    creating.value = false
  }
}

async function handleArchive() {
  const active = archive.getActiveRotation()
  if (!active || archiving.value) return
  if (hasUnfinalizedWeek.value) {
    toast.error('Сначала завершите текущую неделю (Дашборд → Завершить неделю)')
    return
  }
  archiving.value = true
  try {
    const today = new Date().toISOString().slice(0, 10)
    await archive.updateRotation(active.id, { endDate: today })
    toast.success('Ротация завершена')
  } catch (e) {
    toast.error('Ошибка: ' + e.message)
  } finally {
    archiving.value = false
  }
}

async function handleDeleteRotation(rot) {
  const gamesCount = rotationGamesCount(rot.id)
  if (gamesCount > 0) {
    toast.error(`Нельзя удалить: ${gamesCount} игр привязано к ротации`)
    return
  }
  deleting.value = rot.id
  try {
    await archive.deleteRotation(rot.id)
    toast.success('Ротация удалена')
  } catch (e) {
    toast.error('Ошибка: ' + e.message)
  } finally {
    deleting.value = null
  }
}

function startEditRotation(rot) {
  editingRotationId.value = rot.id
  editForm.value = {
    name: rot.name || '',
    startDate: toInputDate(rot.startDate),
    endDate: toInputDate(rot.endDate),
  }
}

function cancelEditRotation() {
  editingRotationId.value = null
}

async function saveEditRotation() {
  if (!editingRotationId.value || !editForm.value.name.trim()) return
  try {
    await archive.updateRotation(editingRotationId.value, {
      name: editForm.value.name.trim(),
      startDate: editForm.value.startDate || null,
      endDate: editForm.value.endDate || null,
    })
    toast.success('Ротация обновлена')
    editingRotationId.value = null
  } catch (e) {
    toast.error('Ошибка: ' + e.message)
  }
}

// ═══════════════════════════════════════
// AWARDS (web content)
// ═══════════════════════════════════════

const savingContent = ref(false)

const playerOptions = computed(() => [
  { value: null, label: '— Не выбран —' },
  ...roster.activePlayers.map(p => ({ value: p.uid, label: p.nickname })),
])

async function saveWebContent() {
  savingContent.value = true
  try {
    await webContent.saveContent()
    toast.success('Достижения сохранены')
  } catch (e) {
    toast.error('Ошибка: ' + e.message)
  } finally {
    savingContent.value = false
  }
}

// ═══════════════════════════════════════
// SITE CONFIG
// ═══════════════════════════════════════

const siteForm = ref({})
const savingSite = ref(false)

function initSiteForm() {
  const c = appConfig.config
  siteForm.value = {
    siteName: c.siteName || '',
    siteUrl: c.siteUrl || '',
    githubUrl: c.githubUrl || '',
    firestoreUrl: c.firestoreUrl || '',
  }
}

async function saveSiteConfig() {
  savingSite.value = true
  try {
    await appConfig.save(siteForm.value)
    toast.success('Настройки сайта сохранены')
  } catch (e) {
    toast.error('Ошибка: ' + e.message)
  }
  savingSite.value = false
}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════

onMounted(async () => {
  await Promise.all([
    archive.rotations.length ? null : archive.fetchArchives(),
    webContent.fetchContent(),
    roster.players.length ? null : roster.fetchPlayers(),
    squadConfig.fetch(),
    appConfig.fetch(),
  ])
  initSquadForm()
  initSiteForm()
})

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function toInputDate(ts) {
  if (!ts) return ''
  if (typeof ts === 'string' && /^\d{4}-\d{2}-\d{2}/.test(ts)) return ts.slice(0, 10)
  const d = typeof ts === 'string' ? new Date(ts) : ts.toDate ? ts.toDate() : new Date(ts)
  return d.toISOString().slice(0, 10)
}

function formatDate(ts) {
  if (!ts) return '—'
  if (typeof ts === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ts)) {
    const [y, m, d] = ts.split('-')
    return `${d}.${m}.${y}`
  }
  const d = typeof ts === 'string' ? new Date(ts) : ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
</script>

<template>
  <div class="pb-20 md:pb-0 max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold mb-6">Настройки</h1>

    <!-- ═══ 1. ROTATIONS ═══ -->
    <div class="mb-8">
      <h2 class="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Ротации</h2>

      <div class="bg-neutral-900 rounded-xl border border-neutral-800 p-5">
        <!-- Rotation list -->
        <div class="space-y-3 mb-5">
          <div v-for="rot in archive.rotations" :key="rot.id"
            class="bg-neutral-800/50 rounded-lg p-4">

            <!-- Edit mode -->
            <template v-if="editingRotationId === rot.id">
              <div class="space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label class="block text-xs text-neutral-400 mb-1">Название</label>
                    <input v-model="editForm.name" type="text"
                      class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
                  </div>
                  <div>
                    <label class="block text-xs text-neutral-400 mb-1">Начало</label>
                    <input v-model="editForm.startDate" type="date"
                      class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green text-neutral-300" />
                  </div>
                  <div>
                    <label class="block text-xs text-neutral-400 mb-1">Конец</label>
                    <input v-model="editForm.endDate" type="date"
                      class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green text-neutral-300" />
                  </div>
                </div>
                <div class="flex gap-2">
                  <button @click="saveEditRotation"
                    class="px-3 py-1.5 text-xs bg-delta-green hover:bg-delta-green/90 text-white rounded-lg transition-colors">
                    Сохранить
                  </button>
                  <button @click="cancelEditRotation"
                    class="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors">
                    Отмена
                  </button>
                </div>
              </div>
            </template>

            <!-- View mode -->
            <template v-else>
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-medium">{{ rot.name }}</span>
                    <span :class="['text-xs px-2 py-0.5 rounded border', statusConfig[archive.getRotationStatus(rot)].class]">
                      {{ statusConfig[archive.getRotationStatus(rot)].label }}
                    </span>
                  </div>
                  <div class="text-xs text-neutral-500 mt-1">
                    {{ formatDate(rot.startDate) }}
                    <template v-if="rot.endDate"> → {{ formatDate(rot.endDate) }}</template>
                    <template v-else> → ...</template>
                    <span class="ml-2 text-neutral-600">{{ rotationGamesCount(rot.id) }} игр</span>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <button @click="startEditRotation(rot)"
                    class="text-xs text-neutral-600 hover:text-neutral-300 transition-colors px-2 py-1">✎</button>
                  <button v-if="archive.getRotationStatus(rot) === 'active'"
                    @click="handleArchive"
                    :disabled="archiving"
                    class="px-3 py-1.5 text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50">
                    {{ archiving ? '...' : 'Завершить' }}
                  </button>
                  <button v-if="rotationGamesCount(rot.id) === 0"
                    @click="handleDeleteRotation(rot)"
                    :disabled="deleting === rot.id"
                    class="px-2 py-1.5 text-xs text-red-600 hover:text-red-400 transition-colors disabled:opacity-50">
                    ✕
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div v-if="!archive.rotations.length" class="text-neutral-600 text-sm mb-5">Нет ротаций</div>

        <!-- Create -->
        <div class="pt-4 border-t border-neutral-800">
          <h4 class="text-xs text-neutral-400 mb-3">Новая ротация</h4>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label class="block text-xs text-neutral-500 mb-1">Название *</label>
              <input v-model="newRotation.name" type="text" placeholder="Лето 2026"
                class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
            </div>
            <div>
              <label class="block text-xs text-neutral-500 mb-1">Начало *</label>
              <input v-model="newRotation.startDate" type="date"
                class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green text-neutral-300" />
            </div>
            <div>
              <label class="block text-xs text-neutral-500 mb-1">Конец</label>
              <input v-model="newRotation.endDate" type="date"
                class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green text-neutral-300" />
            </div>
          </div>
          <div class="flex justify-end mt-1">
            <button @click="handleCreate"
              :disabled="!newRotation.name.trim() || !newRotation.startDate || creating"
              class="px-4 py-2 text-sm bg-delta-green hover:bg-delta-green/90 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
              {{ creating ? '...' : 'Создать' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ 2. AWARDS ═══ -->
    <div class="mb-8">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Достижения</h2>
        <button @click="saveWebContent" :disabled="savingContent"
          class="px-4 py-1.5 text-xs bg-delta-green hover:bg-delta-green/90 text-white rounded-lg transition-colors disabled:opacity-50">
          {{ savingContent ? 'Сохранение...' : 'Сохранить' }}
        </button>
      </div>

      <div class="bg-neutral-900 rounded-xl border border-neutral-800 p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-medium text-neutral-300">Список достижений</h3>
          <button @click="webContent.addAward"
            class="text-xs px-3 py-1 border border-neutral-700 rounded-lg text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors">
            + Добавить
          </button>
        </div>

        <div v-if="!webContent.awards.length" class="text-neutral-600 text-sm">Нет достижений</div>

        <div class="space-y-3">
          <div v-for="(award, idx) in webContent.awards" :key="award._id"
            class="bg-neutral-800/50 rounded-lg p-4">
            <div class="flex items-start gap-4">
              <div class="w-14 h-14 bg-neutral-800 rounded-lg flex items-center justify-center border border-neutral-700 shrink-0 overflow-hidden">
                <img v-if="award.icon" :src="award.icon" :alt="award.title" class="w-10 h-10 object-contain" />
                <span v-else class="text-neutral-600 text-xl">?</span>
              </div>
              <div class="flex-1 space-y-2">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[10px] text-neutral-500 mb-0.5">Иконка (URL)</label>
                    <input v-model="award.icon" type="text" placeholder="https://..."
                      class="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-delta-green" />
                  </div>
                  <div>
                    <label class="block text-[10px] text-neutral-500 mb-0.5">Название</label>
                    <input v-model="award.title" type="text" placeholder="Название достижения"
                      class="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-delta-green" />
                  </div>
                </div>
                <div>
                  <label class="block text-[10px] text-neutral-500 mb-0.5">Описание</label>
                  <input v-model="award.description" type="text" placeholder="За что получено"
                    class="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-delta-green" />
                </div>
                <div class="flex flex-wrap items-center gap-3 pt-1">
                  <div class="flex items-center gap-1">
                    <label class="text-[10px] text-neutral-500 mr-1">Тип:</label>
                    <button @click="award.type = 'squad'; award.playerUid = null"
                      :class="['px-2 py-0.5 text-[10px] rounded border transition-colors', award.type === 'squad' ? 'bg-delta-green/20 border-delta-green/40 text-delta-green' : 'border-neutral-700 text-neutral-500 hover:text-neutral-300']">
                      Отряд
                    </button>
                    <button @click="award.type = 'player'"
                      :class="['px-2 py-0.5 text-[10px] rounded border transition-colors', award.type === 'player' ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'border-neutral-700 text-neutral-500 hover:text-neutral-300']">
                      Игрок
                    </button>
                  </div>
                  <div v-if="award.type === 'player'" class="flex items-center gap-1">
                    <label class="text-[10px] text-neutral-500">Игрок:</label>
                    <BaseSelect v-model="award.playerUid" :options="playerOptions" size="sm" />
                  </div>
                  <BaseCheckbox v-model="award.showOnLanding" size="sm" class="ml-auto">
                    <span class="text-[10px] text-neutral-500">На главную</span>
                  </BaseCheckbox>
                </div>
              </div>
              <div class="flex flex-col gap-1 shrink-0">
                <button @click="webContent.moveAward(idx, -1)" :disabled="idx === 0"
                  class="text-neutral-600 hover:text-neutral-300 disabled:opacity-30 text-xs transition-colors">▲</button>
                <button @click="webContent.moveAward(idx, 1)" :disabled="idx === webContent.awards.length - 1"
                  class="text-neutral-600 hover:text-neutral-300 disabled:opacity-30 text-xs transition-colors">▼</button>
                <button @click="webContent.removeAward(idx)"
                  class="text-red-600 hover:text-red-400 text-xs transition-colors mt-1">✕</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ 3. SQUAD ═══ -->
    <div class="mb-8">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Отряд</h2>
        <button @click="saveSquadConfig" :disabled="savingSquad"
          class="px-4 py-1.5 text-xs bg-delta-green hover:bg-delta-green/90 text-white rounded-lg transition-colors disabled:opacity-50">
          {{ savingSquad ? 'Сохранение...' : 'Сохранить' }}
        </button>
      </div>

      <div class="bg-neutral-900 rounded-xl border border-neutral-800 p-5 space-y-5">
        <!-- Row 1: Identity -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs text-neutral-500 mb-1">Название</label>
            <input v-model="squadForm.name" type="text" placeholder="DELTA"
              class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
          </div>
          <div>
            <label class="block text-xs text-neutral-500 mb-1">Тэг</label>
            <input v-model="squadForm.tag" type="text" placeholder="DELTA"
              class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
          </div>
        </div>

        <!-- Row 2: Logo + preview -->
        <div>
          <label class="block text-xs text-neutral-500 mb-1">Логотип (URL)</label>
          <div class="flex gap-3">
            <input v-model="squadForm.logo" type="url" placeholder="https://..."
              class="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
            <div v-if="squadForm.logo" class="w-10 h-10 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0 overflow-hidden">
              <img :src="squadForm.logo" class="w-8 h-8 object-contain" />
            </div>
          </div>
        </div>

        <!-- Row 3: Params -->
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs text-neutral-500 mb-1">Слотов</label>
            <input v-model.number="squadForm.guaranteedSlots" type="number" min="0" max="99"
              class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
          </div>
          <div>
            <label class="block text-xs text-neutral-500 mb-1">Набор</label>
            <BaseSelect v-model="squadForm.recruitment" :options="recruitmentOptions" />
          </div>
          <div>
            <label class="block text-xs text-neutral-500 mb-1">Статус</label>
            <input v-model="squadForm.status" type="text" placeholder="Отряд Участник Проекта"
              class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
          </div>
          <div>
            <label class="block text-xs text-neutral-500 mb-1">Сервер</label>
            <BaseSelect v-model="squadForm.server" :options="serverOptions" />
          </div>
          <div>
            <label class="block text-xs text-neutral-500 mb-1">Сторона</label>
            <BaseSelect v-model="squadForm.side" :options="sideOptions" />
          </div>
        </div>

        <!-- Row 4: Contacts -->
        <div>
          <label class="block text-xs text-neutral-500 mb-2">Контакты</label>
          <div class="flex flex-wrap gap-2 mb-3">
            <div v-for="uid in squadForm.contacts" :key="uid"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm">
              <span class="text-white">{{ contactPlayerName(uid) }}</span>
              <button @click="removeContact(uid)" class="text-neutral-500 hover:text-red-400 transition-colors text-xs ml-1">&times;</button>
            </div>
            <div v-if="!squadForm.contacts.length" class="text-neutral-600 text-xs py-1.5">Не выбраны</div>
          </div>
          <div class="flex gap-2">
            <BaseSelect v-model="contactToAdd" :options="availableContactOptions" size="sm" class="flex-1" />
            <button @click="addContact" :disabled="!contactToAdd"
              class="px-3 py-1 text-xs border border-neutral-700 rounded-lg text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors disabled:opacity-30">
              + Добавить
            </button>
          </div>
        </div>

        <!-- Row 5: Date + TSG URL -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs text-neutral-500 mb-1">Дата создания</label>
            <input v-model="squadForm.createdAt" type="text" placeholder="17.12.2024"
              class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
          </div>
          <div>
            <label class="block text-xs text-neutral-500 mb-1">TSG URL</label>
            <div class="flex items-center h-[38px] px-3 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-sm text-neutral-400">
              <a v-if="tsgUrl" :href="tsgUrl" target="_blank" class="hover:text-orange-400 transition-colors truncate">{{ tsgUrl }}</a>
              <span v-else class="text-neutral-600">Введите тэг</span>
            </div>
          </div>
        </div>

        <!-- Row 6: Description (aboutMarkdown) -->
        <div>
          <label class="block text-xs text-neutral-500 mb-1">Описание <span class="text-neutral-600">(главная страница, markdown)</span></label>

          <!-- Markdown reference (collapsible) -->
          <details class="mb-2">
            <summary class="text-[10px] text-neutral-600 cursor-pointer hover:text-neutral-400 transition-colors">Подсказка по Markdown</summary>
            <div class="bg-neutral-800/50 rounded-lg p-3 mt-1 text-[11px] text-neutral-500 leading-relaxed space-y-1.5">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                <div><code class="text-neutral-400">**жирный**</code> → <strong class="text-white">жирный</strong></div>
                <div><code class="text-neutral-400">*курсив*</code> → <em class="text-neutral-300 italic">курсив</em></div>
                <div><code class="text-neutral-400">[текст](url)</code> → ссылка</div>
                <div><code class="text-neutral-400">- элемент</code> — список</div>
                <div><code class="text-neutral-400"># Заголовок</code> — заголовок</div>
                <div><code class="text-neutral-400">> цитата</code> — цитата</div>
              </div>
              <div class="border-t border-neutral-700/50 pt-1.5 mt-1.5">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                  <div><code class="text-neutral-400">{orange}текст{/orange}</code> → <span class="text-orange-400">текст</span></div>
                  <div><code class="text-neutral-400">{green}текст{/green}</code> → <span class="text-green-400">текст</span></div>
                  <div><code class="text-neutral-400">{delta}текст{/delta}</code> → <span class="text-delta-green">текст</span></div>
                  <div><code class="text-neutral-400">{red}текст{/red}</code> → <span class="text-red-400">текст</span></div>
                </div>
              </div>
            </div>
          </details>

          <textarea v-model="webContent.aboutMarkdown"
            rows="8"
            placeholder="Текст об отряде на главной странице..."
            class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-neutral-300 focus:outline-none focus:border-delta-green resize-y font-mono leading-relaxed">
          </textarea>
        </div>

        <!-- Player count (read-only info) -->
        <div class="flex items-center gap-3 text-sm text-neutral-400 pt-2 border-t border-neutral-800">
          <span class="text-neutral-600">Личный состав:</span>
          <span class="text-white font-medium">{{ roster.activePlayers.length }}</span>
          <span class="text-neutral-600">активных</span>
          <router-link to="/roster" class="text-delta-green hover:text-orange-400 text-xs transition-colors ml-auto">
            Управление →
          </router-link>
        </div>
      </div>
    </div>

    <!-- ═══ 4. SITE ═══ -->
    <div class="mb-8">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Сайт</h2>
        <button @click="saveSiteConfig" :disabled="savingSite"
          class="px-4 py-1.5 text-xs bg-delta-green hover:bg-delta-green/90 text-white rounded-lg transition-colors disabled:opacity-50">
          {{ savingSite ? 'Сохранение...' : 'Сохранить' }}
        </button>
      </div>

      <div class="bg-neutral-900 rounded-xl border border-neutral-800 p-5 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs text-neutral-500 mb-1">Название</label>
            <input v-model="siteForm.siteName" type="text" placeholder="DeltaOps"
              class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
          </div>
          <div>
            <label class="block text-xs text-neutral-500 mb-1">Ссылка</label>
            <input v-model="siteForm.siteUrl" type="url" placeholder="https://..."
              class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
          </div>
          <div>
            <label class="block text-xs text-neutral-500 mb-1">GitHub</label>
            <input v-model="siteForm.githubUrl" type="url" placeholder="https://github.com/..."
              class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
          </div>
          <div>
            <label class="block text-xs text-neutral-500 mb-1">Firestore URL</label>
            <input v-model="siteForm.firestoreUrl" type="url" placeholder="https://console.firebase.google.com/..."
              class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
          </div>
        </div>

        <!-- Quick links -->
        <div class="pt-4 border-t border-neutral-800">
          <div class="flex items-center gap-2 mb-2">
            <span :class="['w-2 h-2 rounded-full', isFirebaseConfigured ? 'bg-green-400' : 'bg-yellow-400']"></span>
            <span class="text-xs text-neutral-500">
              {{ isFirebaseConfigured ? 'Firebase подключён' : 'Демо-режим' }}
            </span>
          </div>
          <div class="flex flex-wrap gap-3 mt-2">
            <a v-if="appConfig.firestoreUrl" :href="appConfig.firestoreUrl" target="_blank"
              class="text-xs text-neutral-500 hover:text-amber-400 transition-colors">Firestore ↗</a>
            <a v-if="siteForm.githubUrl" :href="siteForm.githubUrl" target="_blank"
              class="text-xs text-neutral-500 hover:text-white transition-colors">GitHub ↗</a>
            <a v-if="siteForm.siteUrl" :href="siteForm.siteUrl" target="_blank"
              class="text-xs text-neutral-500 hover:text-white transition-colors">Сайт ↗</a>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
