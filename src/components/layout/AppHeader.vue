<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useSquadConfig } from '../../stores/squadConfig'
import { useAppConfig } from '../../stores/appConfig'

const auth = useAuthStore()
const squad = useSquadConfig()
const app = useAppConfig()
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
        <img v-if="squad.logo"
          :src="squad.logo"
          :alt="squad.name"
          class="relative w-8 h-8 object-contain drop-shadow-lg"
          @error="$event.target.style.display='none'"
        />
        <svg v-else class="relative w-8 h-8 text-neutral-500 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      </div>
      <div class="hidden sm:flex items-baseline gap-2">
        <span v-if="app.loaded" class="text-base font-bold tracking-wide text-white" style="font-variant: small-caps">{{ app.siteName }}</span>
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
