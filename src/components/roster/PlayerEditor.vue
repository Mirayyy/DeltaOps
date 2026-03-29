<script setup>
import { ref, computed } from 'vue'
import BaseModal from '../common/BaseModal.vue'
import BaseSelect from '../common/BaseSelect.vue'
import { PLAYER_STATUSES, SKILL_LEVELS, POSITIONS } from '../../utils/constants'
import { useAuthStore } from '../../stores/auth'
import { useSquadConfig } from '../../stores/squadConfig'

const auth = useAuthStore()
const squadConfig = useSquadConfig()

const props = defineProps({
  player: { type: Object, default: null },
})

const emit = defineEmits(['save', 'close'])

const isEdit = !!props.player
const isAdmin = auth.isUserAdmin

const form = ref({
  nickname: '',
  email: '',
  position: 'Боец отряда',
  status: 'active',
  avatar: '',
  nicknameColor: '',
  steamUrl: '',
  telegramUsername: '',
  telegramId: '',
  discordId: '',
  discordUsername: '',
  wishes: '',
})

// skills as array of { skillName, level }
const skills = ref([])

if (isEdit) {
  form.value = {
    nickname: props.player.nickname || '',
    email: props.player.email || '',
    position: props.player.position || 'Боец отряда',
    status: props.player.status || 'active',
    avatar: props.player.avatar || '',
    nicknameColor: props.player.nicknameColor || '',
    steamUrl: props.player.steamUrl || '',
    telegramUsername: props.player.telegramUsername || '',
    telegramId: props.player.telegramId || '',
    discordId: props.player.discordId || '',
    discordUsername: props.player.discordUsername || '',
    wishes: props.player.wishes || '',
  }
  skills.value = [...(props.player.skills || [])]
}

function getSkillLevel(skillName) {
  return skills.value.find(s => s.skillName === skillName)?.level || null
}

function toggleSkill(skillName) {
  const idx = skills.value.findIndex(s => s.skillName === skillName)
  if (idx !== -1) {
    // Cycle level
    const levels = ['beginner', 'intermediate', 'experienced']
    const current = levels.indexOf(skills.value[idx].level)
    skills.value[idx].level = levels[(current + 1) % levels.length]
  } else {
    skills.value.push({ skillName, level: 'beginner' })
  }
}

function removeSkill(skillName) {
  skills.value = skills.value.filter(s => s.skillName !== skillName)
}

// Member statuses — no 'left' (admin-only via roster)
const memberStatuses = { active: PLAYER_STATUSES.active, reserve: PLAYER_STATUSES.reserve, banned: PLAYER_STATUSES.banned }

const positionOptions = POSITIONS.map(p => ({ value: p, label: p }))
const statusOptions = computed(() => {
  const src = isAdmin ? PLAYER_STATUSES : memberStatuses
  return Object.entries(src).map(([key, cfg]) => ({ value: key, label: cfg.label }))
})

function handleSave() {
  if (isAdmin) {
    if (!form.value.nickname.trim()) return
    emit('save', {
      ...form.value,
      telegramId: form.value.telegramId ? Number(form.value.telegramId) : null,
      skills: [...skills.value],
    })
  } else {
    // Member — only allowed fields
    emit('save', {
      status: form.value.status,
      avatar: form.value.avatar,
      telegramUsername: form.value.telegramUsername,
      telegramId: form.value.telegramId ? Number(form.value.telegramId) : null,
      discordId: form.value.discordId,
      discordUsername: form.value.discordUsername,
      steamUrl: form.value.steamUrl,
      wishes: form.value.wishes,
      skills: [...skills.value],
    })
  }
}
</script>

