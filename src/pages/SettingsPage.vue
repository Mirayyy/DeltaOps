<script setup>
import { ref, onMounted, computed } from 'vue'
import { useArchiveStore } from '../stores/archive'
import { useGamesStore } from '../stores/games'
import { useAttendanceStore } from '../stores/attendance'
import { useMissionsStore } from '../stores/missions'
import { useWebContentStore } from '../stores/webContent'
import { useRosterStore } from '../stores/roster'
import { useGameWeek } from '../composables/useGameWeek'
import { GAMES, GAME_IDS } from '../utils/constants'
import { isFirebaseConfigured } from '../firebase/config'
import { useToast } from '../composables/useToast'
import BaseSelect from '../components/common/BaseSelect.vue'
import BaseCheckbox from '../components/common/BaseCheckbox.vue'

const archive = useArchiveStore()
const gamesStore = useGamesStore()
const attendanceStore = useAttendanceStore()
const missionsStore = useMissionsStore()
const webContent = useWebContentStore()
const roster = useRosterStore()
const { currentWeekId, gameDates } = useGameWeek()
const toast = useToast()

// Rotation form
const newRotation = ref({ name: '', startDate: '', endDate: '' })
const creating = ref(false)
const archiving = ref(false)

// Rotation editing
const editingRotationId = ref(null)
const editForm = ref({ name: '', startDate: '', endDate: '' })

// Web content saving
const savingContent = ref(false)

// Award player options
const playerOptions = computed(() => [
  { value: null, label: '— Не выбран —' },
  ...roster.activePlayers.map(p => ({ value: p.uid, label: p.nickname })),
])

onMounted(async () => {
  await Promise.all([
    archive.rotations.length ? null : archive.fetchArchives(),
    missionsStore.fetchMissions(),
    webContent.fetchContent(),
    roster.players.length ? null : roster.fetchPlayers(),
  ])
})

const activeRotation = computed(() => archive.getActiveRotation())

// Current week mission info
const weekMissions = computed(() => {
  return GAMES.map(game => {
    const mission = missionsStore.getMission(game.id)
    return {
      ...game,
      mission,
      loaded: !!mission,
    }
  })
})

