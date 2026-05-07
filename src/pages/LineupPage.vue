<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useRosterStore } from '../stores/roster'
import { useAttendanceStore } from '../stores/attendance'
import { useGamesStore } from '../stores/games'
import { useMissionsStore } from '../stores/missions'
import { useSquadConfig } from '../stores/squadConfig'
import { useWeekStateStore } from '../stores/weekState'
import { useGameWeek } from '../composables/useGameWeek'
import { SIDE_COLORS, SLOT_TYPES } from '../utils/constants'
import EquipmentTag from '../components/common/EquipmentTag.vue'
import SlotConfigurator from '../components/admin/SlotConfigurator.vue'
import SlotRequestModal from '../components/lineup/SlotRequestModal.vue'
import ImageLightbox from '../components/common/ImageLightbox.vue'
import BaseCheckbox from '../components/common/BaseCheckbox.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'
import ConfirmModal from '../components/common/ConfirmModal.vue'
import { useTelegram } from '../composables/useTelegram'
import { useToast } from '../composables/useToast'
import { writeAuditLog } from '../utils/auditLog'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const roster = useRosterStore()
const attendance = useAttendanceStore()
const gamesStore = useGamesStore()
const missionsStore = useMissionsStore()
const squadConfig = useSquadConfig()
const { games, gameDates } = useGameWeek()
const weekState = useWeekStateStore()

const activeTab = ref('friday_1')
const editingSlot = ref(null)
const editingNotes = ref('')
const showEquipmentMenu = ref(null)
const showSlotConfigurator = ref(false)
const showSlotRequestModal = ref(false)
const slotRequestPlayerId = ref(null)
const requestsCollapsed = ref(false)
const slotRequestsSection = ref(null)
const unassignedPlayersSection = ref(null)
const actionsExpanded = ref(false)
const alliesExpanded = ref(false)
const enemiesExpanded = ref(false)
const editingSquadTask = ref(false)
const squadTaskDraft = ref('')
const editingPersonalTask = ref(null) // slotIndex being edited
const personalTaskDraft = ref('')
const squadTaskTextarea = ref(null)
const personalTaskTextarea = ref(null)

onMounted(async () => {
  if (!roster.players.length) await roster.fetchPlayers()
  await Promise.all([
    weekState.fetchOrBootstrap(),
    attendance.fetchAttendance(),
    gamesStore.fetchGames(),
    missionsStore.fetchMissions(),
  ])
  syncTabFromRoute()
})

watch(() => route.query.game, () => {
  syncTabFromRoute()
})

const pageLoading = computed(() =>
  roster.loading || attendance.loading || gamesStore.loading || missionsStore.loading || weekState.loading
)

const currentMission = computed(() => missionsStore.getMission(activeTab.value))
const currentGame = computed(() => gamesStore.getGame(activeTab.value))
const confirmAction = ref(null)
const confirmBusy = ref(false)

const slots = computed(() => gamesStore.getSlots(activeTab.value))
const isAdmin = computed(() => auth.isUserAdmin)
const telegram = useTelegram()
const toast = useToast()

const markdownToolbarButtons = [
  { id: 'bold', label: 'B', title: 'Жирный текст' },
  { id: 'italic', label: 'I', title: 'Курсив' },
  { id: 'strike', label: 'S', title: 'Зачеркнутый текст' },
  { id: 'heading', label: 'H', title: 'Заголовок' },
  { id: 'bulletList', label: '•', title: 'Маркированный список' },
  { id: 'numberList', label: '1.', title: 'Нумерованный список' },
  { id: 'link', label: 'Link', title: 'Ссылка' },
  { id: 'image', label: 'Img', title: 'Изображение' },
  { id: 'spoiler', label: '@@@', title: 'Спойлер' },
  { id: 'code', label: '</>', title: 'Блок кода' },
  { id: 'quote', label: '>', title: 'Цитата' },
]

function resolveGameId(gameId) {
  if (typeof gameId !== 'string') return null
  return games.value.some(game => game.id === gameId) ? gameId : null
}

function syncTabFromRoute() {
  const routeGameId = resolveGameId(route.query.game)
  if (!routeGameId || routeGameId === activeTab.value) return
  selectTab(routeGameId, { syncRoute: false })
}

