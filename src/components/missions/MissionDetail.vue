<script setup>
import { computed, ref } from 'vue'
import { SIDE_COLORS } from '../../utils/constants'
import { useMissionsStore } from '../../stores/missions'
import { useSquadConfig } from '../../stores/squadConfig'
import BaseModal from '../common/BaseModal.vue'
import ImageLightbox from '../common/ImageLightbox.vue'

const props = defineProps({
  mission: { type: Object, required: true },
})

defineEmits(['close'])

const missionsStore = useMissionsStore()
const squadConfig = useSquadConfig()
const activeSide = ref(0)

// Lightbox state
const lightbox = ref({ open: false, images: [], index: 0 })

function openLightbox(images, index) {
  lightbox.value = { open: true, images, index }
}

const stats = computed(() => {
  const m = props.mission
  return {
    totalPlayers: m.sides.reduce((sum, s) => sum + (s.players || 0), 0),
    totalSquads: m.sides.reduce((sum, s) => sum + (s.squads?.length || 0), 0),
  }
})

const currentSide = computed(() => props.mission.sides[activeSide.value])

function sideColor(color) {
  return SIDE_COLORS[color] || SIDE_COLORS.blue
}

const groupedSides = computed(() => missionsStore.getGroupedSides(props.mission, squadConfig.side))

function formatDate(dateStr) {
  if (!dateStr) return '—'
  // "DD.MM.YYYY HH:mm" → as is
  if (dateStr.includes('.')) return dateStr
  // ISO → locale
  return new Date(dateStr).toLocaleString('ru-RU')
}
</script>