const statusConfig = {
  active: { label: 'Активна', class: 'bg-green-500/20 text-green-400 border-green-500/30' },
  upcoming: { label: 'Скоро', class: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  past: { label: 'Прошла', class: 'bg-neutral-700/30 text-neutral-500 border-neutral-600/30' },
}

function rotationGamesCount(rotationId) {
  return archive.archives.filter(a => a.rotation === rotationId).length
}

// Check if current week has unfinalized data
const hasUnfinalizedWeek = computed(() => {
  for (const id of GAME_IDS) {
    const slots = gamesStore.getSlots(id)
    if (slots.length > 0) return true
    const game = attendanceStore.getGameAttendance(id)
    if (game.records?.some(r => r.attendance && r.attendance !== 'no_response')) return true
  }
  return false
})

// --- Rotation handlers ---
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
  if (!activeRotation.value || archiving.value) return
  if (hasUnfinalizedWeek.value) {
    toast.error('Сначала завершите текущую неделю (Дашборд → Завершить неделю)')
    return
  }
  archiving.value = true
  try {
    const today = new Date().toISOString().slice(0, 10)
    await archive.updateRotation(activeRotation.value.id, { endDate: today })
    toast.success('Ротация завершена')
  } catch (e) {
    toast.error('Ошибка: ' + e.message)
  } finally {
    archiving.value = false
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

// --- Web content handlers ---
async function saveWebContent() {
  savingContent.value = true
  try {
    await webContent.saveContent()
    toast.success('Настройки сайта сохранены')
  } catch (e) {
    toast.error('Ошибка: ' + e.message)
  } finally {
    savingContent.value = false
  }
}

// --- Helpers ---
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

    <!-- ═══ GAMES / PROCESS ═══ -->
    <div class="mb-8">
      <h2 class="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Настройка игр / процессов</h2>

      <div class="space-y-4">
        <!-- Current week + missions -->
        <div class="bg-neutral-900 rounded-xl border border-neutral-800 p-5">
          <h3 class="text-sm font-medium text-neutral-300 mb-3">Текущая неделя</h3>
          <div class="flex items-center gap-6 mb-4">
            <div class="text-lg font-bold font-mono text-delta-green">{{ currentWeekId }}</div>
            <div class="text-sm text-neutral-400">
              Пт: {{ gameDates.friday }}
              <span class="mx-2 text-neutral-600">•</span>
              Сб: {{ gameDates.saturday }}
            </div>
          </div>

          <!-- Mission slots -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div v-for="slot in weekMissions" :key="slot.id"
              :class="[
                'rounded-lg border p-3',
                slot.loaded ? 'bg-neutral-800/50 border-neutral-700' : 'bg-neutral-800/20 border-neutral-800 border-dashed'
              ]">
              <div class="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">{{ slot.label }}</div>
              <template v-if="slot.loaded">
                <div class="text-sm font-medium text-neutral-200 truncate">{{ slot.mission.title }}</div>
                <div class="text-[10px] text-neutral-500 mt-0.5">{{ slot.mission.map }}</div>
              </template>
              <div v-else class="text-xs text-neutral-600">Не загружена</div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ═══ ROTATIONS ═══ -->
    <div class="mb-8">
      <h2 class="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Ротации</h2>

      <div class="bg-neutral-900 rounded-xl border border-neutral-800 p-5">
        <!-- All rotations list -->
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
                    <label class="block text-xs text-neutral-400 mb-1">Конец <span class="text-neutral-600">(необяз.)</span></label>
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
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium">{{ rot.name }}</span>
                    <span :class="['text-xs px-2 py-0.5 rounded border', statusConfig[archive.getRotationStatus(rot)].class]">
                      {{ statusConfig[archive.getRotationStatus(rot)].label }}
                    </span>
                    <button @click="startEditRotation(rot)"
                      class="text-xs text-neutral-600 hover:text-neutral-300 transition-colors">✎</button>
                  </div>
                  <div class="text-xs text-neutral-500 mt-1">
                    {{ formatDate(rot.startDate) }}
                    <template v-if="rot.endDate"> → {{ formatDate(rot.endDate) }}</template>
                    <template v-else> → ...</template>
                    <span class="ml-2 text-neutral-600">{{ rotationGamesCount(rot.id) }} игр</span>
                  </div>
                </div>

                <button v-if="archive.getRotationStatus(rot) === 'active'"
                  @click="handleArchive"
                  :disabled="archiving"
                  class="px-3 py-1.5 text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 shrink-0">
                  {{ archiving ? 'Архивирую...' : 'Завершить' }}
                </button>
              </div>
            </template>
          </div>
        </div>

        <div v-if="!archive.rotations.length" class="text-neutral-600 text-sm mb-5">Нет ротаций</div>

        <!-- Create new rotation -->
        <div class="pt-4 border-t border-neutral-800">
          <h4 class="text-xs text-neutral-400 mb-3">Новая ротация</h4>
          <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
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
            <button @click="handleCreate"
              :disabled="!newRotation.name.trim() || !newRotation.startDate || creating"
              class="px-4 py-2 text-sm bg-delta-green hover:bg-delta-green/90 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
              {{ creating ? '...' : 'Создать' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ WEBSITE CONTENT ═══ -->
    <div class="mb-8">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Настройки сайта</h2>
        <button @click="saveWebContent" :disabled="savingContent"
          class="px-4 py-1.5 text-xs bg-delta-green hover:bg-delta-green/90 text-white rounded-lg transition-colors disabled:opacity-50">
          {{ savingContent ? 'Сохранение...' : 'Сохранить' }}
        </button>
      </div>

      <div class="space-y-4">
        <!-- Awards / Достижения -->
        <div class="bg-neutral-900 rounded-xl border border-neutral-800 p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-neutral-300">Достижения</h3>
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
                <!-- Preview icon -->
                <div class="w-14 h-14 bg-neutral-800 rounded-lg flex items-center justify-center border border-neutral-700 shrink-0 overflow-hidden">
                  <img v-if="award.icon" :src="award.icon" :alt="award.title" class="w-10 h-10 object-contain" />
                  <span v-else class="text-neutral-600 text-xl">?</span>
                </div>

                <!-- Fields -->
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
                  <!-- Type, Player, Show on landing -->
                  <div class="flex flex-wrap items-center gap-3 pt-1">
                    <!-- Type toggle -->
                    <div class="flex items-center gap-1">
                      <label class="text-[10px] text-neutral-500 mr-1">Тип:</label>
                      <button @click="award.type = 'squad'; award.playerUid = null"
                        :class="[
                          'px-2 py-0.5 text-[10px] rounded border transition-colors',
                          award.type === 'squad'
                            ? 'bg-delta-green/20 border-delta-green/40 text-delta-green'
                            : 'border-neutral-700 text-neutral-500 hover:text-neutral-300'
                        ]">Отряд</button>
                      <button @click="award.type = 'player'"
                        :class="[
                          'px-2 py-0.5 text-[10px] rounded border transition-colors',
                          award.type === 'player'
                            ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                            : 'border-neutral-700 text-neutral-500 hover:text-neutral-300'
                        ]">Игрок</button>
                    </div>

                    <!-- Player selector (only for player type) -->
                    <div v-if="award.type === 'player'" class="flex items-center gap-1">
                      <label class="text-[10px] text-neutral-500">Игрок:</label>
                      <BaseSelect v-model="award.playerUid" :options="playerOptions" size="sm" />
                    </div>

                    <!-- Show on landing checkbox -->
                    <BaseCheckbox v-model="award.showOnLanding" size="sm" class="ml-auto">
                      <span class="text-[10px] text-neutral-500">На главную</span>
                    </BaseCheckbox>
                  </div>
                </div>

                <!-- Actions -->
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

        <!-- About / Об отряде -->
        <div class="bg-neutral-900 rounded-xl border border-neutral-800 p-5">
          <h3 class="text-sm font-medium text-neutral-300 mb-3">Об отряде</h3>

          <!-- Markdown reference -->
          <div class="bg-neutral-800/50 rounded-lg p-3 mb-3 text-[11px] text-neutral-500 leading-relaxed space-y-1.5">
            <div class="text-neutral-400 font-medium mb-1">Подсказка по синтаксису Markdown:</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              <div><code class="text-neutral-400">**жирный**</code> → <strong class="text-white">жирный</strong></div>
              <div><code class="text-neutral-400">*курсив*</code> → <em class="text-neutral-300 italic">курсив</em></div>
              <div><code class="text-neutral-400">~~зачёркнутый~~</code> → <span class="line-through">зачёркнутый</span></div>
              <div><code class="text-neutral-400"># Заголовок 1</code> — большой заголовок</div>
              <div><code class="text-neutral-400">## Заголовок 2</code> — средний заголовок</div>
              <div><code class="text-neutral-400">### Заголовок 3</code> — малый заголовок</div>
              <div><code class="text-neutral-400">[текст](url)</code> → ссылка</div>
              <div><code class="text-neutral-400">- элемент</code> — маркированный список</div>
              <div><code class="text-neutral-400">1. элемент</code> — нумерованный список</div>
              <div><code class="text-neutral-400">> цитата</code> — блок цитаты</div>
              <div><code class="text-neutral-400">---</code> — горизонтальная линия</div>
              <div><code class="text-neutral-400">`код`</code> → <code class="text-delta-green">код</code></div>
            </div>
            <div class="border-t border-neutral-700/50 pt-1.5 mt-1.5">
              <div class="text-neutral-400 font-medium mb-1">Цвета (спец. синтаксис):</div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                <div><code class="text-neutral-400">{orange}текст{/orange}</code> → <span class="text-orange-400">текст</span></div>
                <div><code class="text-neutral-400">{green}текст{/green}</code> → <span class="text-green-400">текст</span></div>
                <div><code class="text-neutral-400">{red}текст{/red}</code> → <span class="text-red-400">текст</span></div>
                <div><code class="text-neutral-400">{blue}текст{/blue}</code> → <span class="text-blue-400">текст</span></div>
                <div><code class="text-neutral-400">{yellow}текст{/yellow}</code> → <span class="text-yellow-400">текст</span></div>
                <div><code class="text-neutral-400">{white}текст{/white}</code> → <span class="text-white">текст</span></div>
                <div><code class="text-neutral-400">{delta}текст{/delta}</code> → <span class="text-delta-green">текст</span></div>
              </div>
            </div>
          </div>

          <textarea v-model="webContent.aboutMarkdown"
            rows="10"
            placeholder="Текст об отряде..."
            class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-neutral-300 focus:outline-none focus:border-delta-green resize-y font-mono leading-relaxed">
          </textarea>
        </div>
      </div>
    </div>

    <!-- ═══ TECHNICAL ═══ -->
    <div class="mb-8">
      <h2 class="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Техническое</h2>

      <div class="bg-neutral-900 rounded-xl border border-neutral-800 p-5">
        <h3 class="text-sm font-medium text-neutral-300 mb-3">Подключение</h3>
        <div class="flex items-center gap-3">
          <span :class="['w-2.5 h-2.5 rounded-full', isFirebaseConfigured ? 'bg-green-400' : 'bg-yellow-400']"></span>
          <span class="text-sm text-neutral-400">
            {{ isFirebaseConfigured ? 'Firebase подключён' : 'Демо-режим (localStorage)' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