function resizeTextarea(target) {
  const element = target?.target ?? target?.value ?? target
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight}px`
}

function getDraftValue(kind) {
  return kind === 'squad' ? squadTaskDraft.value : personalTaskDraft.value
}

function setDraftValue(kind, value) {
  if (kind === 'squad') squadTaskDraft.value = value
  else personalTaskDraft.value = value
}

function updateDraftSelection(kind, textareaRef, value, selectionStart, selectionEnd = selectionStart) {
  setDraftValue(kind, value)
  nextTick(() => {
    const textarea = textareaRef.value
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(selectionStart, selectionEnd)
    resizeTextarea(textarea)
  })
}

function wrapSelection(kind, textareaRef, before, after, placeholder) {
  const textarea = textareaRef.value
  if (!textarea) return

  const value = getDraftValue(kind)
  const start = textarea.selectionStart ?? value.length
  const end = textarea.selectionEnd ?? value.length
  const selected = value.slice(start, end)
  const inserted = selected || placeholder
  const nextValue = `${value.slice(0, start)}${before}${inserted}${after}${value.slice(end)}`
  const selectionFrom = start + before.length
  const selectionTo = selectionFrom + inserted.length

  updateDraftSelection(kind, textareaRef, nextValue, selectionFrom, selectionTo)
}

function prefixSelectedLines(kind, textareaRef, prefix, fallbackText) {
  const textarea = textareaRef.value
  if (!textarea) return

  const value = getDraftValue(kind)
  const start = textarea.selectionStart ?? value.length
  const end = textarea.selectionEnd ?? value.length
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const lineEndIndex = value.indexOf('\n', end)
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex
  const block = value.slice(lineStart, lineEnd)
  const lines = (block || fallbackText).split('\n')
  const updatedBlock = lines.map(line => `${prefix}${line || fallbackText}`).join('\n')
  const nextValue = `${value.slice(0, lineStart)}${updatedBlock}${value.slice(lineEnd)}`

  updateDraftSelection(kind, textareaRef, nextValue, lineStart, lineStart + updatedBlock.length)
}

function insertTemplate(kind, textareaRef, template, selectFromOffset = 0, selectToOffset = 0) {
  const textarea = textareaRef.value
  if (!textarea) return

  const value = getDraftValue(kind)
  const start = textarea.selectionStart ?? value.length
  const end = textarea.selectionEnd ?? value.length
  const nextValue = `${value.slice(0, start)}${template}${value.slice(end)}`
  const selectionStart = start + selectFromOffset
  const selectionEnd = start + (selectToOffset || template.length)

  updateDraftSelection(kind, textareaRef, nextValue, selectionStart, selectionEnd)
}

function applyMarkdownAction(kind, textareaRef, actionId) {
  switch (actionId) {
    case 'bold':
      wrapSelection(kind, textareaRef, '**', '**', 'жирный текст')
      break
    case 'italic':
      wrapSelection(kind, textareaRef, '*', '*', 'курсив')
      break
    case 'strike':
      wrapSelection(kind, textareaRef, '~~', '~~', 'зачеркнутый текст')
      break
    case 'heading':
      prefixSelectedLines(kind, textareaRef, '## ', 'Заголовок')
      break
    case 'bulletList':
      prefixSelectedLines(kind, textareaRef, '- ', 'Пункт')
      break
    case 'numberList':
      insertTemplate(kind, textareaRef, '1. Пункт 1\n2. Пункт 2', 0, 23)
      break
    case 'link':
      wrapSelection(kind, textareaRef, '[', '](https://example.com)', 'текст ссылки')
      break
    case 'image':
      insertTemplate(kind, textareaRef, '![Описание](https://i.ibb.co/example/image.png)', 2, 10)
      break
    case 'spoiler':
      insertTemplate(kind, textareaRef, '@@@ Заголовок\nСодержимое спойлера\n@@@', 4, 13)
      break
    case 'code':
      insertTemplate(kind, textareaRef, '```text\nтекст\n```', 8, 13)
      break
    case 'quote':
      prefixSelectedLines(kind, textareaRef, '> ', 'Цитата')
      break
  }
}

function sanitizeCssColor(value) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (/^#([0-9a-fA-F]{3,8})$/.test(normalized)) return normalized
  if (/^(rgb|rgba|hsl|hsla)\([\d\s.,%]+\)$/.test(normalized)) return normalized
  if (/^[a-zA-Z]+$/.test(normalized)) return normalized.toLowerCase()
  return ''
}

function sanitizeInlineStyles(root) {
  const styleSanitizers = {
    color: sanitizeCssColor,
    'background-color': sanitizeCssColor,
    'text-align': (value) => {
      const normalized = value.trim().toLowerCase()
      return ['left', 'center', 'right', 'justify'].includes(normalized) ? normalized : ''
    },
  }

  root.querySelectorAll('[style]').forEach((element) => {
    const declarations = element
      .getAttribute('style')
      ?.split(';')
      .map(part => part.trim())
      .filter(Boolean) || []

    const safeDeclarations = declarations.reduce((result, declaration) => {
      const [property, ...valueParts] = declaration.split(':')
      if (!property || !valueParts.length) return result

      const normalizedProperty = property.trim().toLowerCase()
      const sanitizer = styleSanitizers[normalizedProperty]
      if (!sanitizer) return result

      const safeValue = sanitizer(valueParts.join(':').trim())
      if (!safeValue) return result

      result.push(`${normalizedProperty}: ${safeValue}`)
      return result
    }, [])

    if (safeDeclarations.length) {
      element.setAttribute('style', safeDeclarations.join('; '))
    } else {
      element.removeAttribute('style')
    }
  })
}

function transformCustomSpoilers(content) {
  return content.replace(
    /^@@@\s+(.+?)\s*\r?\n([\s\S]*?)^\s*@@@\s*$/gm,
    (_, summary = '', body = '') => `<details><summary>${summary.trim()}</summary>\n${body.trim()}\n</details>`
  )
}

function renderDetailsBlocks(content) {
  return content.replace(/<details(\s+open)?>([\s\S]*?)<\/details>/gi, (_, openAttr = '', innerContent = '') => {
    const match = innerContent.match(/<summary>([\s\S]*?)<\/summary>([\s\S]*)/i)
    if (!match) return _

    const [, summaryContent = '', bodyContent = ''] = match
    const summaryHtml = marked.parseInline(summaryContent.trim())
    const bodyHtml = marked.parse(bodyContent.trim(), {
      breaks: true,
      gfm: true,
    })

    return `<details class="task-spoiler"${openAttr || ''}><summary>${summaryHtml}</summary><div class="task-spoiler__content">${bodyHtml}</div></details>`
  })
}

function renderMarkdown(content) {
  if (!content?.trim()) return ''

  const preparedContent = renderDetailsBlocks(transformCustomSpoilers(content))

  const rawHtml = marked.parse(preparedContent, {
    breaks: true,
    gfm: true,
  })

  const sanitizedHtml = DOMPurify.sanitize(rawHtml, {
    ADD_TAGS: ['details', 'summary'],
    ADD_ATTR: ['target', 'rel', 'style', 'loading', 'decoding', 'class', 'open'],
  })

  const parser = new DOMParser()
  const documentFragment = parser.parseFromString(sanitizedHtml, 'text/html')

  documentFragment.querySelectorAll('a[href]').forEach((link) => {
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
  })

  documentFragment.querySelectorAll('img').forEach((image) => {
    image.setAttribute('loading', 'lazy')
    image.setAttribute('decoding', 'async')
    if (!image.getAttribute('alt')) {
      image.setAttribute('alt', 'Встроенное изображение')
    }
  })

  sanitizeInlineStyles(documentFragment.body)

  return documentFragment.body.innerHTML
}

const hasSquadTask = computed(() => Boolean(currentGame.value?.task?.trim()))
const showSquadTaskEditor = computed(() => isAdmin.value && (editingSquadTask.value || !hasSquadTask.value))
const squadTaskHtml = computed(() => renderMarkdown(currentGame.value?.task || ''))

async function sendLineupToTelegram() {
  const missionsData = {}
  for (const g of games.value) {
    const m = missionsStore.getMission(g.id)
    if (m) missionsData[g.id] = m
  }
  const msg = telegram.buildLineupSummaryMessage(gamesStore.games, roster.players, missionsData, gameDates)
  const result = await telegram.sendMessage(msg)
  if (result.ok) {
    await writeAuditLog({
      action: 'send',
      entityType: 'telegram',
      entityId: 'lineup-summary',
      summary: 'telegram - send - lineup-summary',
      after: {
        gameIds: games.value.map(game => game.id),
        missionIds: Object.keys(missionsData),
        gameDates: gameDates.value,
      },
    })
    toast.success('Расстановка отправлена в Telegram')
  } else {
    toast.error('Ошибка: ' + result.error)
  }
}

function requestConfirmation(config) {
  confirmAction.value = config
}

function closeConfirmation() {
  if (confirmBusy.value) return
  confirmAction.value = null
}

async function handleConfirm() {
  if (!confirmAction.value?.onConfirm) return
  confirmBusy.value = true
  try {
    await confirmAction.value.onConfirm()
    confirmAction.value = null
  } finally {
    confirmBusy.value = false
  }
}

// Gallery: split by ally/enemy
const allySides = computed(() => {
  if (!currentMission.value?.sides) return []
  return currentMission.value.sides.filter(s => missionsStore.getSideTeam(currentMission.value, s.color, squadConfig.side) === 'ally')
})
const enemySides = computed(() => {
  if (!currentMission.value?.sides) return []
  return currentMission.value.sides.filter(s => missionsStore.getSideTeam(currentMission.value, s.color, squadConfig.side) === 'enemy')
})
const allyGalleryImages = computed(() => allySides.value.flatMap(s => s.gallery || []))
const enemyGalleryImages = computed(() => enemySides.value.flatMap(s => s.gallery || []))
const galleryImages = computed(() => [...allyGalleryImages.value, ...enemyGalleryImages.value])
const showGallery = ref(false)
const galleryStartIndex = ref(0)
const galleryLabel = ref('')

function galleryBtnStyle(sides) {
  const colors = sides.map(s => SIDE_COLORS[s.color]?.raw || '163,163,163')
  if (colors.length === 1) {
    return {
      background: `rgba(${colors[0]}, 0.15)`,
      borderColor: `rgba(${colors[0]}, 0.3)`,
      color: `rgba(${colors[0]}, 0.85)`,
    }
  }
  const stops = colors.map((c, i) => {
    const pct1 = (i / colors.length) * 100
    const pct2 = ((i + 1) / colors.length) * 100
    return `rgba(${c}, 0.15) ${pct1}%, rgba(${c}, 0.15) ${pct2}%`
  }).join(', ')
  return {
    background: `linear-gradient(90deg, ${stops})`,
    borderColor: `rgba(${colors[0]}, 0.3)`,
    color: `rgba(${colors[0]}, 0.85)`,
  }
}

const activeGalleryImages = ref([])

function openGallery(images, index = 0, label = '') {
  activeGalleryImages.value = images
  galleryStartIndex.value = index
  galleryLabel.value = label
  showGallery.value = true
}

function openMarkdownImagePreview(event) {
  const image = event.target?.closest?.('img')
  if (!image) return

  const container = image.closest('.task-markdown')
  if (!container) return

  const images = Array.from(container.querySelectorAll('img'))
    .map(img => img.getAttribute('src'))
    .filter(Boolean)

  const clickedSrc = image.getAttribute('src')
  const clickedIndex = images.findIndex(src => src === clickedSrc)

  if (!images.length || clickedIndex === -1) return

  event.preventDefault()
  event.stopPropagation()
  openGallery(images, clickedIndex)
}

// Players available for assignment
const availablePlayers = computed(() => {
  const assignedIds = new Set(slots.value.filter(s => s.playerId).map(s => s.playerId))
  return roster.activePlayers
    .map(p => {
      const status = attendance.getPlayerAttendance(activeTab.value, p.uid)
      return { ...p, readiness: status }
    })
    .filter(p => (p.readiness === 'confirmed' || p.readiness === 'tentative') && !assignedIds.has(p.uid))
    .sort((a, b) => {
      const order = { confirmed: 0, tentative: 1 }
      return (order[a.readiness] ?? 1) - (order[b.readiness] ?? 1)
    })
})

const assignedCount = computed(() => slots.value.filter(s => s.playerId).length)
const totalSlots = computed(() => slots.value.length)
const reserveSlotsCount = computed(() => slots.value.filter(s => s.type === 'reserve').length)
const combatSlotsCount = computed(() => slots.value.filter(s => s.type !== 'reserve').length)
const assignedCombatSlotsCount = computed(() => slots.value.filter(s => s.type !== 'reserve' && s.playerId).length)
const freeCombatSlotsCount = computed(() => Math.max(combatSlotsCount.value - assignedCombatSlotsCount.value, 0))
const unassignedPlayersByReadiness = computed(() => {
  const grouped = { confirmed: [], tentative: [] }
  for (const player of availablePlayers.value) {
    if (player.readiness === 'confirmed') grouped.confirmed.push(player)
    else if (player.readiness === 'tentative') grouped.tentative.push(player)
  }
  return grouped
})
const unassignedReadyCount = computed(() => unassignedPlayersByReadiness.value.confirmed.length)
const unassignedTentativeCount = computed(() => unassignedPlayersByReadiness.value.tentative.length)
const unassignedPlayers = computed(() => [
  ...unassignedPlayersByReadiness.value.confirmed,
  ...unassignedPlayersByReadiness.value.tentative,
])

// Group slots into rows: squad headers + slot rows, preserving original indices
const groupedRows = computed(() => {
  const rows = []
  const mission = currentMission.value
  // Build side name → color lookup from mission
  const sideColorMap = {}
  if (mission?.sides) {
    mission.sides.forEach(s => { sideColorMap[s.name] = s.color })
  }

  let lastGroup = null
  slots.value.forEach((slot, idx) => {
    const group = `${slot.side}::${slot.squad}`
    if (group !== lastGroup) {
      const squadSlots = slots.value.filter(s => s.side === slot.side && s.squad === slot.squad)
      rows.push({
        type: 'header',
        side: slot.side,
        squad: slot.squad,
        color: sideColorMap[slot.side] || null,
        count: squadSlots.length,
        assigned: squadSlots.filter(s => s.playerId).length,
      })
      lastGroup = group
    }
    rows.push({ type: 'slot', slot, idx })
  })
  return rows
})

function selectTab(gameId, { syncRoute = true } = {}) {
  activeTab.value = gameId
  editingSlot.value = null
  showEquipmentMenu.value = null
  editingSquadTask.value = false
  squadTaskDraft.value = ''
  editingPersonalTask.value = null
  personalTaskDraft.value = ''
  slotRequestPlayerId.value = null
  if (syncRoute) {
    router.replace({
      query: {
        ...route.query,
        game: gameId,
      },
    })
  }
}

function startAssign(slotIndex) {
  if (!isAdmin.value) return
  openDropdown(slotIndex, 'player')
}

function assignToSlot(slotIndex, player) {
  gamesStore.assignPlayer(activeTab.value, slotIndex, player.uid)
  editingSlot.value = null
}

function unassign(slotIndex) {
  gamesStore.unassignPlayer(activeTab.value, slotIndex)
  editingSlot.value = null
}

function saveNotes(slotIndex) {
  gamesStore.updateSlot(activeTab.value, slotIndex, { notes: editingNotes.value })
}

function toggleEquipment(slotIndex, eqName) {
  const slot = slots.value[slotIndex]
  if (!slot) return
  const current = [...(slot.equipment || [])]
  const idx = current.indexOf(eqName)
  if (idx === -1) current.push(eqName)
  else current.splice(idx, 1)
  gamesStore.updateSlot(activeTab.value, slotIndex, { equipment: current })
}

function resolveSlotPlayer(slot) {
  return slot.playerId ? roster.resolveNickname(slot.playerId) : null
}

function slotPlayerColor(slot) {
  return slot.playerId ? roster.getNicknameColor(slot.playerId) : ''
}

function slotPlayerFrameClass(slot, interactive = false) {
  if (!slot?.playerId) {
    return interactive
      ? 'border-dashed border-neutral-700 hover:border-neutral-500 text-neutral-500'
      : 'border-dashed border-neutral-700 text-neutral-600'
  }

  const status = attendance.getPlayerAttendance(activeTab.value, slot.playerId)
  if (status === 'confirmed') {
    return interactive
      ? 'border-status-confirmed/45 hover:border-status-confirmed/70 text-neutral-200'
      : 'border-status-confirmed/45 text-neutral-200'
  }
  if (status === 'tentative') {
    return interactive
      ? 'border-status-tentative/45 hover:border-status-tentative/70 text-neutral-200'
      : 'border-status-tentative/45 text-neutral-200'
  }
  return interactive
    ? 'border-neutral-700 hover:border-neutral-500 text-neutral-200'
    : 'border-neutral-700 text-neutral-200'
}

const SLOT_TYPE_STYLES = {
  squadCommander: 'bg-delta-green/20 text-delta-green border-delta-green/30',
  sideCommander: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  vehicle: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  reserve: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
}

// Fireteam badge colors — deterministic by name hash
const FT_COLORS = [
  'bg-red-500/20 text-red-300 border-red-500/30',
  'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'bg-orange-500/20 text-orange-300 border-orange-500/30',
]

function ftColor(name) {
  if (!name) return ''
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  return FT_COLORS[Math.abs(hash) % FT_COLORS.length]
}

const showTypeMenu = ref(null)

function setSlotType(slotIndex, type) {
  gamesStore.updateSlot(activeTab.value, slotIndex, { type: type || null })
  showTypeMenu.value = null
}

function saveFireteam(slotIndex, value) {
  gamesStore.updateSlot(activeTab.value, slotIndex, { fireteam: value })
}

// Dropdown positioning: open above if not enough space below
const dropdownUp = ref({}) // { [key]: true/false }

const dropdownRefs = { player: editingSlot, type: showTypeMenu, eq: showEquipmentMenu }

const dropdownPos = ref({})

async function openDropdown(key, refName) {
  const toggleRef = dropdownRefs[refName]
  const wasOpen = toggleRef.value === key

  // Close all
  editingSlot.value = null
  showEquipmentMenu.value = null
  showTypeMenu.value = null

  // Toggle: if was open → stay closed, else open
  if (wasOpen) return
  toggleRef.value = key

  // After render, position the dropdown with fixed coords
  await nextTick()
  const el = document.querySelector(`[data-dropdown="${refName}-${key}"]`)
  if (!el) return
  const trigger = el.parentElement?.querySelector('button, input')
  if (!trigger) return
  const triggerRect = trigger.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const spaceBelow = window.innerHeight - triggerRect.bottom - 8
  const goUp = elRect.height > spaceBelow && triggerRect.top > spaceBelow
  const posKey = `${refName}-${key}`
  dropdownUp.value[posKey] = goUp
  dropdownPos.value[posKey] = {
    left: `${triggerRect.left}px`,
    top: goUp ? 'auto' : `${triggerRect.bottom + 4}px`,
    bottom: goUp ? `${window.innerHeight - triggerRect.top + 4}px` : 'auto',
  }
}

function closeAllPopups() {
  editingSlot.value = null
  showEquipmentMenu.value = null
  showTypeMenu.value = null
  dropdownUp.value = {}
  dropdownPos.value = {}
}

function onScrollClosePopups(e) {
  if (editingSlot.value === null && showEquipmentMenu.value === null && showTypeMenu.value === null) return
  if (e.target?.closest?.('[data-dropdown]')) return
  closeAllPopups()
}

onMounted(() => {
  window.addEventListener('scroll', onScrollClosePopups, true)
})
onUnmounted(() => {
  window.removeEventListener('scroll', onScrollClosePopups, true)
})

function startEditSquadTask() {
  squadTaskDraft.value = currentGame.value?.task || ''
  editingSquadTask.value = true
  nextTick(() => resizeTextarea(squadTaskTextarea))
}

async function saveSquadTask() {
  gamesStore.setTask(activeTab.value, squadTaskDraft.value)
  editingSquadTask.value = false
}

function cancelSquadTaskEdit() {
  squadTaskDraft.value = currentGame.value?.task || ''
  editingSquadTask.value = false
}

// Personal tasks
function startEditPersonalTask(slotIndex) {
  const slot = slots.value[slotIndex]
  if (!slot) return
  personalTaskDraft.value = slot.personalTask || ''
  editingPersonalTask.value = slotIndex
  nextTick(() => resizeTextarea(personalTaskTextarea))
}

async function savePersonalTask(slotIndex) {
  if (slotIndex === null || slotIndex === undefined) return
  gamesStore.updateSlot(activeTab.value, slotIndex, { personalTask: personalTaskDraft.value })
  editingPersonalTask.value = null
  personalTaskDraft.value = ''
}

function cancelEditPersonalTask() {
  editingPersonalTask.value = null
  personalTaskDraft.value = ''
}

// Personal tasks for display below squad task
const personalTasks = computed(() => {
  const result = []
  slots.value.forEach((slot, idx) => {
    if (!slot.personalTask?.trim()) return
    const nickname = slot.playerId ? roster.resolveNickname(slot.playerId) : null
    result.push({
      idx,
      slotNumber: slot.number,
      slotName: slot.name,
      playerId: slot.playerId,
      nickname,
      task: slot.personalTask,
      taskHtml: renderMarkdown(slot.personalTask),
    })
  })
  return result
})

// Visible personal tasks: admin sees all, player sees own
const visiblePersonalTasks = computed(() => {
  if (isAdmin.value) return personalTasks.value
  const uid = auth.player?.uid
  if (!uid) return []
  return personalTasks.value.filter(t => t.playerId === uid)
})

// Can current user add personal task to a slot?
function canEditPersonalTask(slot) {
  if (isAdmin.value) return true
  return slot.playerId && slot.playerId === auth.player?.uid
}

// Slot requests
const slotRequests = computed(() => gamesStore.getSlotRequests(activeTab.value))

const hasMyRequest = computed(() => {
  const uid = auth.player?.uid
  if (!uid) return false
  return slotRequests.value.some(r => r.playerId === uid)
})

function canManageSlotRequest(request) {
  return isAdmin.value || request?.playerId === auth.player?.uid
}

function openSlotRequestModal(playerId = auth.player?.uid) {
  slotRequestPlayerId.value = playerId || auth.player?.uid || null
  showSlotRequestModal.value = true
}

async function removeSlotRequest(request) {
  if (!request) return
  await gamesStore.removeSlotRequest(activeTab.value, request.id ?? slotRequests.value.indexOf(request))
}

function requestRemoveSlotRequest(request) {
  if (!request) return
  requestConfirmation({
    title: 'Удалить запрос',
    message: 'Удалить этот запрос на слот?',
    details: [
      `Игрок: ${roster.resolveNickname(request.playerId)}`,
      request.slots?.length ? `Слоты: ${request.slots.map(slot => `${slot.squad} #${slot.number}`).join(', ')}` : 'Слоты не указаны',
    ],
    confirmLabel: 'Удалить',
    tone: 'danger',
    onConfirm: () => removeSlotRequest(request),
  })
}

async function openSlotRequestsSection() {
  requestsCollapsed.value = false
  await nextTick()
  slotRequestsSection.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

async function openUnassignedPlayersSection() {
  if (!unassignedPlayers.value.length) return
  await nextTick()
  unassignedPlayersSection.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

async function confirmClearLineup() {
  requestConfirmation({
    title: 'Очистить расстановку',
    message: 'Убрать все назначения и настройки текущей расстановки?',
    details: ['Миссия останется, но слоты, назначения и запросы по текущей игре будут очищены.'],
    confirmLabel: 'Очистить',
    tone: 'danger',
    onConfirm: () => gamesStore.clearGame(activeTab.value),
  })
}

async function confirmClearGame() {
  requestConfirmation({
    title: 'Удалить миссию',
    message: 'Удалить текущую миссию вместе с расстановкой?',
    details: ['Будут удалены миссия, слоты, назначения и связанные данные текущей игры.'],
    confirmLabel: 'Удалить',
    tone: 'danger',
    onConfirm: () => Promise.all([
      gamesStore.clearGame(activeTab.value),
      missionsStore.clearMission(activeTab.value),
    ]),
  })
}

function sideColorForName(sideName) {
  const mission = currentMission.value
  if (!mission?.sides) return null
  const side = mission.sides.find(s => s.name === sideName)
  return side ? SIDE_COLORS[side.color] : null
}

function slotRequestTagClass(sideName) {
  const c = sideColorForName(sideName)
  if (!c) return 'bg-neutral-700/50 border-neutral-700 text-neutral-400'
  return `${c.bg} ${c.border} ${c.text}`
}

function readinessDot(status) {
  const map = {
    confirmed: 'bg-status-confirmed',
    tentative: 'bg-status-tentative',
    absent: 'bg-status-absent',
    no_response: 'bg-neutral-600',
  }
  return map[status] || map.no_response
}

function readinessPillClass(status) {
  const map = {
    confirmed: 'border-status-confirmed/35 bg-status-confirmed/10 text-neutral-100',
    tentative: 'border-status-tentative/35 bg-status-tentative/10 text-neutral-100',
  }
  return map[status] || 'border-neutral-700 bg-neutral-800/60 text-neutral-400'
}

function readinessLabel(status) {
  const map = {
    confirmed: 'Буду',
    tentative: 'Возможно',
  }
  return map[status] || 'Не назначен'
}

// Slot notifications
const slotNotifSending = ref({})
const slotNotifSent = ref({})

function getPlayerTelegramId(playerId) {
  const p = roster.players.find(r => r.uid === playerId)
  return p?.telegramId || null
}

async function sendSlotNotification(slot, slotIdx) {
  const telegramId = getPlayerTelegramId(slot.playerId)
  const nickname = roster.resolveNickname(slot.playerId)
  if (!telegramId) {
    toast.error(`${nickname} не указал Telegram ID в профиле`)
    return
  }

  slotNotifSending.value[slotIdx] = true
  const game = games.value.find(g => g.id === activeTab.value)
  const dayLabel = game?.day === 'friday' ? 'Пятница' : 'Суббота'
  const gameDate = game ? gameDates.value[game.day] : ''
  const missionNumber = game?.id?.endsWith('_2') ? 2 : 1
  const mission = currentMission.value

  const msg = telegram.buildSlotNotification({
    slot: { ...slot, gameId: activeTab.value },
    dayLabel,
    gameDate,
    missionTitle: mission?.title || '',
    missionNumber,
  })
  const result = await telegram.sendMessage(msg, { chatId: telegramId })

  slotNotifSending.value[slotIdx] = false
  if (result.ok) {
    await writeAuditLog({
      action: 'send',
      entityType: 'telegram',
      entityId: `slot-notification:${activeTab.value}:${slotIdx}`,
      summary: `telegram - send - slot-notification:${activeTab.value}:${slotIdx}`,
      after: {
        gameId: activeTab.value,
        slotIndex: slotIdx,
        slotNumber: slot.number,
        playerId: slot.playerId,
        telegramId,
        missionTitle: mission?.title || '',
      },
    })
    slotNotifSent.value[slotIdx] = true
    setTimeout(() => { slotNotifSent.value[slotIdx] = false }, 2000)
    toast.success(`Уведомление отправлено — ${nickname}`)
  } else {
    const err = result.error || ''
    if (err.includes('Forbidden') || err.includes('bot can\'t initiate')) {
      toast.error(`${nickname} не начал чат с ботом. Пусть откроет @TSGDeltaOps_bot и нажмёт /start`)
    } else if (err.includes('chat not found')) {
      toast.error(`Telegram ID игрока ${nickname} неверный. Пусть обновит ID в профиле`)
    } else {
      toast.error(`Ошибка отправки для ${nickname}: ${err}`)
    }
  }
}
</script>

<template>
  <div class="pb-20 md:pb-0">
    <LoadingSpinner v-if="pageLoading" />
    <template v-else>
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div>
        <h1 class="text-2xl font-bold">Расстановка</h1>
        <p class="text-sm text-neutral-500">Пт {{ gameDates.friday }} — Сб {{ gameDates.saturday }}</p>
      </div>
      <!-- Mobile: collapsible actions toggle -->
      <button @click="actionsExpanded = !actionsExpanded"
        class="sm:hidden px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-600/30 text-neutral-300 rounded-lg transition-colors inline-flex items-center gap-1.5">
        <svg class="w-3 h-3 transition-transform" :class="{ 'rotate-180': actionsExpanded }" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
        Действия
      </button>
      <!-- Actions: wrap on tablet, collapse on mobile -->
      <div :class="['flex-wrap items-center justify-end gap-1.5', actionsExpanded ? 'flex' : 'hidden sm:flex']">
        <button v-if="isAdmin && slots.length"
          @click="requestConfirmation({
            title: 'Отправить расстановку',
            message: 'Отправить текущую расстановку недели в Telegram?',
            details: ['Будет отправлена общая сводка по всем дням и миссиям с назначенными слотами.'],
            confirmLabel: 'Отправить',
            tone: 'warning',
            onConfirm: sendLineupToTelegram,
          })" :disabled="telegram.sending.value"
          class="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-sky-500/30 hover:border-sky-500/60 text-sky-400 hover:text-sky-300 rounded-lg transition-colors inline-flex items-center gap-1.5 disabled:opacity-50">
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
          {{ telegram.sending.value ? '...' : 'Расстановка' }}
        </button>
        <button v-if="currentMission && auth.isUserMember && auth.player?.uid"
          @click="openSlotRequestModal()"
          class="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-delta-green/30 hover:border-delta-green/60 text-delta-green hover:text-delta-green/80 rounded-lg transition-colors">
          {{ hasMyRequest ? 'Изменить запрос' : 'Запросить слот' }}
        </button>
        <button v-if="isAdmin && currentMission"
          @click="showSlotConfigurator = true"
          class="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-amber-500/30 hover:border-amber-500/60 text-amber-400 hover:text-amber-300 rounded-lg transition-colors">
          Настроить слоты
        </button>
        <button v-if="isAdmin && gamesStore.getGame(activeTab)"
          @click="confirmClearLineup"
          class="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-purple-500/30 hover:border-purple-500/60 text-purple-400 hover:text-purple-300 rounded-lg transition-colors">
          Очистить расстановку
        </button>
        <button v-if="isAdmin && (currentMission || gamesStore.getGame(activeTab))"
          @click="confirmClearGame"
          class="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-red-500/30 hover:border-red-500/60 text-red-400 hover:text-red-300 rounded-lg transition-colors">
          Удалить миссию
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-4 bg-neutral-900 rounded-xl p-1 border border-neutral-800">
      <button v-for="game in games" :key="game.id"
        @click="selectTab(game.id)"
        :class="[
          'flex-1 py-2 text-sm font-medium rounded-lg transition-all',
          activeTab === game.id
            ? 'bg-delta-green text-white shadow'
            : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
        ]">
        {{ game.label }}
      </button>
    </div>

    <!-- Mission info card -->
    <div v-if="currentMission" class="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden mb-4">
      <!-- Color bar -->
      <div class="flex h-1">
        <div v-for="side in currentMission.sides" :key="'bar-'+side.name"
          :class="[SIDE_COLORS[side.color]?.dot || 'bg-neutral-500', 'flex-1']"
          :style="{ flex: side.players }">
        </div>
      </div>

      <!-- Row 1: General mission info -->
      <div class="px-4 pt-3 pb-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-neutral-800/50">
        <h3 class="text-sm font-bold text-white">{{ currentMission.title }}</h3>
        <div class="flex items-center gap-2 text-xs text-neutral-400">
          <span class="flex items-center gap-1">
            <svg class="w-3 h-3 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            {{ currentMission.map }}
          </span>
          <span class="text-neutral-700">|</span>
          <span>{{ currentMission.sides.reduce((s, side) => s + (side.players || 0), 0) }} слотов</span>
        </div>
        <div v-if="currentMission.version" class="text-[10px] px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-500 font-mono">
          v{{ currentMission.version }}
        </div>
        <a v-if="currentMission.sourceUrl" :href="currentMission.sourceUrl" target="_blank" rel="noopener"
          class="ml-auto text-neutral-600 hover:text-neutral-400 transition-colors text-xs">
          tsgames.ru →
        </a>
        <div v-if="currentMission.description" class="w-full text-[11px] text-neutral-500 line-clamp-2 leading-relaxed mt-1">
          {{ currentMission.description }}
        </div>
      </div>

      <!-- Row 2: Sides — two columns on sm+, stacked collapsible on mobile -->
      <div class="grid grid-cols-1 sm:grid-cols-2">
        <!-- Helper: side panel macro via v-for over grouped teams -->
        <template v-if="missionsStore.getGroupedSides(currentMission, squadConfig.side)">
          <!-- Allies panel -->
          <div class="p-3 sm:border-r border-neutral-800/50"
            :style="{ borderTopColor: `rgba(${(SIDE_COLORS[allySides[0]?.color] || {}).raw || '163,163,163'}, 0.15)` }">
            <button @click="alliesExpanded = !alliesExpanded"
              class="sm:pointer-events-none flex items-center justify-between w-full group/hdr">
              <div class="flex items-center gap-2">
                <span class="text-[10px] uppercase tracking-wider font-medium"
                  :class="SIDE_COLORS[allySides[0]?.color]?.text || 'text-neutral-500'">Союзники</span>
                <span class="text-[10px] font-mono text-neutral-600">
                  {{ missionsStore.getGroupedSides(currentMission, squadConfig.side).ally.reduce((s, side) => s + (side.players || 0), 0) }}
                </span>
              </div>
              <svg class="w-3.5 h-3.5 text-neutral-600 transition-transform sm:hidden"
                :class="{ 'rotate-180': alliesExpanded }" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
              </svg>
            </button>
            <div :class="[alliesExpanded ? 'block' : 'hidden sm:block', 'mt-2 space-y-1.5']">
              <div v-for="side in missionsStore.getGroupedSides(currentMission, squadConfig.side).ally" :key="side.name"
                class="text-xs">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <span :class="[SIDE_COLORS[side.color]?.dot || 'bg-neutral-500', 'w-2 h-2 rounded-full shrink-0']"></span>
                    <span :class="SIDE_COLORS[side.color]?.text || 'text-neutral-400'" class="font-medium">{{ side.name }}</span>
                    <span v-if="missionsStore.getSideFaction(currentMission, side.color)" class="text-neutral-500">{{ missionsStore.getSideFaction(currentMission, side.color) }}</span>
                    <span v-if="side.role && side.role !== 'Неопределено'" class="text-neutral-600">({{ side.role }})</span>
                  </div>
                  <span class="font-mono text-neutral-500">{{ side.players }}</span>
                </div>
                <div v-if="side.vehicles" class="ml-3.5 mt-1 flex items-center gap-1.5 text-[12px] text-neutral-400">
                  <svg class="w-3.5 h-3.5 shrink-0 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span class="leading-relaxed">{{ side.vehicles }}</span>
                </div>
              </div>
              <button v-if="allyGalleryImages.length"
                @click="openGallery(allyGalleryImages, 0, 'Союзники')"
                :style="galleryBtnStyle(allySides)"
                class="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-opacity hover:opacity-80 text-xs">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span class="font-medium">Галерея</span>
                <span class="text-[10px] font-mono opacity-70">{{ allyGalleryImages.length }}</span>
              </button>
            </div>
          </div>

          <!-- Enemies panel -->
          <div class="p-3 border-t sm:border-t-0 border-neutral-800/50">
            <button @click="enemiesExpanded = !enemiesExpanded"
              class="sm:pointer-events-none flex items-center justify-between w-full group/hdr">
              <div class="flex items-center gap-2">
                <span class="text-[10px] uppercase tracking-wider font-medium"
                  :class="SIDE_COLORS[enemySides[0]?.color]?.text || 'text-neutral-500'">Противники</span>
                <span class="text-[10px] font-mono text-neutral-600">
                  {{ missionsStore.getGroupedSides(currentMission, squadConfig.side).enemy.reduce((s, side) => s + (side.players || 0), 0) }}
                </span>
              </div>
              <svg class="w-3.5 h-3.5 text-neutral-600 transition-transform sm:hidden"
                :class="{ 'rotate-180': enemiesExpanded }" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
              </svg>
            </button>
            <div :class="[enemiesExpanded ? 'block' : 'hidden sm:block', 'mt-2 space-y-1.5']">
              <div v-for="side in missionsStore.getGroupedSides(currentMission, squadConfig.side).enemy" :key="side.name"
                class="text-xs">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <span :class="[SIDE_COLORS[side.color]?.dot || 'bg-neutral-500', 'w-2 h-2 rounded-full shrink-0']"></span>
                    <span :class="SIDE_COLORS[side.color]?.text || 'text-neutral-400'" class="font-medium">{{ side.name }}</span>
                    <span v-if="missionsStore.getSideFaction(currentMission, side.color)" class="text-neutral-500">{{ missionsStore.getSideFaction(currentMission, side.color) }}</span>
                    <span v-if="side.role && side.role !== 'Неопределено'" class="text-neutral-600">({{ side.role }})</span>
                  </div>
                  <span class="font-mono text-neutral-500">{{ side.players }}</span>
                </div>
                <div v-if="side.vehicles" class="ml-3.5 mt-1 flex items-center gap-1.5 text-[12px] text-neutral-400">
                  <svg class="w-3.5 h-3.5 shrink-0 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span class="leading-relaxed">{{ side.vehicles }}</span>
                </div>
              </div>
              <button v-if="enemyGalleryImages.length"
                @click="openGallery(enemyGalleryImages, 0, 'Противники')"
                :style="galleryBtnStyle(enemySides)"
                class="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-opacity hover:opacity-80 text-xs">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span class="font-medium">Галерея</span>
                <span class="text-[10px] font-mono opacity-70">{{ enemyGalleryImages.length }}</span>
              </button>
            </div>
          </div>
        </template>

        <!-- Fallback: no grouped sides — single flat panel -->
        <template v-else>
          <div class="p-3 sm:col-span-2">
            <div class="space-y-1.5">
              <div v-for="side in currentMission.sides" :key="side.name" class="text-xs">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <span :class="[SIDE_COLORS[side.color]?.dot || 'bg-neutral-500', 'w-2 h-2 rounded-full shrink-0']"></span>
                    <span :class="SIDE_COLORS[side.color]?.text || 'text-neutral-400'" class="font-medium">{{ side.name }}</span>
                    <span v-if="missionsStore.getSideFaction(currentMission, side.color)" class="text-neutral-500">{{ missionsStore.getSideFaction(currentMission, side.color) }}</span>
                  </div>
                  <span class="font-mono text-neutral-500">{{ side.players }}</span>
                </div>
              </div>
            </div>
            <button v-if="galleryImages.length"
              @click="openGallery(galleryImages)"
              class="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-delta-green/15 text-delta-green hover:bg-delta-green/25 border border-delta-green/30 transition-colors text-xs">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span class="font-medium">Галерея</span>
              <span class="text-[10px] font-mono opacity-70">{{ galleryImages.length }}</span>
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Stats bar -->
    <div v-if="slots.length" class="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
      <div class="rounded-xl border border-neutral-800 bg-neutral-900/70 px-2.5 py-1.5">
        <div class="text-[11px] uppercase tracking-[0.12em] text-neutral-600">Слотов</div>
        <div class="mt-0.5 text-base font-semibold text-neutral-100 font-mono">{{ combatSlotsCount }}</div>
      </div>
      <div class="rounded-xl border border-neutral-800 bg-neutral-900/70 px-2.5 py-1.5">
        <div class="text-[11px] uppercase tracking-[0.12em] text-neutral-600">Назначено</div>
        <div class="mt-0.5 text-base font-semibold text-delta-green font-mono">{{ assignedCombatSlotsCount }}</div>
      </div>
      <div class="rounded-xl border border-neutral-800 bg-neutral-900/70 px-2.5 py-1.5">
        <div class="text-[11px] uppercase tracking-[0.12em] text-neutral-600">Свободно</div>
        <div class="mt-0.5 text-base font-semibold text-neutral-100 font-mono">{{ freeCombatSlotsCount }}</div>
      </div>
      <div class="rounded-xl border border-neutral-800 bg-neutral-900/70 px-2.5 py-1.5">
        <div class="text-[11px] uppercase tracking-[0.12em] text-neutral-600">Резерв</div>
        <div class="mt-0.5 text-base font-semibold text-amber-300 font-mono">{{ reserveSlotsCount }}</div>
      </div>
      <button
        type="button"
        @click="openUnassignedPlayersSection"
        :disabled="!unassignedPlayers.length"
        :class="[
          'rounded-xl border px-2.5 py-1.5 text-left transition-colors',
          unassignedPlayers.length
            ? 'border-neutral-800 bg-neutral-900/70 hover:border-neutral-700 hover:bg-neutral-900'
            : 'border-neutral-800 bg-neutral-900/50'
        ]"
      >
        <div class="text-[11px] uppercase tracking-[0.12em] text-neutral-600">Не назначено</div>
        <div class="mt-0.5 flex items-center gap-2 text-base font-semibold font-mono">
          <span class="text-status-confirmed">{{ unassignedReadyCount }}</span>
          <span class="text-neutral-700">•</span>
          <span class="text-status-tentative">{{ unassignedTentativeCount }}</span>
        </div>
      </button>
      <button
        type="button"
        @click="slotRequests.length ? openSlotRequestsSection() : null"
        :disabled="!slotRequests.length"
        :class="[
          'rounded-xl border px-2.5 py-1.5 text-left transition-colors',
          slotRequests.length
            ? 'border-red-500/35 bg-red-500/10 hover:border-red-500/50 hover:bg-red-500/15'
            : 'border-neutral-800 bg-neutral-900/50'
        ]"
      >
        <div :class="['text-[11px] uppercase tracking-[0.12em]', slotRequests.length ? 'text-red-300/85' : 'text-neutral-600']">Запросы</div>
        <div :class="['mt-0.5 text-base font-semibold font-mono', slotRequests.length ? 'text-red-200' : 'text-neutral-300']">
          {{ slotRequests.length }}
        </div>
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="!slots.length" class="bg-neutral-900 rounded-xl border border-neutral-800 p-12 text-center">
      <p class="text-neutral-500 mb-3">Расстановка пуста</p>
      <button v-if="isAdmin && currentMission" @click="showSlotConfigurator = true"
        class="px-4 py-2 bg-delta-green hover:bg-delta-green/80 text-white text-sm font-medium rounded-lg transition-colors">
        Настроить слоты
      </button>
      <p v-else-if="isAdmin" class="text-xs text-neutral-600">Загрузите миссию через Extension</p>
    </div>

    <!-- Lineup table -->
    <div v-else class="bg-neutral-900 rounded-xl border border-neutral-800">
      <!-- Backdrop to close popups -->
      <div v-if="editingSlot !== null || showEquipmentMenu !== null || showTypeMenu !== null"
        class="fixed inset-0 z-20" @click="closeAllPopups"></div>

      <!-- Desktop/Tablet table -->
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-sm" style="min-width:60rem">
          <thead>
            <tr class="border-b border-neutral-800 text-neutral-500 text-xs">
              <th class="text-left px-4 py-2.5 font-medium w-10">#</th>
              <th class="text-left px-3 py-2.5 font-medium w-48">Слот</th>
              <th class="text-left px-3 py-2.5 font-medium w-28">Тип</th>
              <th class="text-left px-3 py-2.5 font-medium w-14">ФТ</th>
              <th class="text-left px-3 py-2.5 font-medium w-40">Позывной</th>
              <th class="text-left px-3 py-2.5 font-medium" style="min-width:14rem">Снаряжение</th>
              <th class="text-left px-3 py-2.5 font-medium" style="min-width:12rem">Заметки</th>
              <th class="text-center px-2 py-2.5 font-medium w-10">
                <svg class="w-3.5 h-3.5 mx-auto text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </th>
              <th v-if="isAdmin" class="text-center px-1 py-2.5 font-medium w-8">
                <svg class="w-3.5 h-3.5 mx-auto text-neutral-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(row, rowIdx) in groupedRows" :key="rowIdx">
              <!-- Squad header row -->
              <tr v-if="row.type === 'header'"
                :class="[
                  'border-b border-neutral-800',
                  SIDE_COLORS[row.color]?.bg || 'bg-neutral-800/60'
                ]">
                <td :colspan="isAdmin ? 9 : 8" class="px-4 py-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span :class="[SIDE_COLORS[row.color]?.dot || 'bg-neutral-500', 'w-2 h-2 rounded-full']"></span>
                      <span :class="[SIDE_COLORS[row.color]?.text || 'text-neutral-400', 'text-xs font-bold uppercase tracking-wider']">
                        {{ row.side }}
                      </span>
                      <span class="text-neutral-600 mx-1">›</span>
                      <span class="text-xs font-medium text-neutral-300">{{ row.squad }}</span>
                    </div>
                    <span class="text-[10px] font-mono text-neutral-500">
                      {{ row.assigned }}/{{ row.count }}
                    </span>
                  </div>
                </td>
              </tr>

              <!-- Slot row -->
              <tr v-else
                class="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                <td class="px-4 py-2.5 font-mono text-sm text-neutral-200">{{ row.slot.number }}</td>

                <!-- Slot name -->
                <td class="px-3 py-2.5 truncate" :title="row.slot.name">{{ row.slot.name }}</td>

                <!-- Type (selector) -->
                <td class="px-3 py-2.5">
                  <button v-if="isAdmin"
                    @click.stop="openDropdown(row.idx, 'type')"
                    :class="[
                      'px-2 py-1 rounded text-xs border transition-colors w-full text-left truncate',
                      row.slot.type
                        ? SLOT_TYPE_STYLES[row.slot.type] || 'bg-neutral-700 text-neutral-400 border-neutral-600'
                        : 'bg-transparent text-neutral-600 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-400'
                    ]">
                    {{ SLOT_TYPES[row.slot.type]?.label || '—' }}
                  </button>
                  <span v-else-if="row.slot.type"
                    :class="[
                      'px-2 py-1 rounded text-xs border inline-block',
                      SLOT_TYPE_STYLES[row.slot.type] || 'bg-neutral-700 text-neutral-400 border-neutral-600'
                    ]">
                    {{ SLOT_TYPES[row.slot.type]?.label }}
                  </span>
                  <span v-else class="text-neutral-600 text-xs">—</span>

                  <!-- Type dropdown -->
                  <div v-if="showTypeMenu === row.idx"
                    :data-dropdown="'type-' + row.idx"
                    class="fixed bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-30 w-44 py-1"
                    :style="dropdownPos['type-' + row.idx]"
                    @click.stop>
                    <button @click="setSlotType(row.idx, null)"
                      :class="['w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-700 transition-colors',
                        !row.slot.type ? 'text-white' : 'text-neutral-400']">
                      — нет —
                    </button>
                    <button v-for="(cfg, key) in SLOT_TYPES" :key="key"
                      @click="setSlotType(row.idx, key)"
                      :class="['w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-700 transition-colors flex items-center gap-2',
                        row.slot.type === key ? 'text-white' : 'text-neutral-400']">
                      <span :class="[SLOT_TYPE_STYLES[key]?.split(' ')[1] || '', 'font-medium']">{{ cfg.label }}</span>
                    </button>
                  </div>
                </td>

                <!-- Fireteam (colored badge) -->
                <td class="px-3 py-2.5">
                  <input v-if="isAdmin"
                    :value="row.slot.fireteam || ''"
                    @blur="saveFireteam(row.idx, $event.target.value)"
                    @keydown.enter="$event.target.blur()"
                    placeholder="—"
                    :class="[
                      'w-full text-center text-xs font-mono outline-none py-0.5 px-1 rounded border transition-colors',
                      row.slot.fireteam
                        ? ftColor(row.slot.fireteam) + ' focus:border-delta-green'
                        : 'bg-transparent border-transparent text-neutral-600 hover:border-neutral-700 focus:border-delta-green focus:text-neutral-200'
                    ]">
                  <span v-else-if="row.slot.fireteam"
                    :class="['px-1.5 py-0.5 rounded text-xs font-mono border inline-block', ftColor(row.slot.fireteam)]">
                    {{ row.slot.fireteam }}
                  </span>
                  <span v-else class="text-neutral-600 text-xs">—</span>
                </td>

                <!-- Assigned player -->
                <td class="px-3 py-2.5">
                  <button v-if="isAdmin"
                    @click.stop="openDropdown(row.idx, 'player')"
                    :class="[
                      'w-full text-left px-2 py-1 rounded-lg text-sm transition-all border truncate',
                      slotPlayerFrameClass(row.slot, true)
                    ]"
                    :style="slotPlayerColor(row.slot) ? { color: slotPlayerColor(row.slot) } : {}">
                    {{ resolveSlotPlayer(row.slot) || '—' }}
                  </button>
                  <span v-else
                    :class="[
                      'inline-flex max-w-full rounded-lg border px-2 py-1 text-sm truncate',
                      slotPlayerFrameClass(row.slot, false)
                    ]"
                    :style="slotPlayerColor(row.slot) ? { color: slotPlayerColor(row.slot) } : {}">
                    {{ resolveSlotPlayer(row.slot) || '—' }}
                  </span>

                  <!-- Player dropdown -->
                  <div v-if="editingSlot === row.idx"
                    :data-dropdown="'player-' + row.idx"
                    class="fixed bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-30 w-56 max-h-64 overflow-y-auto"
                    :style="dropdownPos['player-' + row.idx]"
                    @click.stop>
                    <button v-if="row.slot.playerId" @click="unassign(row.idx)"
                      class="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-neutral-700 border-b border-neutral-700">
                      Убрать
                    </button>
                    <button v-for="p in availablePlayers" :key="p.uid"
                      @click="assignToSlot(row.idx, p)"
                      class="w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 transition-colors flex items-center gap-2 text-neutral-300">
                      <span :class="[readinessDot(p.readiness), 'w-2 h-2 rounded-full shrink-0']"></span>
                      <span :style="p.nicknameColor ? { color: p.nicknameColor } : {}">{{ p.nickname }}</span>
                    </button>
                  </div>
                </td>

                <!-- Equipment -->
                <td class="px-3 py-2.5">
                  <div class="flex flex-wrap gap-1 items-center">
                                  <EquipmentTag v-for="eq in (row.slot.equipment || [])" :key="eq" :name="eq" size="md" />
                    <button v-if="isAdmin"
                      @click.stop="openDropdown(row.idx, 'eq')"
                      class="w-5 h-5 rounded text-[10px] bg-neutral-800 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700 transition-colors flex items-center justify-center">
                      +
                    </button>
                  </div>

                  <!-- Equipment dropdown -->
                  <div v-if="showEquipmentMenu === row.idx"
                    :data-dropdown="'eq-' + row.idx"
                    class="fixed bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-30 p-2 min-w-40 max-h-64 overflow-y-auto"
                    :style="dropdownPos['eq-' + row.idx]"
                    @click.stop>
                    <div v-for="eq in squadConfig.equipmentNames" :key="eq"
                      class="px-2 py-1 hover:bg-neutral-700 rounded">
                      <BaseCheckbox
                        :checked="(row.slot.equipment || []).includes(eq)"
                        @change="toggleEquipment(row.idx, eq)"
                        size="sm"
                      >
                        <span class="text-xs text-neutral-300">{{ eq }}</span>
                      </BaseCheckbox>
                    </div>
                  </div>
                </td>

                <!-- Notes -->
                <td class="px-3 py-2.5">
                  <textarea v-if="isAdmin"
                    :value="row.slot.notes || ''"
                    @focus="editingNotes = row.slot.notes || ''"
                    @input="editingNotes = $event.target.value; $event.target.style.height = 'auto'; $event.target.style.height = $event.target.scrollHeight + 'px'"
                    @blur="saveNotes(row.idx)"
                    @keydown.enter.exact="$event.target.blur()"
                    rows="1"
                    placeholder="—"
                    class="w-full bg-transparent border-b border-transparent hover:border-neutral-700 focus:border-delta-green text-sm text-neutral-400 focus:text-neutral-200 outline-none py-0.5 transition-colors resize-none overflow-hidden"></textarea>
                  <span v-else class="text-neutral-500 text-xs break-words">{{ row.slot.notes || '—' }}</span>
                </td>

                <!-- Personal task indicator -->
                <td class="px-2 py-2.5 text-center">
                  <button v-if="canEditPersonalTask(row.slot)"
                    @click="startEditPersonalTask(row.idx)"
                    :class="[
                      'w-6 h-6 rounded flex items-center justify-center transition-colors mx-auto',
                      row.slot.personalTask
                        ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                        : 'text-neutral-600 hover:text-neutral-400 hover:bg-neutral-800'
                    ]"
                    :title="row.slot.personalTask || 'Добавить личную задачу'">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </button>
                  <span v-else-if="row.slot.personalTask" class="text-amber-500/50">
                    <svg class="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </span>
                </td>
                <!-- Telegram notify -->
                <td v-if="isAdmin" class="px-1 py-2.5 text-center">
                  <button v-if="row.slot.playerId && getPlayerTelegramId(row.slot.playerId)"
                    @click.stop="sendSlotNotification(row.slot, row.idx)"
                    :disabled="slotNotifSending[row.idx]"
                    :class="[
                      'w-6 h-6 rounded flex items-center justify-center transition-colors mx-auto',
                      slotNotifSent[row.idx]
                        ? 'text-emerald-400'
                        : 'text-sky-500/40 hover:text-sky-400 hover:bg-sky-500/10'
                    ]"
                    :title="slotNotifSent[row.idx] ? 'Отправлено' : 'Уведомить в Telegram'">
                    <svg v-if="slotNotifSent[row.idx]" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <svg v-else class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                  </button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <div class="md:hidden divide-y divide-neutral-800/50">
        <template v-for="(row, rowIdx) in groupedRows" :key="rowIdx">
          <!-- Squad header (mobile) -->
          <div v-if="row.type === 'header'"
            :class="[
              'px-4 py-2.5 flex items-center justify-between',
              SIDE_COLORS[row.color]?.bg || 'bg-neutral-800/60'
            ]">
            <div class="flex items-center gap-2">
              <span :class="[SIDE_COLORS[row.color]?.dot || 'bg-neutral-500', 'w-2 h-2 rounded-full']"></span>
              <span :class="[SIDE_COLORS[row.color]?.text || 'text-neutral-400', 'text-xs font-bold uppercase tracking-wider']">
                {{ row.side }}
              </span>
              <span class="text-neutral-600 mx-0.5">›</span>
              <span class="text-xs font-medium text-neutral-300">{{ row.squad }}</span>
            </div>
            <span class="text-[10px] font-mono text-neutral-500">{{ row.assigned }}/{{ row.count }}</span>
          </div>

          <!-- Slot card (mobile) -->
          <div v-else class="px-4 py-3 space-y-2">
            <!-- Row 1: Number + Name (left) | Player (right) -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-xs font-mono font-semibold text-neutral-200 shrink-0">{{ row.slot.number }}</span>
                <span class="text-sm font-medium truncate">{{ row.slot.name }}</span>
              </div>
              <button v-if="isAdmin" @click="startAssign(row.idx)"
                :class="['text-sm px-2.5 py-1 rounded-lg transition-all shrink-0 max-w-[45%] truncate border',
                  slotPlayerFrameClass(row.slot, true)]"
                :style="slotPlayerColor(row.slot) ? { color: slotPlayerColor(row.slot) } : {}">
                {{ resolveSlotPlayer(row.slot) || '— свободно —' }}
              </button>
              <span v-else
                :class="[
                  'text-sm shrink-0 rounded-lg border px-2.5 py-1',
                  slotPlayerFrameClass(row.slot, false)
                ]"
                :style="slotPlayerColor(row.slot) ? { color: slotPlayerColor(row.slot) } : {}">
                {{ resolveSlotPlayer(row.slot) || '—' }}
              </span>
            </div>

            <!-- Mobile player dropdown -->
            <div v-if="editingSlot === row.idx"
              class="relative z-30 bg-neutral-800 border border-neutral-700 rounded-lg max-h-48 overflow-y-auto">
              <button v-if="row.slot.playerId" @click="unassign(row.idx)"
                class="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-neutral-700 border-b border-neutral-700">
                Убрать
              </button>
              <button v-for="p in availablePlayers" :key="p.uid"
                @click="assignToSlot(row.idx, p)"
                class="w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 flex items-center gap-2 text-neutral-300">
                <span :class="[readinessDot(p.readiness), 'w-2 h-2 rounded-full']"></span>
                <span :style="p.nicknameColor ? { color: p.nicknameColor } : {}">{{ p.nickname }}</span>
              </button>
            </div>

            <!-- Row 2: Type + FT -->
            <div v-if="isAdmin || row.slot.type || row.slot.fireteam" class="flex items-center gap-2">
              <button v-if="isAdmin"
                @click.stop="openDropdown(row.idx, 'type')"
                :class="[
                  'px-2 py-1 rounded text-[10px] font-medium border transition-colors',
                  row.slot.type
                    ? SLOT_TYPE_STYLES[row.slot.type] || 'bg-neutral-700 text-neutral-400 border-neutral-600'
                    : 'bg-transparent text-neutral-600 border-neutral-700/50 hover:border-neutral-600'
                ]">
                {{ SLOT_TYPES[row.slot.type]?.label || 'Тип' }}
              </button>
              <span v-else-if="row.slot.type"
                :class="['px-2 py-1 rounded text-[10px] font-medium border', SLOT_TYPE_STYLES[row.slot.type] || 'bg-neutral-700 text-neutral-400 border-neutral-600']">
                {{ SLOT_TYPES[row.slot.type]?.label }}
              </span>

              <!-- Mobile type dropdown -->
              <div v-if="showTypeMenu === row.idx"
                class="relative z-30 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl py-1">
                <button @click="setSlotType(row.idx, null)"
                  :class="['w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-700 transition-colors',
                    !row.slot.type ? 'text-white' : 'text-neutral-400']">
                  — нет —
                </button>
                <button v-for="(cfg, key) in SLOT_TYPES" :key="key"
                  @click="setSlotType(row.idx, key)"
                  :class="['w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-700 transition-colors',
                    row.slot.type === key ? 'text-white' : 'text-neutral-400']">
                  <span :class="[SLOT_TYPE_STYLES[key]?.split(' ')[1] || '', 'font-medium']">{{ cfg.label }}</span>
                </button>
              </div>

              <input v-if="isAdmin"
                :value="row.slot.fireteam || ''"
                @blur="saveFireteam(row.idx, $event.target.value)"
                @keydown.enter="$event.target.blur()"
                placeholder="ФТ"
                :class="[
                  'w-12 text-center text-[10px] font-mono outline-none py-1 px-1.5 rounded border transition-colors',
                  row.slot.fireteam
                    ? ftColor(row.slot.fireteam) + ' focus:border-delta-green'
                    : 'bg-transparent border-neutral-700/50 text-neutral-600 hover:border-neutral-600 focus:border-delta-green focus:text-neutral-200'
                ]">
              <span v-else-if="row.slot.fireteam"
                :class="['px-1.5 py-0.5 rounded text-[10px] font-mono border', ftColor(row.slot.fireteam)]">
                {{ row.slot.fireteam }}
              </span>
            </div>

            <!-- Row 3: Equipment -->
            <div v-if="isAdmin || (row.slot.equipment && row.slot.equipment.length)" class="flex flex-wrap items-center gap-1">
                              <EquipmentTag v-for="eq in (row.slot.equipment || [])" :key="eq" :name="eq" size="md" />
              <button v-if="isAdmin"
                @click.stop="openDropdown(row.idx, 'eq')"
                class="w-5 h-5 rounded text-[10px] bg-neutral-800 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700 transition-colors flex items-center justify-center">
                +
              </button>
              <!-- Mobile equipment dropdown -->
              <div v-if="showEquipmentMenu === row.idx"
                class="relative z-30 w-full mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl p-2 max-h-48 overflow-y-auto">
                <div v-for="eq in squadConfig.equipmentNames" :key="eq"
                  class="px-2 py-1 hover:bg-neutral-700 rounded">
                  <BaseCheckbox
                    :checked="(row.slot.equipment || []).includes(eq)"
                    @change="toggleEquipment(row.idx, eq)"
                    size="sm"
                  >
                    <span class="text-xs text-neutral-300">{{ eq }}</span>
                  </BaseCheckbox>
                </div>
              </div>
            </div>

            <!-- Row 4: Notes -->
            <div v-if="isAdmin || row.slot.notes">
              <textarea v-if="isAdmin"
                :value="row.slot.notes || ''"
                @focus="editingNotes = row.slot.notes || ''"
                @input="editingNotes = $event.target.value; $event.target.style.height = 'auto'; $event.target.style.height = $event.target.scrollHeight + 'px'"
                @blur="saveNotes(row.idx)"
                @keydown.enter.exact="$event.target.blur()"
                @mounted="$el?.style && ($el.style.height = $el.scrollHeight + 'px')"
                rows="1"
                placeholder="Заметки..."
                class="w-full bg-neutral-800/50 border border-neutral-700/50 focus:border-delta-green rounded-lg text-xs text-neutral-400 focus:text-neutral-200 outline-none px-2.5 py-1.5 transition-colors resize-none overflow-hidden"></textarea>
              <div v-else-if="row.slot.notes" class="text-[10px] text-neutral-500 break-words">{{ row.slot.notes }}</div>
            </div>

            <!-- Row 5: Action buttons -->
            <div v-if="canEditPersonalTask(row.slot) || row.slot.personalTask || (isAdmin && row.slot.playerId && getPlayerTelegramId(row.slot.playerId))"
              class="flex items-center gap-2 pt-0.5">
              <button v-if="canEditPersonalTask(row.slot)"
                @click="startEditPersonalTask(row.idx)"
                :class="[
                  'flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors',
                  row.slot.personalTask
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                    : 'text-neutral-600 hover:text-neutral-400 border border-neutral-700/50 hover:border-neutral-600'
                ]">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {{ row.slot.personalTask ? 'Личная задача' : 'Добавить задачу' }}
              </button>

              <!-- Telegram notify (mobile) -->
              <button v-if="isAdmin && row.slot.playerId && getPlayerTelegramId(row.slot.playerId)"
                @click.stop="sendSlotNotification(row.slot, row.idx)"
                :disabled="slotNotifSending[row.idx]"
                :class="[
                  'flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors border',
                  slotNotifSent[row.idx]
                    ? 'text-emerald-400 border-emerald-500/20'
                    : 'text-sky-500/50 hover:text-sky-400 border-neutral-700/50 hover:border-sky-500/30'
                ]">
                <svg v-if="slotNotifSent[row.idx]" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <svg v-else class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Telegram
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div v-if="unassignedPlayers.length" ref="unassignedPlayersSection" class="mt-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 class="text-xs font-medium uppercase tracking-wider text-neutral-500">Не расставлены на слот</h3>
          <p class="mt-1 text-sm text-neutral-400">
            Буду:
            <span class="font-mono font-semibold text-status-confirmed">{{ unassignedReadyCount }}</span>
            <span class="mx-1.5 text-neutral-600">•</span>
            Возможно:
            <span class="font-mono font-semibold text-status-tentative">{{ unassignedTentativeCount }}</span>
          </p>
        </div>
      </div>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="player in unassignedPlayers"
            :key="player.uid"
            :class="[
              'inline-flex min-w-0 max-w-full rounded-lg border px-2.5 py-1 text-sm transition-colors',
              readinessPillClass(player.readiness)
            ]"
          >
            <span
              class="block truncate text-sm font-semibold leading-tight"
              :style="player.nicknameColor ? { color: player.nicknameColor } : {}"
            >
              {{ player.nickname }}
            </span>
        </div>
      </div>
    </div>

    <!-- Task -->
    <div v-if="isAdmin || hasSquadTask" class="mt-4 bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <div class="flex items-start justify-between gap-3 mb-3">
        <h3 class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Задача отряда</h3>
        <button
          v-if="isAdmin && !showSquadTaskEditor"
          @click="startEditSquadTask"
          class="shrink-0 px-3 py-1.5 text-xs text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-600 rounded-lg transition-colors"
        >
          Редактировать
        </button>
      </div>

      <template v-if="showSquadTaskEditor">
        <div class="mb-2 flex flex-wrap gap-1.5">
          <button
            v-for="button in markdownToolbarButtons"
            :key="`squad-${button.id}`"
            type="button"
            :title="button.title"
            @click="applyMarkdownAction('squad', squadTaskTextarea, button.id)"
            class="min-w-9 px-2 py-1.5 text-[11px] font-semibold text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-600 rounded-md transition-colors"
          >
            {{ button.label }}
          </button>
        </div>
        <textarea
          ref="squadTaskTextarea"
          v-model="squadTaskDraft"
          rows="6"
          placeholder="Опишите задачу для расстановки. Поддерживается Markdown: ссылки, списки, выделение, изображения."
          class="w-full min-h-[160px] bg-neutral-950/70 border border-neutral-800 hover:border-neutral-700 focus:border-delta-green rounded-lg px-3 py-3 text-sm text-neutral-200 outline-none resize-y overflow-auto transition-colors"
          @input="resizeTextarea"
          @keydown.ctrl.enter.prevent="saveSquadTask"
        ></textarea>
        <p class="mt-2 text-[11px] text-neutral-600">
          Можно использовать Markdown и HTML-вставки вроде ссылок, изображений и цветного текста через `style="color: ..."`.
        </p>
        <div class="flex justify-end gap-2 mt-3">
          <button
            v-if="hasSquadTask"
            @click="cancelSquadTaskEdit"
            class="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Отмена
          </button>
          <button
            @click="saveSquadTask"
            class="px-3 py-1.5 text-xs bg-delta-green hover:bg-delta-green/80 text-white rounded-lg transition-colors"
          >
            Сохранить
          </button>
        </div>
      </template>

      <div
        v-else
        class="task-markdown rounded-lg border border-neutral-800 bg-neutral-950/60 px-4 py-3 text-sm text-neutral-200"
        @click="openMarkdownImagePreview"
        v-html="squadTaskHtml"
      ></div>
    </div>

    <!-- Personal tasks container -->
    <div v-if="visiblePersonalTasks.length || editingPersonalTask !== null" class="mt-4 bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <h3 class="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Личные задачи</h3>

      <!-- Editing form -->
      <div v-if="editingPersonalTask !== null" class="mb-3 bg-neutral-800 rounded-lg p-3 border border-neutral-700">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[10px] font-mono text-neutral-500">#{{ slots[editingPersonalTask]?.number }}</span>
          <span class="text-xs text-neutral-400">{{ slots[editingPersonalTask]?.name }}</span>
          <span v-if="resolveSlotPlayer(slots[editingPersonalTask])" class="text-xs text-neutral-300 ml-auto">
            {{ resolveSlotPlayer(slots[editingPersonalTask]) }}
          </span>
        </div>
        <div class="mb-2 flex flex-wrap gap-1.5">
          <button
            v-for="button in markdownToolbarButtons"
            :key="`personal-${button.id}`"
            type="button"
            :title="button.title"
            @click="applyMarkdownAction('personal', personalTaskTextarea, button.id)"
            class="min-w-9 px-2 py-1.5 text-[11px] font-semibold text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-600 rounded-md transition-colors"
          >
            {{ button.label }}
          </button>
        </div>
        <textarea
          ref="personalTaskTextarea"
          v-model="personalTaskDraft"
          rows="5"
          placeholder="Опишите личную задачу. Поддерживается Markdown."
          class="w-full min-h-[140px] bg-neutral-900 border border-neutral-700 focus:border-delta-green rounded-lg px-3 py-3 text-sm text-neutral-300 outline-none resize-y overflow-auto transition-colors"
          @input="resizeTextarea"
          @keydown.ctrl.enter.prevent="savePersonalTask(editingPersonalTask)"
        ></textarea>
        <p class="mt-2 text-[11px] text-neutral-600">
          Поддерживаются ссылки, списки, изображения и базовое цветовое оформление текста.
        </p>
        <div class="flex justify-end gap-2 mt-2">
          <button @click="cancelEditPersonalTask"
            class="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors">
            Отмена
          </button>
          <button @click="savePersonalTask(editingPersonalTask)"
            class="px-3 py-1.5 text-xs bg-delta-green hover:bg-delta-green/80 text-white rounded-lg transition-colors">
            Сохранить
          </button>
        </div>
      </div>

      <!-- Task list -->
      <div class="space-y-2">
        <div v-for="pt in visiblePersonalTasks" :key="pt.idx"
          class="flex items-start gap-3 px-3 py-2 rounded-lg bg-neutral-800/50 border border-neutral-800">
          <div class="shrink-0 flex items-center gap-1.5 mt-0.5">
            <span class="text-[10px] font-mono text-neutral-600">#{{ pt.slotNumber }}</span>
            <span class="text-amber-500/70">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-xs font-medium text-neutral-300">{{ pt.nickname || pt.slotName }}</span>
              <span v-if="pt.nickname" class="text-[10px] text-neutral-600">{{ pt.slotName }}</span>
            </div>
            <div
              class="task-markdown text-sm text-neutral-300"
              @click="openMarkdownImagePreview"
              v-html="pt.taskHtml"
            ></div>
          </div>
          <button v-if="canEditPersonalTask(slots[pt.idx])"
            @click="startEditPersonalTask(pt.idx)"
            class="shrink-0 p-1 text-neutral-600 hover:text-neutral-400 transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
      </div>

      <p v-if="!visiblePersonalTasks.length && editingPersonalTask === null" class="text-xs text-neutral-600">
        Нет личных задач
      </p>
    </div>

    <!-- Slot Requests block -->
    <div v-if="slotRequests.length" ref="slotRequestsSection" class="mt-4 bg-neutral-900 border border-neutral-800 rounded-xl">
      <button @click="requestsCollapsed = !requestsCollapsed"
        class="w-full flex items-center justify-between px-4 py-3 text-left">
        <h3 class="text-xs font-medium text-neutral-500 uppercase tracking-wider">
          Запросы слотов
          <span class="text-neutral-600 font-mono ml-1">{{ slotRequests.length }}</span>
        </h3>
        <svg :class="['w-4 h-4 text-neutral-500 transition-transform', requestsCollapsed ? '-rotate-90' : '']"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div v-if="!requestsCollapsed" class="px-4 pb-4 space-y-2">
        <div v-for="(req, ri) in slotRequests" :key="ri"
          class="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-neutral-800/50 border border-neutral-800">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-medium"
                :style="roster.getNicknameColor(req.playerId) ? { color: roster.getNicknameColor(req.playerId) } : {}">
                {{ roster.resolveNickname(req.playerId) || '—' }}
              </span>
            </div>
            <div v-if="req.slots.length" class="flex flex-wrap gap-1 mb-1">
              <span v-for="s in req.slots" :key="`${s.side}::${s.squad}::${s.number}`"
                :class="['px-1.5 py-0.5 rounded text-[10px] border', slotRequestTagClass(s.side)]">
                {{ s.squad }} #{{ s.number }} {{ s.name }}
              </span>
            </div>
            <p v-if="req.text" class="text-xs text-neutral-500 whitespace-pre-line">{{ req.text }}</p>
          </div>
          <div v-if="canManageSlotRequest(req)" class="shrink-0 flex items-center gap-1">
            <button @click="openSlotRequestModal(req.playerId)"
              class="p-1 text-neutral-600 hover:text-delta-green transition-colors" title="Редактировать запрос">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button @click="requestRemoveSlotRequest(req)"
              class="p-1 text-neutral-600 hover:text-red-400 transition-colors" title="Удалить запрос">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Slot Request modal -->
    <ConfirmModal
      v-if="confirmAction"
      :title="confirmAction.title"
      :message="confirmAction.message"
      :details="confirmAction.details"
      :confirm-label="confirmAction.confirmLabel"
      :tone="confirmAction.tone"
      :busy="confirmBusy"
      @close="closeConfirmation"
      @confirm="handleConfirm"
    />

    <!-- Slot Request modal -->
    <SlotRequestModal
      v-if="showSlotRequestModal && slotRequestPlayerId && currentMission"
      :game-id="activeTab"
      :player-id="slotRequestPlayerId"
      :mission="currentMission"
      @close="showSlotRequestModal = false; slotRequestPlayerId = null"
    />

    <!-- Slot Configurator modal -->
    <SlotConfigurator
      v-if="showSlotConfigurator && currentMission"
      :game-id="activeTab"
      :mission="currentMission"
      @close="showSlotConfigurator = false"
    />

    <!-- Gallery lightbox -->
    <ImageLightbox
      v-if="showGallery && activeGalleryImages.length"
      :images="activeGalleryImages"
      :start-index="galleryStartIndex"
      @close="showGallery = false"
    />
    </template>
  </div>
</template>
