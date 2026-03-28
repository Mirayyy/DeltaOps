<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useSquadConfig } from '../../stores/squadConfig'

const auth = useAuthStore()
const squad = useSquadConfig()
const router = useRouter()

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'landing' })
}
</script>

<template>
  <header class="sticky top-0 z-40 header-glass border-b border-neutral-800/60 px-4 py-2.5 flex items-center justify-between">
    <router-link to="/" class="flex items-center gap-3 group">
      <div class="relative">
        <div class="absolute inset-0 bg-orange-500/20 rounded-full blur-md scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <img
          :src="squad.logo"
          :alt="squad.name"
          class="relative w-8 h-8 object-contain drop-shadow-lg"
        />
      </div>
      <div class="hidden sm:flex items-baseline gap-2">
        <span class="text-base font-bold tracking-wide text-white">{{ squad.name }}</span>
        <span class="text-[10px] font-medium tracking-[0.2em] uppercase text-neutral-500">Ops</span>
      </div>
    </router-link>

    <div class="flex items-center gap-3">
      <router-link :to="{ name: 'profile' }"
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800/40 border border-neutral-700/30 hover:bg-neutral-800/60 hover:border-neutral-600/40 transition-colors">
        <div class="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500/30 to-orange-600/10 flex items-center justify-center text-[10px] font-bold text-orange-400">
          {{ auth.player?.nickname?.[0] || '?' }}
        </div>
        <span class="text-sm text-neutral-300 hidden sm:block">{{ auth.player?.nickname }}</span>
        <span v-if="auth.isUserAdmin"
              class="text-[10px] px-1.5 py-0.5 bg-amber-500/15 text-amber-400 rounded font-medium border border-amber-500/20">
          Admin
        </span>
      </router-link>
      <button @click="handleLogout"
              class="text-xs text-neutral-500 hover:text-neutral-300 transition-colors px-2 py-1.5 rounded hover:bg-neutral-800/50">
        Выйти
      </button>
    </div>
  </header>
</template>

<style scoped>
.header-glass {
  background: rgba(23, 23, 23, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
</style>
