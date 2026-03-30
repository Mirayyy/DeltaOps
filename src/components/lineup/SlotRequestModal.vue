<script setup>
import { ref, computed } from 'vue'
import { useGamesStore } from '../../stores/games'
import { SIDE_COLORS } from '../../utils/constants'
import BaseModal from '../common/BaseModal.vue'

const props = defineProps({
  gameId: { type: String, required: true },
  playerId: { type: String, required: true },
})

const emit = defineEmits(['close'])

const gamesStore = useGamesStore()

const selectedKeys = ref(new Set())
const text = ref('')

// Load existing request for this player
const existing = computed(() =>
  gamesStore.getSlotRequests(props.gameId).find(r => r.playerId === props.playerId)
)

// Pre-fill from existing request
if (existing.value) {
  text.value = existing.value.text || ''
  existing.value.slots.forEach(s => {
    selectedKeys.value.add(`${s.side}::${s.squad}::${s.number}`)
  })
}

// Group configured slots by side → squad
const groupedSlots = computed(() => {
  const slots = gamesStore.getSlots(props.gameId)
  const sides = []
  const sideMap = {}

  for (const slot of slots) {
    if (!sideMap[slot.side]) {
      sideMap[slot.side] = { name: slot.side, color: slot.sideColor, squads: {} }
      sides.push(sideMap[slot.side])
    }
    const side = sideMap[slot.side]
    if (!side.squads[slot.squad]) {
      side.squads[slot.squad] = { name: slot.squad, slots: [] }
    }
    side.squads[slot.squad].slots.push(slot)
  }

  return sides.map(s => ({
    ...s,
    squads: Object.values(s.squads),
  }))
})

// Find side color from mission data (slots don't carry sideColor directly)
// We'll detect from LineupPage's SIDE_COLORS using the first slot's data
function getSideColor(sideName) {
  const slots = gamesStore.getSlots(props.gameId)
  // Try to find from the mission data stored in game
  // For now just return null — the parent can pass colors if needed
  return null
}

function slotKey(slot) {
  return `${slot.side}::${slot.squad}::${slot.number}`
}

function isSelected(slot) {
  return selectedKeys.value.has(slotKey(slot))
}

function toggleSlot(slot) {
  const key = slotKey(slot)
  if (selectedKeys.value.has(key)) {
    selectedKeys.value.delete(key)
  } else {
    selectedKeys.value.add(key)
  }
}

const canSubmit = computed(() => selectedKeys.value.size > 0 || text.value.trim())

function submit() {
  if (!canSubmit.value) return

  const allSlots = gamesStore.getSlots(props.gameId)
  const slots = allSlots
    .filter(s => selectedKeys.value.has(slotKey(s)))
    .map(s => ({ side: s.side, squad: s.squad, number: s.number, name: s.name }))

  gamesStore.addSlotRequest(props.gameId, {
    playerId: props.playerId,
    slots,
    text: text.value.trim(),
  })

  emit('close')
}
</script>

<template>
  <BaseModal title="Запросить слот" wide @close="emit('close')">
    <p class="text-xs text-neutral-500 mb-4">
      Выберите желаемые слоты и/или напишите комментарий.
    </p>

    <!-- Slots grouped by side → squad -->
    <div class="space-y-3 max-h-[40vh] overflow-y-auto pr-1 mb-4">
      <div v-for="side in groupedSlots" :key="side.name">
        <div class="text-xs font-medium text-neutral-400 mb-1.5">{{ side.name }}</div>

        <div v-for="squad in side.squads" :key="squad.name" class="bg-neutral-800/50 rounded-lg overflow-hidden mb-2">
          <div class="px-3 py-1.5 text-xs font-medium text-neutral-300 border-b border-neutral-700/50">
            {{ squad.name }}
          </div>
          <div class="px-2 pb-2 pt-1.5 flex flex-wrap gap-1">
            <button v-for="slot in squad.slots" :key="slot.number"
              @click="toggleSlot(slot)"
              :class="[
                'px-2.5 py-1.5 rounded-md text-xs transition-all border',
                isSelected(slot)
                  ? 'bg-delta-green/15 border-delta-green/40 text-delta-green hover:bg-delta-green/25'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-500 hover:text-neutral-300 hover:border-neutral-500'
              ]">
              <span class="font-mono text-[10px] opacity-50 mr-1">{{ slot.number }}</span>
              {{ slot.name }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="!groupedSlots.length" class="text-sm text-neutral-600 text-center py-4">
        Слоты ещё не настроены
      </div>
    </div>

    <!-- Text input -->
    <textarea
      v-model="text"
      rows="2"
      placeholder="Комментарий (необязательно)..."
      class="w-full bg-neutral-800 border border-neutral-700 focus:border-delta-green rounded-lg px-3 py-2 text-sm text-neutral-300 outline-none resize-none transition-colors"
    ></textarea>

    <!-- Footer -->
    <div class="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
      <div class="text-xs text-neutral-500">
        Выбрано: <span class="text-delta-green font-mono">{{ selectedKeys.size }}</span> слотов
      </div>
      <div class="flex gap-2">
        <button @click="emit('close')" class="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors">
          Отмена
        </button>
        <button @click="submit" :disabled="!canSubmit"
          class="px-4 py-2 bg-delta-green hover:bg-delta-green/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Отправить
        </button>
      </div>
    </div>
  </BaseModal>
</template>
