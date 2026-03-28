<script setup>
import { ref, computed, onMounted } from 'vue'
import { marked } from 'marked'
import { useAuthStore } from '../stores/auth'
import { useRosterStore } from '../stores/roster'
import { useWebContentStore } from '../stores/webContent'
import { useArchiveStore } from '../stores/archive'
import { useRouter } from 'vue-router'
import { kpdColor } from '../utils/formatters'
import { useSquadConfig } from '../stores/squadConfig'
import { useAppConfig } from '../stores/appConfig'
import { getTsgUrl } from '../utils/constants'

const squad = useSquadConfig()
const app = useAppConfig()
const archive = useArchiveStore()

const auth = useAuthStore()
const roster = useRosterStore()
const webContent = useWebContentStore()
const router = useRouter()

const rosterCount = computed(() =>
  roster.activePlayers.length + roster.reservePlayers.length + roster.bannedPlayers.length
)

const currentServer = computed(() => squad.server || '')
const currentSide = computed(() => squad.side || '')

const contactPlayers = computed(() => {
  const uids = squad.config.contacts
  if (!Array.isArray(uids) || !uids.length) return []
  return uids
    .map(uid => roster.getPlayer(uid))
    .filter(Boolean)
})

async function handleLogin() {
  try {
    await auth.login()
    if (auth.viewMode === 'member') {
      router.push(auth.isUserAdmin ? '/dashboard' : '/profile')
    }
  } catch (err) {
    console.error('Login failed:', err)
  }
}

const squadStats = ref(null)
const sideStats = ref(null)
const statsLoading = ref(true)

function rankDeltaText(delta) {
  if (delta > 0) return `+${delta}`
  if (delta < 0) return `${delta}`
  return '='
}

function rankDeltaClass(delta) {
  if (delta > 0) return 'text-orange-400'
  if (delta < 0) return 'text-red-400'
  return 'text-neutral-500'
}


async function fetchStats() {
  try {
    const [squadRes, t2Res, t3Res] = await Promise.all([
      fetch('https://stats.tsgames.ru/api/v1/squad-stats/').then(r => r.json()),
      fetch('https://stats.tsgames.ru/api/v1/side-stats/t2/').then(r => r.json()),
      fetch('https://stats.tsgames.ru/api/v1/side-stats/t3/').then(r => r.json()),
    ])

    // Find DELTA in squad stats (API returns { items: [...] } or plain array)
    const squadList = squadRes?.items || (Array.isArray(squadRes) ? squadRes : [])
    const delta = squadList.find(s => s.name === squad.name)
    if (delta) squadStats.value = delta

    // Find DELTA in side stats (check both servers, both sides)
    for (const serverData of [t2Res, t3Res]) {
      if (!serverData?.tables) continue
      for (const side of ['red', 'blue']) {
        const list = serverData.tables[side]
        if (!Array.isArray(list)) continue
        const found = list.find(s => s.squad === squad.name)
        if (found) {
          const sideLabel = side === 'red' ? 'Красные' : 'Синие'
          const sideColor = side === 'red' ? 'text-red-400' : 'text-blue-400'
          sideStats.value = {
            ...found,
            server: serverData.server,
            side,
            sideLabel,
            sideColor,
            rank: list.indexOf(found) + 1,
            total: list.length,
          }
          break
        }
      }
      if (sideStats.value) break
    }
  } catch (err) {
    console.warn('Failed to fetch stats:', err)
  } finally {
    statsLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([squad.fetch(), app.fetch()])
  fetchStats()
  webContent.fetchContent()
  if (!roster.players.length) roster.fetchPlayers()
  if (!archive.rotations.length) archive.fetchArchives()
})

function awardPlayerName(award) {
  if (award.type !== 'player' || !award.playerUid) return null
  const p = roster.getPlayer(award.playerUid)
  return p ? p.nickname : null
}

const awards = computed(() => webContent.landingAwards)

// Color map for {color}text{/color} syntax
const COLOR_MAP = {
  orange: '#fb923c',
  green: '#4ade80',
  red: '#f87171',
  blue: '#60a5fa',
  yellow: '#facc15',
  white: '#ffffff',
  delta: '#8a9a4e',
}

