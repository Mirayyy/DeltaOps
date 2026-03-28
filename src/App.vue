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
      <img
        :src="squad.logo"
        :alt="squad.name"
        class="w-12 h-12 object-contain opacity-40 animate-pulse"
      />
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
