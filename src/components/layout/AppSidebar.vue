<script setup>
import { ref, computed, h } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const collapsed = ref(false)
const hovered = ref(false)

const navItems = [
  { name: 'profile', label: 'Профиль', icon: 'user', roles: ['member', 'admin'] },
  { name: 'dashboard', label: 'Дашборд', icon: 'grid', roles: ['member', 'admin'] },
  { name: 'lineup', label: 'Расстановка', icon: 'layers', roles: ['member', 'admin'] },
  { name: 'stats', label: 'Статистика', icon: 'chart', roles: ['member', 'admin'] },
  { name: 'roster', label: 'Состав', icon: 'users', roles: ['member', 'admin'] },
  { name: 'users', label: 'Пользователи', icon: 'shield', roles: ['admin'] },
  { name: 'archive', label: 'Архив', icon: 'archive', roles: ['admin'] },
  { name: 'settings', label: 'Настройки', icon: 'settings', roles: ['admin'] },
]

const mainItems = computed(() => navItems.filter(item => item.roles.includes('member')))
const adminItems = computed(() =>
  auth.isUserAdmin ? navItems.filter(item => !item.roles.includes('member')) : []
)

const expanded = computed(() => !collapsed.value || hovered.value)

function isActive(item) {
  return route.name === item.name
}

// SVG icon paths
const ICON_PATHS = {
  user: ['M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'],
  grid: ['M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'],
  layers: ['M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'],
  chart: ['M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'],
  users: ['M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'],
  shield: ['M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'],
  archive: ['M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4'],
  settings: ['M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'],
  chevron: ['M9 5l7 7-7 7'],
}
</script>

<template>
  <nav
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    :class="[
      'sticky top-[49px] h-[calc(100vh-49px)] sidebar-bg border-r border-neutral-800/60 flex flex-col shrink-0 transition-all duration-200 overflow-x-hidden overflow-y-auto',
      expanded ? 'w-56 p-3' : 'w-[68px] p-3',
    ]"
  >
    <!-- Main nav label -->
    <div v-if="expanded" class="px-3 mb-2 mt-1">
      <span class="text-[9px] font-semibold tracking-[0.2em] uppercase text-neutral-600">Меню</span>
    </div>

    <div class="flex flex-col gap-0.5">
      <router-link
        v-for="item in mainItems"
        :key="item.name"
        :to="{ name: item.name }"
        :class="[
          'group relative flex items-center rounded-lg text-sm transition-all duration-150 whitespace-nowrap',
          expanded ? 'gap-3 px-3 py-2' : 'justify-center px-2 py-2',
          isActive(item)
            ? 'bg-orange-500/10 text-orange-400'
            : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50',
        ]"
      >
        <div v-if="isActive(item)" class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-orange-500 rounded-r"></div>
        <span :class="[
          'w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors',
          isActive(item) ? 'bg-orange-500/15 text-orange-400' : 'bg-neutral-800/60 text-neutral-500 group-hover:text-neutral-300 group-hover:bg-neutral-700/50',
        ]">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path v-for="(d, i) in ICON_PATHS[item.icon]" :key="i" stroke-linecap="round" stroke-linejoin="round" :d="d" />
          </svg>
        </span>
        <span v-show="expanded" class="text-[13px]">{{ item.label }}</span>
      </router-link>
    </div>

    <!-- Admin section -->
    <template v-if="adminItems.length">
      <div class="px-3 mt-4 mb-2">
        <div v-if="expanded" class="flex items-center gap-2">
          <div class="h-px flex-1 bg-neutral-800/80"></div>
          <span class="text-[9px] font-semibold tracking-[0.2em] uppercase text-neutral-600">Админ</span>
          <div class="h-px flex-1 bg-neutral-800/80"></div>
        </div>
        <div v-else class="h-px bg-neutral-800/80 mx-2"></div>
      </div>

      <div class="flex flex-col gap-0.5">
        <router-link
          v-for="item in adminItems"
          :key="item.name"
          :to="{ name: item.name }"
          :class="[
            'group relative flex items-center rounded-lg text-sm transition-all duration-150 whitespace-nowrap',
            expanded ? 'gap-3 px-3 py-2' : 'justify-center px-2 py-2',
            isActive(item)
              ? 'bg-orange-500/10 text-orange-400'
              : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50',
          ]"
        >
          <div v-if="isActive(item)" class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-orange-500 rounded-r"></div>
          <span :class="[
            'w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors',
            isActive(item) ? 'bg-orange-500/15 text-orange-400' : 'bg-neutral-800/60 text-neutral-500 group-hover:text-neutral-300 group-hover:bg-neutral-700/50',
          ]">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path v-for="(d, i) in ICON_PATHS[item.icon]" :key="i" stroke-linecap="round" stroke-linejoin="round" :d="d" />
            </svg>
          </span>
          <span v-show="expanded" class="text-[13px]">{{ item.label }}</span>
        </router-link>
      </div>
    </template>

    <!-- Collapse toggle -->
    <button
      @click="collapsed = !collapsed"
      :class="[
        'mt-auto flex items-center rounded-lg text-sm text-neutral-600 hover:text-neutral-400 transition-colors whitespace-nowrap',
        expanded ? 'gap-3 px-3 py-2' : 'justify-center px-2 py-2',
      ]"
    >
      <span class="w-7 h-7 rounded-md bg-neutral-800/40 flex items-center justify-center shrink-0">
        <svg :class="['w-3.5 h-3.5 transition-transform', collapsed ? '' : 'rotate-180']" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path v-for="(d, i) in ICON_PATHS.chevron" :key="i" stroke-linecap="round" stroke-linejoin="round" :d="d" />
        </svg>
      </span>
      <span v-show="expanded" class="text-[13px]">Свернуть</span>
    </button>
  </nav>
</template>

<style scoped>
.sidebar-bg {
  background: linear-gradient(180deg, rgba(23, 23, 23, 0.95) 0%, rgba(18, 18, 18, 0.98) 100%);
}
</style>
