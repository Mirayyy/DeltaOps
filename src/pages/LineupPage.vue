<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRosterStore } from '../stores/roster'
import { useAttendanceStore } from '../stores/attendance'
import { useGamesStore } from '../stores/games'
import { useMissionsStore } from '../stores/missions'
import { useGameWeek } from '../composables/useGameWeek'
import { EQUIPMENT_LIST, SIDE_COLORS, SLOT_TYPES } from '../utils/constants'
import EquipmentTag from '../components/common/EquipmentTag.vue'
import SlotConfigurator from '../components/admin/SlotConfigurator.vue'
import SlotRequestModal from '../components/lineup/SlotRequestModal.vue'
import ImageLightbox from '../components/common/ImageLightbox.vue'
import BaseCheckbox from '../components/common/BaseCheckbox.vue'
import { useTelegram } from '../composables/useTelegram'
import { useToast } from '../composables/useToast'

const auth = useAuthStore()
const roster = useRosterStore()
const attendance = useAttendanceStore()
const gamesStore = useGamesStore()
const missionsStore = useMissionsStore()
const { games, currentWeekId } = useGameWeek()

const activeTab = ref('friday_1')
const editingSlot = ref(null)
const editingNotes = ref('')
const showEquipmentMenu = ref(null)
const showSlotConfigurator = ref(false)
const showSlotRequestModal = ref(false)
const requestsCollapsed = ref(false)
const editingPersonalTask = ref(null) // slotIndex being edited
const personalTaskDraft = ref('')

onMounted(async () => {
  if (!roster.players.length) await roster.fetchPlayers()
  await Promise.all([
    attendance.fetchAttendance(roster.activePlayers),
    gamesStore.fetchGames(),
    missionsStore.fetchMissions(),
  ])
})

const currentMission = computed(() => missionsStore.getMission(activeTab.value))

const slots = computed(() => gamesStore.getSlots(activeTab.value))
const isAdmin = computed(() => auth.isUserAdmin)
const telegram = useTelegram()
const toast = useToast()

async function sendLineupToTelegram() {
  const msg = telegram.buildLineupSummaryMessage(gamesStore.games, roster.players)
  const result = await telegram.sendMessage(msg)
  if (result.ok) {
    toast.success(result.demo ? 'Расстановка (демо)' : 'Расстановка отправлена в Telegram')
  } else {
    toast.error('Ошибка: ' + result.error)
  }
}

// Gallery: collect all images from all sides
const galleryImages = computed(() => {
  if (!currentMission.value?.sides) return []
  return currentMission.value.sides.flatMap(s => s.gallery || [])
})
const showGallery = ref(false)
const galleryStartIndex = ref(0)

function openGallery(index = 0) {
  galleryStartIndex.value = index
  showGallery.value = true
}

// Players available for assignment
const availablePlayers = computed(() => {
  return roster.activePlayers
    .map(p => {
      const status = attendance.getPlayerAttendance(activeTab.value, p.uid)
      const assigned = slots.value.some(s => s.playerId === p.uid)
      return { ...p, readiness: status, assigned }
    })
    .sort((a, b) => {
      const order = { confirmed: 0, tentative: 1, no_response: 2, absent: 3 }
      return (order[a.readiness] ?? 2) - (order[b.readiness] ?? 2)
    })
})

const assignedCount = computed(() => slots.value.filter(s => s.playerId).length)
const totalSlots = computed(() => slots.value.length)

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

function selectTab(gameId) {
  activeTab.value = gameId
  editingSlot.value = null
  showEquipmentMenu.value = null
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

  // After render, check if dropdown fits below
  await nextTick()
  const el = document.querySelector(`[data-dropdown="${refName}-${key}"]`)
  if (!el) return
  const rect = el.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  dropdownUp.value[`${refName}-${key}`] = spaceBelow < 20
}

function closeAllPopups() {
  editingSlot.value = null
  showEquipmentMenu.value = null
  showTypeMenu.value = null
  dropdownUp.value = {}
}

