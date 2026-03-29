<script setup>
import { onMounted, computed, ref } from 'vue'
import { useUsersStore } from '../stores/users'
import { useRosterStore } from '../stores/roster'
import { SITE_ROLES } from '../utils/constants'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'
import BaseSelect from '../components/common/BaseSelect.vue'

const usersStore = useUsersStore()
const roster = useRosterStore()
const changingRole = ref(null)
const linkingUser = ref(null)
const linkingBusy = ref(false)

onMounted(async () => {
  await Promise.all([
    usersStore.fetchUsers(),
    roster.players.length ? Promise.resolve() : roster.fetchPlayers(),
  ])
})

// Найти связанного player по email
function linkedPlayer(user) {
  if (!user.email) return null
  return roster.players.find(p => p.email === user.email) || null
}

// Игроки, не привязанные ни к одному user
const unllinkedPlayers = computed(() => {
  const userEmails = new Set(usersStore.users.map(u => u.email).filter(Boolean))
  return roster.players
    .filter(p => !p.email || !userEmails.has(p.email))
    .filter(p => p.status !== 'left')
})

async function linkPlayer(user, playerUid) {
  if (!playerUid || linkingBusy.value) return
  linkingBusy.value = true
  try {
    await roster.updatePlayer(playerUid, { email: user.email })
    if (user.role === 'guest') await usersStore.setRole(user.uid, 'member')
    linkingUser.value = null
  } finally {
    linkingBusy.value = false
  }
}

async function unlinkPlayer(user) {
  const player = linkedPlayer(user)
  if (!player || linkingBusy.value) return
  linkingBusy.value = true
  try {
    await roster.updatePlayer(player.uid, { email: '' })
    if (user.role === 'member') await usersStore.setRole(user.uid, 'guest')
  } finally {
    linkingBusy.value = false
  }
}

const roleOptions = computed(() =>
  Object.entries(SITE_ROLES).map(([key, cfg]) => ({ value: key, label: cfg.label }))
)

const unlinkedPlayerOptions = computed(() => [
  { value: '', label: 'Выбрать...' },
  ...unllinkedPlayers.value.map(p => ({ value: p.uid, label: p.nickname })),
])

const sortedUsers = computed(() => {
  const roleOrder = { admin: 0, member: 1, guest: 2 }
  return [...usersStore.users].sort((a, b) =>
    (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3)
  )
})

async function changeRole(userId, newRole) {
  changingRole.value = userId
  try {
    await usersStore.setRole(userId, newRole)
  } finally {
    changingRole.value = null
  }
}

function formatDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const roleBadgeClass = {
  admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  member: 'bg-delta-green/20 text-delta-green border-delta-green/30',
  guest: 'bg-neutral-700/30 text-neutral-500 border-neutral-600/30',
}
</script>

<template>
  <div class="pb-20 md:pb-0">
    <LoadingSpinner v-if="usersStore.loading" />
    <template v-else>
      <div class="flex items-center justify-between mb-5">
        <h1 class="text-2xl font-bold">Пользователи</h1>
        <span class="text-sm text-neutral-500">{{ usersStore.users.length }} аккаунтов</span>
      </div>

      <div class="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-neutral-800 text-neutral-400 text-xs">
              <th class="text-left px-4 py-3 font-medium">Пользователь</th>
              <th class="text-left px-4 py-3 font-medium">Игрок</th>
              <th class="text-left px-4 py-3 font-medium">Роль</th>
              <th class="text-left px-4 py-3 font-medium">Создан</th>
              <th class="text-left px-4 py-3 font-medium">Последний вход</th>
              <th class="text-right px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in sortedUsers" :key="user.uid"
              class="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
              <!-- User info -->
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center overflow-hidden shrink-0">
                    <img v-if="user.photoURL" :src="user.photoURL" class="w-full h-full object-cover" />
                    <span v-else class="text-xs text-neutral-500">{{ (user.displayName || user.email || '?')[0] }}</span>
                  </div>
                  <div>
                    <div class="font-medium text-sm">{{ user.displayName || '—' }}</div>
                    <div class="text-xs text-neutral-500">{{ user.email }}</div>
                  </div>
                </div>
              </td>

              <!-- Linked player -->
              <td class="px-4 py-3">
                <template v-if="linkedPlayer(user)">
                  <div class="flex items-center gap-2">
                    <router-link :to="{ name: 'player-profile', params: { id: linkedPlayer(user).uid } }"
                      class="text-delta-green hover:underline text-sm">
                      {{ linkedPlayer(user).nickname }}
                    </router-link>
                    <button @click="unlinkPlayer(user)" :disabled="linkingBusy"
                      class="text-neutral-600 hover:text-red-400 transition-colors text-xs" title="Отвязать">✕</button>
                  </div>
                </template>
                <template v-else>
                  <div v-if="linkingUser === user.uid" class="flex items-center gap-1">
                    <BaseSelect
                      :model-value="''"
                      @update:model-value="linkPlayer(user, $event)"
                      :options="unlinkedPlayerOptions"
                      :disabled="linkingBusy"
                      placeholder="Выбрать..."
                      size="sm"
                      class="max-w-[140px]"
                    />
                    <button @click="linkingUser = null" class="text-neutral-600 hover:text-neutral-300 text-xs">✕</button>
                  </div>
                  <button v-else @click="linkingUser = user.uid"
                    class="text-xs text-neutral-500 hover:text-delta-green transition-colors">
                    Привязать
                  </button>
                </template>
              </td>

              <!-- Role badge -->
              <td class="px-4 py-3">
                <span :class="['text-xs px-2 py-0.5 rounded border', roleBadgeClass[user.role] || roleBadgeClass.guest]">
                  {{ SITE_ROLES[user.role]?.label || user.role }}
                </span>
              </td>

              <!-- Created at -->
              <td class="px-4 py-3 text-neutral-500 text-xs">
                {{ formatDate(user.createdAt) }}
              </td>

              <!-- Last login -->
              <td class="px-4 py-3 text-neutral-500 text-xs">
                {{ formatDate(user.lastLoginAt) }}
              </td>

              <!-- Role selector -->
              <td class="px-4 py-3 text-right">
                <BaseSelect
                  :model-value="user.role"
                  @update:model-value="changeRole(user.uid, $event)"
                  :options="roleOptions"
                  :disabled="changingRole === user.uid"
                  size="sm"
                />
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="!usersStore.users.length" class="text-center py-8 text-neutral-500">
          Нет зарегистрированных пользователей
        </div>
      </div>

    </template>
  </div>
</template>
