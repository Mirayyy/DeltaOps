import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    name: 'landing',
    component: () => import('../pages/LandingPage.vue'),
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../pages/LoginPage.vue'),
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('../pages/ProfilePage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile/:id',
    name: 'player-profile',
    component: () => import('../pages/ProfilePage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../pages/DashboardPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/lineup',
    name: 'lineup',
    component: () => import('../pages/LineupPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/roster',
    name: 'roster',
    component: () => import('../pages/RosterPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('../pages/StatsPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/archive',
    name: 'archive',
    component: () => import('../pages/ArchivePage.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/users',
    name: 'users',
    component: () => import('../pages/UsersPage.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../pages/SettingsPage.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Wait for Firebase auth to finish initializing before checking permissions
  await auth.waitForInit()

  if (to.meta.requiresAuth && auth.viewMode === 'guest') {
    return { name: 'landing' }
  }

  if (to.meta.requiresAuth && auth.viewMode === 'restricted') {
    return { name: 'landing' }
  }

  if (to.meta.requiresAdmin && !auth.isUserAdmin) {
    return { name: 'profile' }
  }
})

export default router