<template>
  <BaseModal :title="mission.title" wide @close="$emit('close')">
    <!-- Top color bar -->
    <div class="flex h-1.5 rounded-full overflow-hidden mb-5">
      <div v-for="side in mission.sides" :key="side.name"
        :class="[sideColor(side.color).dot]"
        :style="{ flex: side.players }">
      </div>
    </div>

    <!-- Meta grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      <div class="bg-neutral-800/40 rounded-lg p-3 text-center">
        <div class="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Карта</div>
        <div class="text-sm font-medium text-white">{{ mission.map }}</div>
      </div>
      <div class="bg-neutral-800/40 rounded-lg p-3 text-center">
        <div class="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Игроков</div>
        <div class="text-sm font-medium text-white">{{ stats.totalPlayers }}</div>
      </div>
      <div class="bg-neutral-800/40 rounded-lg p-3 text-center">
        <div class="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Отделений</div>
        <div class="text-sm font-medium text-white">{{ stats.totalSquads }}</div>
      </div>
      <div class="bg-neutral-800/40 rounded-lg p-3 text-center">
        <div class="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Версия</div>
        <div class="text-sm font-medium text-white">v{{ mission.version }}</div>
      </div>
    </div>

    <!-- Sides raw -->
    <div class="bg-neutral-800/30 rounded-lg px-4 py-2.5 mb-5 text-sm text-neutral-300 font-mono text-center">
      {{ mission.sidesRaw }}
    </div>

    <!-- Description -->
    <div v-if="mission.description" class="text-sm text-neutral-400 leading-relaxed mb-5">
      {{ mission.description }}
    </div>

    <!-- Additional conditions -->
    <div v-if="mission.additionalConditions" class="flex items-center gap-2 mb-5 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
      <span class="font-medium">Доп. условия:</span>
      <span>{{ mission.additionalConditions }}</span>
    </div>

    <!-- Side tabs: grouped when rotation data available -->
    <div v-if="groupedSides" class="mb-4 space-y-2">
      <div v-if="groupedSides.ally.length">
        <div class="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 px-1">Союзники</div>
        <div class="flex gap-1 bg-neutral-800/40 rounded-lg p-1">
          <button v-for="side in groupedSides.ally" :key="side.name"
            @click="activeSide = mission.sides.indexOf(side)"
            :class="[
              'flex-1 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5',
              activeSide === mission.sides.indexOf(side)
                ? sideColor(side.color).bg + ' ' + sideColor(side.color).text + ' ' + sideColor(side.color).border + ' border'
                : 'text-neutral-500 hover:text-neutral-300'
            ]">
            <span :class="[sideColor(side.color).dot, 'w-2 h-2 rounded-full']"></span>
            {{ side.name }}
            <span class="font-mono text-[10px] opacity-60">{{ side.players }}</span>
          </button>
        </div>
      </div>
      <div v-if="groupedSides.enemy.length">
        <div class="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 px-1">Противники</div>
        <div class="flex gap-1 bg-neutral-800/40 rounded-lg p-1">
          <button v-for="side in groupedSides.enemy" :key="side.name"
            @click="activeSide = mission.sides.indexOf(side)"
            :class="[
              'flex-1 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5',
              activeSide === mission.sides.indexOf(side)
                ? sideColor(side.color).bg + ' ' + sideColor(side.color).text + ' ' + sideColor(side.color).border + ' border'
                : 'text-neutral-500 hover:text-neutral-300'
            ]">
            <span :class="[sideColor(side.color).dot, 'w-2 h-2 rounded-full']"></span>
            {{ side.name }}
            <span class="font-mono text-[10px] opacity-60">{{ side.players }}</span>
          </button>
        </div>
      </div>
    </div>
    <!-- Fallback: flat tabs -->
    <div v-else class="flex gap-1 mb-4 bg-neutral-800/40 rounded-lg p-1">
      <button v-for="(side, idx) in mission.sides" :key="side.name"
        @click="activeSide = idx"
        :class="[
          'flex-1 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5',
          activeSide === idx
            ? sideColor(side.color).bg + ' ' + sideColor(side.color).text + ' ' + sideColor(side.color).border + ' border'
            : 'text-neutral-500 hover:text-neutral-300'
        ]">
        <span :class="[sideColor(side.color).dot, 'w-2 h-2 rounded-full']"></span>
        {{ side.name }}
        <span class="font-mono text-[10px] opacity-60">{{ side.players }}</span>
      </button>
    </div>

    <!-- Side content -->
    <div v-if="currentSide" class="space-y-4">
      <!-- Role -->
      <div class="flex items-center gap-4 text-xs text-neutral-400">
        <span v-if="currentSide.role">
          Роль: <span class="text-neutral-200">{{ currentSide.role }}</span>
        </span>
        <span v-if="currentSide.squads?.length">
          Отделений: <span class="text-neutral-200 font-mono">{{ currentSide.squads.length }}</span>
        </span>
      </div>

      <!-- Vehicles -->
      <div v-if="currentSide.vehicles" class="bg-neutral-800/30 rounded-lg p-3">
        <div class="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">Техника</div>
        <div class="text-xs text-neutral-300 leading-relaxed">{{ currentSide.vehicles }}</div>
      </div>

      <!-- Squads -->
      <div v-if="currentSide.squads?.length" class="space-y-2">
        <div v-for="squad in currentSide.squads" :key="squad.name"
          class="bg-neutral-800/30 border border-neutral-800/50 rounded-lg overflow-hidden">
          <div class="flex items-center justify-between px-3 py-2 border-b border-neutral-800/30">
            <span :class="[sideColor(currentSide.color).text, 'text-xs font-bold']">{{ squad.name }}</span>
            <span class="text-[10px] font-mono text-neutral-500">{{ squad.size }} чел.</span>
          </div>
          <div class="px-3 py-2 flex flex-wrap gap-1">
            <span v-for="(slot, sIdx) in squad.slots" :key="sIdx"
              class="text-[11px] px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-400">
              {{ slot }}
            </span>
          </div>
        </div>
      </div>

      <!-- Gallery -->
      <div v-if="currentSide.gallery && currentSide.gallery.length" class="space-y-2">
        <div class="text-[10px] uppercase tracking-wider text-neutral-500">Скриншоты</div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button v-for="(url, gIdx) in currentSide.gallery" :key="gIdx"
            @click="openLightbox(currentSide.gallery, gIdx)"
            class="block aspect-video bg-neutral-800 rounded-lg overflow-hidden hover:ring-1 hover:ring-neutral-600 transition-all cursor-pointer">
            <img :src="url" :alt="`Screenshot ${gIdx + 1}`" class="w-full h-full object-cover" loading="lazy" />
          </button>
        </div>
      </div>
    </div>

    <!-- Download + source links -->
    <div class="mt-5 flex flex-wrap gap-2">
      <a v-if="mission.downloadLink" :href="mission.downloadLink" target="_blank" rel="noopener"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-delta-green/20 text-delta-green border border-delta-green/30 rounded-lg hover:bg-delta-green/30 transition-colors">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Скачать миссию
      </a>
      <a v-if="mission.sourceUrl" :href="mission.sourceUrl" target="_blank" rel="noopener"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-neutral-800 text-neutral-400 border border-neutral-700 rounded-lg hover:text-neutral-200 transition-colors">
        Открыть на tsgames.ru →
      </a>
    </div>

    <!-- Footer meta -->
    <div class="mt-4 pt-4 border-t border-neutral-800 flex flex-wrap items-center gap-3 text-[10px] text-neutral-600">
      <span>Автор: {{ mission.authors?.join(', ') || '—' }}</span>
      <span>Загружено: {{ formatDate(mission.uploadDate) }}</span>
      <span v-if="mission.lastUpdate">Обновлено: {{ formatDate(mission.lastUpdate) }}</span>
    </div>
  </BaseModal>

  <!-- Lightbox -->
  <ImageLightbox
    v-if="lightbox.open"
    :images="lightbox.images"
    :start-index="lightbox.index"
    @close="lightbox.open = false"
  />
</template>