<template>
  <BaseModal :title="isEdit ? 'Редактировать игрока' : 'Добавить игрока'" :wide="true" @close="emit('close')">
    <div class="space-y-4">

      <!-- Admin-only: Callsign + Email -->
      <div v-if="isAdmin" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-neutral-400 mb-1">Позывной *</label>
          <input v-model="form.nickname" type="text" placeholder="HardKil"
            class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
        </div>
        <div>
          <label class="block text-xs text-neutral-400 mb-1">Email (Google)</label>
          <input v-model="form.email" type="email" placeholder="user@gmail.com"
            class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
        </div>
      </div>

      <!-- Admin-only: Position -->
      <div v-if="isAdmin" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-neutral-400 mb-1">Позиция</label>
          <BaseSelect v-model="form.position" :options="positionOptions" class="w-full" />
        </div>
      </div>

      <!-- Status -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-neutral-400 mb-1">Статус</label>
          <BaseSelect v-model="form.status" :options="statusOptions" class="w-full" />
        </div>
      </div>

      <!-- Contacts -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-neutral-400 mb-1">Telegram username</label>
          <input v-model="form.telegramUsername" type="text" placeholder="@username"
            class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
        </div>
        <div>
          <label class="block text-xs text-neutral-400 mb-1">Telegram ID</label>
          <input v-model="form.telegramId" type="text" placeholder="123456789"
            class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-neutral-400 mb-1">Discord username</label>
          <input v-model="form.discordUsername" type="text" placeholder="username"
            class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
        </div>
        <div>
          <label class="block text-xs text-neutral-400 mb-1">Discord ID</label>
          <input v-model="form.discordId" type="text" placeholder="123456789"
            class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
        </div>
      </div>

      <!-- Steam -->
      <div>
        <label class="block text-xs text-neutral-400 mb-1">Steam профиль</label>
        <input v-model="form.steamUrl" type="url" placeholder="https://steamcommunity.com/id/..."
          class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
      </div>

      <!-- Avatar -->
      <div>
        <label class="block text-xs text-neutral-400 mb-1">Аватар (ссылка)</label>
        <div class="flex gap-2 items-center">
          <div class="w-8 h-8 rounded-lg bg-neutral-800 overflow-hidden shrink-0 flex items-center justify-center">
            <img v-if="form.avatar" :src="form.avatar" class="w-full h-full object-cover" @error="$event.target.style.display='none'" />
            <span v-else class="text-xs text-neutral-600">—</span>
          </div>
          <input v-model="form.avatar" type="url" placeholder="https://..."
            class="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green" />
        </div>
      </div>

      <!-- Nickname color (admin only) -->
      <div v-if="isAdmin">
        <label class="block text-xs text-neutral-400 mb-1">Цвет ника</label>
        <div class="flex gap-2 items-center">
          <input type="color" :value="form.nicknameColor || '#e5e5e5'"
            @input="form.nicknameColor = $event.target.value"
            class="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0" />
          <span class="text-sm font-medium" :style="{ color: form.nicknameColor || '#e5e5e5' }">{{ form.nickname || 'Превью' }}</span>
          <button v-if="form.nicknameColor" @click="form.nicknameColor = ''"
            class="text-[10px] text-neutral-500 hover:text-neutral-300 ml-auto">Сбросить</button>
        </div>
      </div>

      <!-- Skills -->
      <div>
        <label class="block text-xs text-neutral-400 mb-2">Навыки (клик — добавить/сменить, ПКМ — убрать)</label>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="name in squadConfig.skillNames"
            :key="name"
            @click="toggleSkill(name)"
            @contextmenu.prevent="removeSkill(name)"
            :class="[
              'text-xs px-2.5 py-1 rounded-full border transition-colors',
              getSkillLevel(name)
                ? SKILL_LEVELS[getSkillLevel(name)].color + ' border-transparent text-white'
                : 'border-neutral-700 text-neutral-500 hover:border-neutral-500'
            ]"
          >
            {{ name }}
            <span v-if="getSkillLevel(name)" class="ml-1 opacity-75">{{ SKILL_LEVELS[getSkillLevel(name)].label[0] }}</span>
          </button>
        </div>
        <p class="text-[10px] text-neutral-600 mt-1">ЛКМ — добавить/сменить уровень, ПКМ — убрать</p>
      </div>

      <!-- Wishes -->
      <div>
        <label class="block text-xs text-neutral-400 mb-1">Пожелания</label>
        <textarea v-model="form.wishes" rows="2" placeholder="Пожелания по слотам, технике и т.д."
          class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-delta-green resize-none"></textarea>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2 pt-2">
        <button @click="emit('close')"
          class="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors">
          Отмена
        </button>
        <button @click="handleSave"
          :disabled="isAdmin && !form.nickname.trim()"
          class="px-4 py-2 text-sm bg-delta-green hover:bg-delta-green/90 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {{ isEdit ? 'Сохранить' : 'Добавить' }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>
