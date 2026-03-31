<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import { useSquadConfig } from './stores/squadConfig'
import AppHeader from './components/layout/AppHeader.vue'
import AppSidebar from './components/layout/AppSidebar.vue'
import MobileNav from './components/layout/MobileNav.vue'
import ToastContainer from './components/common/ToastContainer.vue'

const auth = useAuthStore()
const squad = useSquadConfig()

onMounted(() => {
  squad.fetch()
  auth.init()
})
</script>

<template>
  <!-- Loading screen -->
  <div v-if="auth.loading" class="min-h-screen flex items-center justify-center bg-neutral-950">
    <div class="flex flex-col items-center gap-4">
      <img v-if="squad.logo"
        :src="squad.logo"
        :alt="squad.name"
        class="w-12 h-12 object-contain opacity-40 animate-pulse"
        @error="$event.target.style.display='none'"
      />
      <svg v-else class="w-12 h-12 text-neutral-700 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
      <span class="text-neutral-600 text-sm tracking-wider">Загрузка...</span>
    </div>
  </div>

  <!-- App shell -->
  <div v-else class="min-h-screen flex flex-col app-bg">
    <AppHeader v-if="auth.viewMode === 'member'" />

    <div class="flex flex-1">
      <AppSidebar v-if="auth.viewMode === 'member'" class="hidden md:flex" />

      <main class="flex-1 p-4 md:p-6 overflow-auto relative">
        <!-- Subtle ambient glow -->
        <div v-if="auth.viewMode === 'member'" class="pointer-events-none fixed top-0 right-0 w-[500px] h-[500px] bg-orange-600/[0.02] rounded-full blur-[150px]"></div>
        <div class="relative z-10">
          <router-view />
        </div>
      </main>
    </div>

    <MobileNav v-if="auth.viewMode === 'member'" class="md:hidden" />
    <ToastContainer />
  </div>
</template>

<style scoped>
.app-bg {
  background: #0f0f0f;
  background-image:
    radial-gradient(ellipse at 0% 0%, rgba(249, 115, 22, 0.03) 0%, transparent 50%),
    radial-gradient(ellipse at 100% 100%, rgba(138, 154, 78, 0.02) 0%, transparent 50%);
}
</style>