function processColors(md) {
  return md.replace(/\{(\w+)\}([\s\S]*?)\{\/\1\}/g, (_, color, text) => {
    const hex = COLOR_MAP[color]
    if (!hex) return text
    return `<span style="color:${hex}">${text}</span>`
  })
}

const aboutHtml = computed(() => {
  if (!webContent.aboutMarkdown) return ''
  const processed = processColors(webContent.aboutMarkdown)
  return marked.parse(processed, { breaks: true })
})
</script>

<template>
  <div class="landing-page -m-4 md:-m-6">

    <!-- ═══ HERO ═══ -->
    <section class="hero-section relative overflow-hidden">
      <!-- Background layers -->
      <div class="absolute inset-0 bg-gradient-to-b from-neutral-950 via-neutral-900/95 to-neutral-950"></div>
      <div class="absolute inset-0 hero-grid opacity-[0.025]"></div>
      <div class="absolute inset-0 hero-scanlines opacity-[0.015]"></div>

      <!-- Radial glow behind logo -->
      <div class="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-500/8 rounded-full blur-[120px]"></div>
      <div class="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] bg-orange-400/10 rounded-full blur-[60px]"></div>

      <!-- Corner decorations -->
      <div class="absolute top-6 left-6 w-12 h-12 border-l-2 border-t-2 border-orange-600/20"></div>
      <div class="absolute top-6 right-6 w-12 h-12 border-r-2 border-t-2 border-orange-600/20"></div>
      <div class="absolute bottom-6 left-6 w-12 h-12 border-l-2 border-b-2 border-orange-600/20"></div>
      <div class="absolute bottom-6 right-6 w-12 h-12 border-r-2 border-b-2 border-orange-600/20"></div>

      <div class="relative z-10 flex flex-col items-center justify-center min-h-[85vh] px-6 pt-16 pb-24">
        <!-- Logo with glow ring -->
        <div class="relative mb-10">
          <div class="absolute inset-0 bg-orange-500/15 rounded-full blur-2xl scale-150 animate-pulse-slow"></div>
          <div class="relative w-32 h-32 md:w-40 md:h-40 rounded-full flex items-center justify-center
                      bg-gradient-to-b from-neutral-800/90 to-neutral-900/90
                      border border-neutral-600/30 shadow-2xl shadow-black/60
                      ring-1 ring-orange-500/10 ring-offset-4 ring-offset-neutral-950">
            <img
              :src="squad.logo"
              :alt="squad.name"
              class="w-20 h-20 md:w-28 md:h-28 object-contain drop-shadow-lg"
            />
          </div>
        </div>

        <!-- Title block -->
        <div class="text-center mb-8">
          <h1 class="text-5xl md:text-7xl font-black tracking-[0.15em] text-white mb-5 hero-title">
            DELTA
          </h1>
          <div class="flex items-center justify-center gap-4 mb-0">
            <div class="h-px w-12 bg-gradient-to-r from-transparent to-orange-500/60"></div>
            <p class="text-neutral-500 text-xs tracking-[0.35em] uppercase">
              Tushino Serious Games &bull; Arma 3
            </p>
            <div class="h-px w-12 bg-gradient-to-l from-transparent to-orange-500/60"></div>
          </div>
        </div>

        <!-- Status + Action combined -->
        <div class="flex flex-col items-center gap-5">
          <div class="inline-flex items-center gap-2.5 px-5 py-2 bg-orange-600/10 rounded-full border border-orange-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
            <span class="text-xs text-orange-400 tracking-[0.2em] uppercase font-medium">Набор открыт</span>
          </div>

          <!-- Actions -->
          <div v-if="auth.viewMode === 'member'" class="flex flex-col sm:flex-row gap-3 justify-center">
            <router-link
              v-if="auth.isUserAdmin"
              to="/dashboard"
              class="group relative px-8 py-3 bg-orange-600/90 hover:bg-orange-500 text-white font-semibold rounded transition-all duration-300 tracking-wider text-xs uppercase overflow-hidden"
            >
              <div class="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-400/20 to-orange-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <span class="relative">Панель управления</span>
            </router-link>
            <router-link
              to="/profile"
              class="px-8 py-3 bg-transparent hover:bg-neutral-800/60 text-neutral-300 hover:text-white font-semibold rounded transition-all duration-300 border border-neutral-600/40 hover:border-neutral-500/60 tracking-wider text-xs uppercase"
            >
              Мой профиль
            </router-link>
          </div>

          <div v-else>
            <button
              @click="handleLogin"
              class="group relative px-10 py-3 bg-orange-600/90 hover:bg-orange-500 text-white font-semibold rounded transition-all duration-300 tracking-wider text-xs uppercase overflow-hidden"
            >
              <div class="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-400/20 to-orange-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <span class="relative">Войти через Google</span>
            </button>
          </div>
        </div>

        <p v-if="auth.viewMode === 'restricted'" class="mt-4 text-red-400 text-sm">
          Ваш доступ ограничен. Обратитесь к командиру.
        </p>

        <!-- Scroll hint -->
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-neutral-600">
          <span class="text-[10px] tracking-[0.3em] uppercase">Scroll</span>
          <svg class="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 14l-7 7m0 0l-7-7" />
          </svg>
        </div>
      </div>
    </section>

    <!-- ═══ AWARDS ═══ -->
    <section class="relative py-20 px-6">
      <div class="absolute inset-0 bg-neutral-900/50"></div>
      <div class="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-amber-600/30 to-transparent"></div>

      <div class="relative z-10 max-w-3xl mx-auto">
        <div class="flex items-center gap-3 mb-12">
          <div class="h-px flex-1 bg-gradient-to-r from-amber-600/50 to-transparent"></div>
          <h2 class="text-xs tracking-[0.3em] uppercase text-amber-500 font-semibold">Достижения</h2>
          <div class="h-px flex-1 bg-gradient-to-l from-amber-600/50 to-transparent"></div>
        </div>

        <div class="space-y-4">
          <div
            v-for="award in awards"
            :key="award.title"
            class="group flex items-center gap-5 bg-neutral-900/60 border border-neutral-700/30 rounded-lg p-5 hover:border-amber-600/30 transition-all duration-300"
          >
            <!-- Award icon -->
            <div class="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 bg-neutral-800/80 rounded-lg flex items-center justify-center border border-neutral-700/40 group-hover:border-amber-600/20 transition-all duration-300">
              <img
                :src="award.icon"
                :alt="award.title"
                class="w-10 h-10 md:w-14 md:h-14 object-contain"
              />
            </div>

            <!-- Award info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <h3 class="text-white font-bold text-lg">{{ award.title }}</h3>
                <span v-if="awardPlayerName(award)"
                  class="text-xs px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/25 text-blue-400">
                  {{ awardPlayerName(award) }}
                </span>
              </div>
              <p class="text-neutral-400 text-sm leading-relaxed">{{ award.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ STATS ═══ -->
    <section class="relative py-20 px-6">
      <div class="absolute inset-0 bg-gradient-to-b from-neutral-900/30 via-neutral-950 to-neutral-900/30"></div>

      <div class="relative z-10 max-w-3xl mx-auto">
        <div class="flex items-center gap-3 mb-12">
          <div class="h-px flex-1 bg-gradient-to-r from-orange-600/50 to-transparent"></div>
          <h2 class="text-xs tracking-[0.3em] uppercase text-orange-500 font-semibold">Статистика</h2>
          <div class="h-px flex-1 bg-gradient-to-l from-orange-600/50 to-transparent"></div>
        </div>

        <!-- Loading -->
        <div v-if="statsLoading" class="text-center text-neutral-500 py-8">
          Загрузка статистики...
        </div>

        <!-- Stats grid -->
        <div v-else-if="squadStats" class="grid grid-cols-3 gap-4">
          <!-- КПД -->
          <div class="relative group bg-neutral-900/60 border border-neutral-700/30 rounded-lg p-6 text-center hover:border-orange-600/40 transition-all duration-300">
            <div class="absolute inset-0 bg-orange-600/0 group-hover:bg-orange-600/5 rounded-lg transition-all duration-300"></div>
            <div class="relative z-10">
              <div class="text-orange-500/60 text-2xl mb-3">◈</div>
              <div :class="['text-3xl md:text-4xl font-black mb-1', kpdColor(squadStats.efficiency)]">{{ squadStats.efficiency.toFixed(2) }}</div>
              <div class="text-xs tracking-widest uppercase text-neutral-500">КПД</div>
            </div>
          </div>

          <!-- Рейтинг -->
          <div class="relative group bg-neutral-900/60 border border-neutral-700/30 rounded-lg p-6 text-center hover:border-orange-600/40 transition-all duration-300">
            <div class="absolute inset-0 bg-orange-600/0 group-hover:bg-orange-600/5 rounded-lg transition-all duration-300"></div>
            <div class="relative z-10">
              <div class="text-orange-500/60 text-2xl mb-3">▲</div>
              <div class="text-3xl md:text-4xl font-black text-white mb-1">
                #{{ squadStats.rank }}
                <span v-if="squadStats.delta > 0" class="text-lg font-semibold ml-1 text-green-400">▲{{ squadStats.delta }}</span>
                <span v-else-if="squadStats.delta < 0" class="text-lg font-semibold ml-1 text-red-400">▼{{ Math.abs(squadStats.delta) }}</span>
              </div>
              <div class="text-xs tracking-widest uppercase text-neutral-500">Рейтинг</div>
            </div>
          </div>

          <!-- Рейтинг на стороне -->
          <div class="relative group bg-neutral-900/60 border border-neutral-700/30 rounded-lg p-6 text-center hover:border-orange-600/40 transition-all duration-300">
            <div class="absolute inset-0 bg-orange-600/0 group-hover:bg-orange-600/5 rounded-lg transition-all duration-300"></div>
            <div class="relative z-10">
              <div class="text-orange-500/60 text-2xl mb-3">◇</div>
              <div v-if="sideStats" class="text-3xl md:text-4xl font-black text-white mb-1">
                #{{ sideStats.rank }} <span class="text-lg font-bold text-neutral-500">({{ sideStats.server }})</span>
              </div>
              <div v-else class="text-3xl md:text-4xl font-black text-neutral-600 mb-1">—</div>
              <div class="text-xs tracking-widest uppercase text-neutral-500">
                Рейтинг на стороне
              </div>
            </div>
          </div>
        </div>

        <!-- Fallback -->
        <div v-else class="text-center text-neutral-600 py-8">
          Статистика недоступна
        </div>
      </div>
    </section>

    <!-- ═══ ABOUT ═══ -->
    <section class="relative py-20 px-6">
      <div class="absolute inset-0 bg-neutral-900/50"></div>
      <div class="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-orange-600/40 to-transparent"></div>

      <div class="relative z-10 max-w-3xl mx-auto">
        <div class="flex items-center gap-3 mb-8">
          <div class="h-px flex-1 bg-gradient-to-r from-orange-600/50 to-transparent"></div>
          <h2 class="text-xs tracking-[0.3em] uppercase text-orange-500 font-semibold">Об отряде</h2>
          <div class="h-px flex-1 bg-gradient-to-l from-orange-600/50 to-transparent"></div>
        </div>

        <div class="about-content space-y-4 text-neutral-300 leading-relaxed" v-html="aboutHtml"></div>

        <!-- Info cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10">
          <div class="bg-neutral-800/40 border border-neutral-700/30 rounded-lg p-4 text-center">
            <div class="text-orange-400 text-xs tracking-widest uppercase mb-2">Набор</div>
            <div :class="['font-semibold', squad.config.recruitment === 'open' ? 'text-orange-400' : 'text-neutral-400']">
              {{ squad.config.recruitment === 'open' ? 'Открыт' : 'Закрыт' }}
            </div>
          </div>
          <div class="bg-neutral-800/40 border border-neutral-700/30 rounded-lg p-4 text-center">
            <div class="text-orange-400 text-xs tracking-widest uppercase mb-2">Сервер</div>
            <div class="text-white font-semibold">{{ currentServer || '—' }}</div>
          </div>
          <div class="bg-neutral-800/40 border border-neutral-700/30 rounded-lg p-4 text-center">
            <div class="text-orange-400 text-xs tracking-widest uppercase mb-2">Сторона</div>
            <div :class="['font-semibold', currentSide === 'red' ? 'text-red-400' : 'text-blue-400']">
              {{ currentSide === 'red' ? 'Красные' : currentSide === 'blue' ? 'Синие' : '—' }}
            </div>
          </div>
          <div class="bg-neutral-800/40 border border-neutral-700/30 rounded-lg p-4 text-center">
            <div class="text-orange-400 text-xs tracking-widest uppercase mb-2">Игроков</div>
            <div class="text-white font-semibold">{{ rosterCount }}</div>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
          <div class="bg-neutral-800/40 border border-neutral-700/30 rounded-lg p-4 text-center">
            <div class="text-orange-400 text-xs tracking-widest uppercase mb-2">Создан</div>
            <div class="text-white font-semibold">{{ squad.config.createdAt || '—' }}</div>
          </div>
          <div class="bg-neutral-800/40 border border-neutral-700/30 rounded-lg p-4 text-center">
            <div class="text-orange-400 text-xs tracking-widest uppercase mb-2">Слоты</div>
            <div class="text-white font-semibold">{{ squad.config.guaranteedSlots || '—' }}</div>
          </div>
          <div class="bg-neutral-800/40 border border-neutral-700/30 rounded-lg p-4 text-center">
            <div class="text-orange-400 text-xs tracking-widest uppercase mb-2">Статус</div>
            <div class="text-white font-semibold text-xs">{{ squad.config.status || '—' }}</div>
          </div>
        </div>

        <!-- Contact -->
        <div v-if="contactPlayers.length" class="mt-8 text-center">
          <p class="text-neutral-500 text-sm">
            По всем вопросам обращаться к
            <template v-for="(cp, i) in contactPlayers" :key="cp.uid">
              <span v-if="i > 0" class="text-neutral-600">, </span>
              <a :href="getTsgUrl(cp.nickname)" target="_blank"
                class="text-white font-medium hover:text-orange-400 transition-colors">{{ cp.nickname }}</a>
            </template>
          </p>
        </div>
      </div>
    </section>

    <!-- ═══ FOOTER ═══ -->
    <footer class="relative py-10 px-6 border-t border-neutral-800/50">
      <div class="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <img
            :src="squad.logo"
            :alt="squad.name"
            class="w-6 h-6 object-contain opacity-40"
          />
          <span class="text-neutral-600 text-sm">{{ squad.name }} &bull; {{ app.siteName }}</span>
        </div>
        <div class="text-neutral-700 text-xs tracking-wide">
          Tushino Serious Games &bull; Arma 3
        </div>
      </div>
    </footer>

  </div>
</template>

<style scoped>
.hero-grid {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
  background-size: 60px 60px;
}

.hero-scanlines {
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(255, 255, 255, 0.03) 2px,
    rgba(255, 255, 255, 0.03) 4px
  );
}

.hero-title {
  text-shadow: 0 0 80px rgba(138, 154, 78, 0.15), 0 2px 4px rgba(0, 0, 0, 0.5);
}

@keyframes pulse-slow {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.animate-pulse-slow {
  animation: pulse-slow 4s ease-in-out infinite;
}

.about-content :deep(p) {
  margin-bottom: 1rem;
}
.about-content :deep(p:first-child) {
  font-size: 1.125rem;
}
.about-content :deep(strong) {
  color: white;
  font-weight: 600;
}
.about-content :deep(em) {
  color: #fb923c;
  font-style: italic;
}
.about-content :deep(del) {
  color: #737373;
}
.about-content :deep(h1),
.about-content :deep(h2),
.about-content :deep(h3) {
  color: white;
  font-weight: 700;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}
.about-content :deep(h1) { font-size: 1.5rem; }
.about-content :deep(h2) { font-size: 1.25rem; }
.about-content :deep(h3) { font-size: 1.1rem; }
.about-content :deep(a) {
  color: #fb923c;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.about-content :deep(a:hover) {
  color: #fdba74;
}
.about-content :deep(ul),
.about-content :deep(ol) {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}
.about-content :deep(ul) { list-style: disc; }
.about-content :deep(ol) { list-style: decimal; }
.about-content :deep(li) {
  margin-bottom: 0.25rem;
}
.about-content :deep(blockquote) {
  border-left: 3px solid #fb923c;
  padding-left: 1rem;
  margin: 1rem 0;
  color: #a3a3a3;
  font-style: italic;
}
.about-content :deep(hr) {
  border: none;
  border-top: 1px solid rgba(255,255,255,0.1);
  margin: 1.5rem 0;
}
.about-content :deep(code) {
  background: rgba(255,255,255,0.08);
  padding: 0.15em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
  color: #8a9a4e;
}
</style>