// Personal tasks
function startEditPersonalTask(slotIndex) {
  const slot = slots.value[slotIndex]
  if (!slot) return
  personalTaskDraft.value = slot.personalTask || ''
  editingPersonalTask.value = slotIndex
}

function savePersonalTask(slotIndex) {
  gamesStore.updateSlot(activeTab.value, slotIndex, { personalTask: personalTaskDraft.value })
  editingPersonalTask.value = null
}

function cancelEditPersonalTask() {
  editingPersonalTask.value = null
}

// Personal tasks for display below squad task
const personalTasks = computed(() => {
  const result = []
  slots.value.forEach((slot, idx) => {
    if (!slot.personalTask) return
    const nickname = slot.playerId ? roster.resolveNickname(slot.playerId) : null
    result.push({
      idx,
      slotNumber: slot.number,
      slotName: slot.name,
      playerId: slot.playerId,
      nickname,
      task: slot.personalTask,
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

function removeSlotRequest(index) {
  gamesStore.removeSlotRequest(activeTab.value, index)
}

async function confirmClearGame() {
  if (!confirm('Удалить данные миссии? Слоты, задачи и запросы будут сброшены.')) return
  await gamesStore.clearGame(activeTab.value)
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
</script>

<template>
  <div class="pb-20 md:pb-0">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div>
        <h1 class="text-2xl font-bold">Расстановка</h1>
        <p class="text-sm text-neutral-500">Неделя {{ currentWeekId }}</p>
      </div>
      <div class="flex items-center gap-1.5">
        <button v-if="isAdmin && slots.length"
          @click="sendLineupToTelegram" :disabled="telegram.sending.value"
          class="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-500 text-neutral-400 hover:text-white rounded-lg transition-colors inline-flex items-center gap-1.5 disabled:opacity-50">
          <svg class="w-3 h-3 text-sky-400" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
          {{ telegram.sending.value ? '...' : 'Расстановка' }}
        </button>
        <button v-if="currentMission && auth.isUserMember && auth.player?.uid"
          @click="showSlotRequestModal = true"
          class="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-500 text-neutral-400 hover:text-white rounded-lg transition-colors">
          {{ hasMyRequest ? 'Изменить запрос' : 'Запросить слот' }}
        </button>
        <button v-if="isAdmin && currentMission"
          @click="showSlotConfigurator = true"
          class="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-500 text-neutral-400 hover:text-white rounded-lg transition-colors">
          Настроить слоты
        </button>
        <button v-if="isAdmin && gamesStore.getGame(activeTab)"
          @click="confirmClearGame"
          class="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-red-500/50 text-neutral-500 hover:text-red-400 rounded-lg transition-colors">
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

    <!-- Mission info bar -->
    <div v-if="currentMission" class="bg-neutral-900 border border-neutral-800 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span class="font-medium text-white">{{ currentMission.title }}</span>
      <span class="text-neutral-500">{{ currentMission.map }}</span>
      <span class="text-neutral-600">|</span>
      <span v-for="side in currentMission.sides" :key="side.name" class="flex items-center gap-1">
        <span :class="[SIDE_COLORS[side.color]?.dot || 'bg-neutral-500', 'w-1.5 h-1.5 rounded-full']"></span>
        <span :class="SIDE_COLORS[side.color]?.text || 'text-neutral-400'">{{ side.name }}</span>
        <span class="text-neutral-600 font-mono">{{ side.players }}</span>
      </span>
      <div class="ml-auto flex items-center gap-3">
        <button v-if="galleryImages.length"
          @click="openGallery()"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-delta-green/15 text-delta-green hover:bg-delta-green/25 border border-delta-green/30 transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span class="text-xs font-medium">Галерея</span>
          <span class="text-[10px] font-mono opacity-70">{{ galleryImages.length }}</span>
        </button>
        <a v-if="currentMission.sourceUrl" :href="currentMission.sourceUrl" target="_blank" rel="noopener"
          class="text-neutral-600 hover:text-neutral-400 transition-colors">
          tsgames.ru →
        </a>
      </div>
    </div>

    <!-- Stats bar -->
    <div v-if="slots.length" class="flex items-center gap-4 mb-4 text-xs text-neutral-500">
      <span>Слотов: <span class="text-neutral-300 font-mono">{{ totalSlots }}</span></span>
      <span>Назначено: <span class="text-delta-green font-mono">{{ assignedCount }}</span></span>
      <span>Свободно: <span class="text-neutral-300 font-mono">{{ totalSlots - assignedCount }}</span></span>
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

      <!-- Desktop table -->
      <div class="hidden md:block">
        <table class="w-full text-sm table-fixed">
          <thead>
            <tr class="border-b border-neutral-800 text-neutral-500 text-xs">
              <th class="text-left px-4 py-2.5 font-medium w-10">#</th>
              <th class="text-left px-3 py-2.5 font-medium" style="width:18rem">Слот</th>
              <th class="text-left px-3 py-2.5 font-medium" style="width:9rem">Тип</th>
              <th class="text-left px-3 py-2.5 font-medium w-14">ФТ</th>
              <th class="text-left px-3 py-2.5 font-medium" style="width:11rem">Позывной</th>
              <th class="text-left px-3 py-2.5 font-medium" style="min-width:14rem">Снаряжение</th>
              <th class="text-left px-3 py-2.5 font-medium">Заметки</th>
              <th class="text-center px-2 py-2.5 font-medium w-10">
                <svg class="w-3.5 h-3.5 mx-auto text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
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
                <td colspan="8" class="px-4 py-2">
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
                <td class="px-4 py-2.5 font-mono text-xs text-neutral-500">{{ row.slot.number }}</td>

                <!-- Slot name -->
                <td class="px-3 py-2.5 truncate" :title="row.slot.name">{{ row.slot.name }}</td>

                <!-- Type (selector) -->
                <td class="px-3 py-2.5 relative">
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
                    :class="[
                      'absolute left-3 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-30 w-44 py-1',
                      dropdownUp['type-' + row.idx] ? 'bottom-full mb-0.5' : 'top-full mt-0.5'
                    ]"
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
                <td class="px-3 py-2.5 relative">
                  <button v-if="isAdmin"
                    @click.stop="openDropdown(row.idx, 'player')"
                    :class="[
                      'w-full text-left px-2 py-1 rounded-lg text-sm transition-all border truncate',
                      resolveSlotPlayer(row.slot)
                        ? 'border-neutral-700 hover:border-neutral-500 text-neutral-200'
                        : 'border-dashed border-neutral-700 hover:border-neutral-500 text-neutral-500'
                    ]"
                    :style="slotPlayerColor(row.slot) ? { color: slotPlayerColor(row.slot) } : {}">
                    {{ resolveSlotPlayer(row.slot) || '—' }}
                  </button>
                  <span v-else :class="resolveSlotPlayer(row.slot) ? 'text-neutral-200' : 'text-neutral-600'"
                    :style="slotPlayerColor(row.slot) ? { color: slotPlayerColor(row.slot) } : {}">
                    {{ resolveSlotPlayer(row.slot) || '—' }}
                  </span>

                  <!-- Player dropdown -->
                  <div v-if="editingSlot === row.idx"
                    :data-dropdown="'player-' + row.idx"
                    :class="[
                      'absolute left-3 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-30 w-56 max-h-64 overflow-y-auto',
                      dropdownUp['player-' + row.idx] ? 'bottom-full mb-0.5' : 'top-full mt-0.5'
                    ]"
                    @click.stop>
                    <button v-if="row.slot.playerId" @click="unassign(row.idx)"
                      class="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-neutral-700 border-b border-neutral-700">
                      Убрать
                    </button>
                    <button v-for="p in availablePlayers" :key="p.uid"
                      @click="assignToSlot(row.idx, p)"
                      :class="[
                        'w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 transition-colors flex items-center justify-between',
                        p.assigned ? 'text-neutral-600' : 'text-neutral-300'
                      ]">
                      <span class="flex items-center gap-2">
                        <span :class="[readinessDot(p.readiness), 'w-2 h-2 rounded-full shrink-0']"></span>
                        <span :style="p.nicknameColor && !p.assigned ? { color: p.nicknameColor } : {}">{{ p.nickname }}</span>
                      </span>
                      <span v-if="p.assigned" class="text-[10px] text-neutral-600">назначен</span>
                    </button>
                  </div>
                </td>

                <!-- Equipment -->
                <td class="px-3 py-2.5 relative">
                  <div class="flex flex-wrap gap-1 items-center">
                    <EquipmentTag v-for="eq in (row.slot.equipment || [])" :key="eq" :name="eq" />
                    <button v-if="isAdmin"
                      @click.stop="openDropdown(row.idx, 'eq')"
                      class="w-5 h-5 rounded text-[10px] bg-neutral-800 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700 transition-colors flex items-center justify-center">
                      +
                    </button>
                  </div>

                  <!-- Equipment dropdown -->
                  <div v-if="showEquipmentMenu === row.idx"
                    :data-dropdown="'eq-' + row.idx"
                    :class="[
                      'absolute left-3 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-30 p-2 min-w-40',
                      dropdownUp['eq-' + row.idx] ? 'bottom-full mb-0.5' : 'top-full mt-0.5'
                    ]"
                    @click.stop>
                    <div v-for="eq in EQUIPMENT_LIST" :key="eq"
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
                  <input v-if="isAdmin"
                    :value="row.slot.notes || ''"
                    @focus="editingNotes = row.slot.notes || ''"
                    @input="editingNotes = $event.target.value"
                    @blur="saveNotes(row.idx)"
                    @keydown.enter="$event.target.blur()"
                    placeholder="—"
                    class="w-full bg-transparent border-b border-transparent hover:border-neutral-700 focus:border-delta-green text-sm text-neutral-400 focus:text-neutral-200 outline-none py-0.5 transition-colors">
                  <span v-else class="text-neutral-500 text-xs">{{ row.slot.notes || '—' }}</span>
                </td>

                <!-- Personal task indicator -->
                <td class="px-2 py-2.5 text-center">
                  <button v-if="canEditPersonalTask(row.slot)"
                    @click="startEditPersonalTask(row.idx)"
                    :class="[
                      'w-6 h-6 rounded flex items-center justify-center transition-colors',
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
          <div v-else class="px-4 py-3">
            <div class="flex items-center justify-between mb-1.5">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-[10px] font-mono text-neutral-600 shrink-0">{{ row.slot.number }}</span>
                <span class="text-sm truncate">{{ row.slot.name }}</span>
                <span v-if="row.slot.type"
                  :class="[
                    'px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0',
                    SLOT_TYPE_STYLES[row.slot.type] || 'bg-neutral-700 text-neutral-400 border-neutral-600'
                  ]">
                  {{ SLOT_TYPES[row.slot.type]?.label }}
                </span>
                <span v-if="row.slot.fireteam"
                  :class="['px-1.5 py-0.5 rounded text-[10px] font-mono border shrink-0', ftColor(row.slot.fireteam)]">
                  {{ row.slot.fireteam }}
                </span>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <button v-if="isAdmin" @click="startAssign(row.idx)"
                :class="['text-sm px-2 py-0.5 rounded transition-all',
                  resolveSlotPlayer(row.slot) ? 'text-neutral-200 bg-neutral-800' : 'text-neutral-500 bg-neutral-800/50']"
                :style="slotPlayerColor(row.slot) ? { color: slotPlayerColor(row.slot) } : {}">
                {{ resolveSlotPlayer(row.slot) || '— свободно —' }}
              </button>
              <span v-else :class="resolveSlotPlayer(row.slot) ? 'text-sm text-neutral-200' : 'text-sm text-neutral-600'"
                :style="slotPlayerColor(row.slot) ? { color: slotPlayerColor(row.slot) } : {}">
                {{ resolveSlotPlayer(row.slot) || '—' }}
              </span>

              <div class="flex gap-1">
                <EquipmentTag v-for="eq in (row.slot.equipment || [])" :key="eq" :name="eq" />
              </div>
            </div>

            <!-- Mobile player dropdown -->
            <div v-if="editingSlot === row.idx"
              class="mt-2 bg-neutral-800 border border-neutral-700 rounded-lg max-h-48 overflow-y-auto">
              <button v-if="row.slot.playerId" @click="unassign(row.idx)"
                class="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-neutral-700 border-b border-neutral-700">
                Убрать
              </button>
              <button v-for="p in availablePlayers" :key="p.uid"
                @click="assignToSlot(row.idx, p)"
                :class="['w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 flex items-center justify-between',
                  p.assigned ? 'text-neutral-600' : 'text-neutral-300']">
                <span class="flex items-center gap-2">
                  <span :class="[readinessDot(p.readiness), 'w-2 h-2 rounded-full']"></span>
                  <span :style="p.nicknameColor && !p.assigned ? { color: p.nicknameColor } : {}">{{ p.nickname }}</span>
                </span>
              </button>
            </div>

            <div v-if="row.slot.notes" class="mt-1 text-[10px] text-neutral-500">{{ row.slot.notes }}</div>

            <!-- Personal task indicator (mobile) -->
            <div v-if="canEditPersonalTask(row.slot) || row.slot.personalTask" class="mt-1.5 flex items-center gap-1.5">
              <button v-if="canEditPersonalTask(row.slot)"
                @click="startEditPersonalTask(row.idx)"
                :class="[
                  'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors',
                  row.slot.personalTask
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'text-neutral-600 hover:text-neutral-400'
                ]">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {{ row.slot.personalTask ? 'Личная задача' : 'Добавить задачу' }}
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Task -->
    <div v-if="isAdmin || gamesStore.getGame(activeTab)?.task" class="mt-4 bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <h3 class="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Задача отряда</h3>
      <textarea v-if="isAdmin"
        :value="gamesStore.getGame(activeTab)?.task || ''"
        @blur="gamesStore.setTask(activeTab, $event.target.value)"
        @keydown.ctrl.enter="$event.target.blur()"
        rows="2"
        placeholder="Опишите задачу для расстановки..."
        class="w-full bg-transparent border border-neutral-800 hover:border-neutral-700 focus:border-delta-green rounded-lg px-3 py-2 text-sm text-neutral-300 outline-none resize-none transition-colors"></textarea>
      <p v-else class="text-sm text-neutral-300">{{ gamesStore.getGame(activeTab).task }}</p>
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
        <textarea
          v-model="personalTaskDraft"
          rows="2"
          placeholder="Опишите личную задачу..."
          class="w-full bg-neutral-900 border border-neutral-700 focus:border-delta-green rounded-lg px-3 py-2 text-sm text-neutral-300 outline-none resize-none transition-colors"
          @keydown.ctrl.enter="savePersonalTask(editingPersonalTask)"
        ></textarea>
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
            <p class="text-sm text-neutral-400 whitespace-pre-line">{{ pt.task }}</p>
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
    <div v-if="slotRequests.length" class="mt-4 bg-neutral-900 border border-neutral-800 rounded-xl">
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
          <button v-if="isAdmin" @click="removeSlotRequest(ri)"
            class="shrink-0 p-1 text-neutral-600 hover:text-red-400 transition-colors" title="Удалить запрос">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Slot Request modal -->
    <SlotRequestModal
      v-if="showSlotRequestModal && auth.player?.uid && currentMission"
      :game-id="activeTab"
      :player-id="auth.player.uid"
      :mission="currentMission"
      @close="showSlotRequestModal = false"
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
      v-if="showGallery && galleryImages.length"
      :images="galleryImages"
      :start-index="galleryStartIndex"
      @close="showGallery = false"
    />
  </div>
</template>
