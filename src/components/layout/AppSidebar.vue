<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useAppConfig } from '../../stores/appConfig'

const auth = useAuthStore()
const appConfig = useAppConfig()
const route = useRoute()
const collapsed = ref(true)
const manualToggle = ref(false)
const hovered = ref(false)

// Responsive: expand only on wide desktop; windowed layouts stay collapsed by default
const wideQuery = window.matchMedia('(min-width: 1440px)')

function onBreakpointChange(e) {
  if (!manualToggle.value) {
    collapsed.value = !e.matches
  }
}

onMounted(() => {
  collapsed.value = !wideQuery.matches
  wideQuery.addEventListener('change', onBreakpointChange)
  appConfig.fetch()
})

onBeforeUnmount(() => {
  wideQuery.removeEventListener('change', onBreakpointChange)
})

const navItems = [
  { name: 'profile', label: 'Профиль', icon: 'user', roles: ['member', 'admin'] },
  { name: 'dashboard', label: 'Дашборд', icon: 'grid', roles: ['member', 'admin'] },
  { name: 'lineup', label: 'Расстановка', icon: 'layers', roles: ['member', 'admin'] },
  { name: 'stats', label: 'Статистика', icon: 'chart', roles: ['member', 'admin'] },
  { name: 'roster', label: 'Состав', icon: 'users', roles: ['member', 'admin'] },
  { name: 'users', label: 'Пользователи', icon: 'shield', roles: ['admin'] },
  { name: 'archive', label: 'Архив', icon: 'archive', roles: ['admin'] },
  { name: 'logs', label: 'Логи', icon: 'logs', roles: ['admin'] },
  { name: 'settings', label: 'Настройки', icon: 'settings', roles: ['admin'] },
]

const mainItems = computed(() => navItems.filter(item => item.roles.includes('member')))
const adminItems = computed(() =>
  auth.isUserAdmin ? navItems.filter(item => !item.roles.includes('member')) : []
)

const expanded = computed(() => !collapsed.value || hovered.value)
const quickLinks = computed(() => ([
  { key: 'github', label: 'GitHub', icon: 'github', href: appConfig.githubUrl },
  { key: 'firebase', label: 'Firebase', icon: 'firebase', href: appConfig.firestoreUrl },
]).filter(link => link.href))

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
  logs: ['M9 12h6M9 16h6M9 8h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z'],
  settings: ['M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'],
  github: ['M12 2C6.477 2 2 6.589 2 12.133c0 4.435 2.865 8.198 6.839 9.526.5.094.683-.22.683-.488 0-.24-.009-.876-.014-1.72-2.782.61-3.369-1.357-3.369-1.357-.454-1.167-1.11-1.477-1.11-1.477-.908-.628.069-.615.069-.615 1.004.072 1.532 1.04 1.532 1.04.892 1.548 2.341 1.1 2.91.841.091-.656.349-1.1.635-1.353-2.22-.256-4.555-1.127-4.555-5.017 0-1.108.39-2.015 1.029-2.725-.103-.257-.446-1.29.098-2.69 0 0 .84-.274 2.75 1.04A9.45 9.45 0 0112 6.836c.85.004 1.705.116 2.504.34 1.909-1.314 2.748-1.04 2.748-1.04.546 1.4.203 2.433.1 2.69.64.71 1.028 1.617 1.028 2.725 0 3.9-2.339 4.758-4.566 5.01.359.313.678.931.678 1.876 0 1.355-.012 2.449-.012 2.782 0 .27.18.586.688.487A10.03 10.03 0 0022 12.133C22 6.59 17.523 2 12 2z'],
  firebase: ['M5.752 15.313l1.77-11.352c.068-.436.52-.61.828-.32l1.68 1.59 1.882-3.614c.175-.336.654-.337.83-.001l1.002 1.913-7.992 11.784zm.083.988L12.633 5.95l1.63 3.118.193.37-8.621 6.863zm.9.5l10.762-8.568 1.683 1.594c.308.292.274.802-.062 1.045L12.96 20.2a.671.671 0 01-.82-.004l-5.405-3.395z'],
  chevron: ['M9 5l7 7-7 7'],
}
</script>

<template>
  <nav
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    :class="[
      'sticky top-12 h-[calc(100vh-3rem)] sidebar-bg border-r border-neutral-800/60 flex flex-col shrink-0 transition-[width] duration-200 overflow-x-hidden overflow-y-auto',
      expanded ? 'w-56 p-3' : 'w-[68px] p-3',
    ]"
  >
    <div class="flex flex-col gap-0.5 mt-1">
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

    <div v-if="quickLinks.length" class="mt-auto pt-4">
      <div v-if="expanded" class="mb-2 px-3">
        <div class="h-px bg-neutral-800/80"></div>
      </div>
      <div class="flex flex-col gap-0.5">
        <a
          v-for="link in quickLinks"
          :key="link.key"
          :href="link.href"
          target="_blank"
          rel="noopener noreferrer"
          :class="[
            'group flex items-center rounded-lg text-sm text-neutral-400 transition-all duration-150 whitespace-nowrap hover:text-neutral-100 hover:bg-neutral-800/50',
            expanded ? 'gap-3 px-3 py-2' : 'justify-center px-2 py-2',
          ]"
        >
          <span class="w-7 h-7 rounded-md bg-neutral-800/60 flex items-center justify-center shrink-0 text-neutral-500 transition-colors group-hover:text-neutral-300 group-hover:bg-neutral-700/50">
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path v-for="(d, i) in ICON_PATHS[link.icon]" :key="i" :d="d" />
            </svg>
          </span>
          <span v-show="expanded" class="text-[13px]">{{ link.label }}</span>
        </a>
      </div>
    </div>

    <!-- Collapse toggle -->
    <button
      @click="collapsed = !collapsed; manualToggle = true"
      :class="[
        'flex items-center rounded-lg text-sm text-neutral-600 hover:text-neutral-400 transition-colors whitespace-nowrap',
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
