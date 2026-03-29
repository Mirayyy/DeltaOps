<script setup>
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const route = useRoute()

const navItems = [
  { name: 'profile', label: 'Профиль', icon: 'user', roles: ['member', 'admin'] },
  { name: 'dashboard', label: 'Дашборд', icon: 'grid', roles: ['member', 'admin'] },
  { name: 'lineup', label: 'Расст.', icon: 'layers', roles: ['member', 'admin'] },
  { name: 'stats', label: 'Стат.', icon: 'chart', roles: ['member', 'admin'] },
  { name: 'roster', label: 'Состав', icon: 'users', roles: ['member', 'admin'] },
  { name: 'users', label: 'Юзеры', icon: 'shield', roles: ['admin'] },
  { name: 'archive', label: 'Архив', icon: 'archive', roles: ['admin'] },
  { name: 'settings', label: 'Настр.', icon: 'settings', roles: ['admin'] },
]

function visibleItems() {
  return navItems.filter(item => item.roles.includes(auth.userRole))
}

const ICON_PATHS = {
  user: ['M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'],
  grid: ['M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'],
  layers: ['M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'],
  chart: ['M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'],
  users: ['M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'],
  shield: ['M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'],
  archive: ['M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4'],
  settings: ['M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'],
}
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 mobile-nav-glass border-t border-neutral-800/60 px-2 py-1.5 flex justify-around z-50">
    <router-link
      v-for="item in visibleItems()"
      :key="item.name"
      :to="{ name: item.name }"
      class="flex flex-col items-center gap-0.5 px-2 py-1 text-neutral-500 transition-colors relative"
      active-class="!text-orange-400"
    >
      <!-- Active dot -->
      <div v-if="route.name === item.name" class="absolute -top-1.5 w-4 h-0.5 rounded-full bg-orange-500"></div>

      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path v-for="(d, i) in ICON_PATHS[item.icon]" :key="i" stroke-linecap="round" stroke-linejoin="round" :d="d" />
      </svg>
      <span class="text-[10px]">{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.mobile-nav-glass {
  background: rgba(18, 18, 18, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
</style>
