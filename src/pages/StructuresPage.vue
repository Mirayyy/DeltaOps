<script setup>
import { ref, onMounted } from 'vue'
import { useStructuresStore } from '../stores/structures'
import { generateSlotIds } from '../stores/structures'
import { EQUIPMENT_LIST } from '../utils/constants'
import BaseModal from '../components/common/BaseModal.vue'
import EquipmentTag from '../components/common/EquipmentTag.vue'
import BaseCheckbox from '../components/common/BaseCheckbox.vue'

const structures = useStructuresStore()

const showEditor = ref(false)
const editingStructure = ref(null)
const editName = ref('')
const editSlots = ref([])

onMounted(async () => {
  await structures.fetchStructures()
})

function openCreate() {
  editingStructure.value = null
  editName.value = 'Новая структура'
  editSlots.value = [
    { slotNumber: 1, section: '1-3', slotId: '1-3', roleName: 'Отделение 1-3', type: 'КО', equipment: [] },
    { slotNumber: 2, section: '1-3', slotId: '1-3 1', roleName: 'Стрелок', type: '', equipment: [] },
  ]
  showEditor.value = true
}

function openEdit(structure) {
  editingStructure.value = structure.id
  editName.value = structure.name
  editSlots.value = structure.slots.map(s => ({ ...s, equipment: [...(s.equipment || [])] }))
  showEditor.value = true
}

function addSlot(type = '') {
  const lastSection = editSlots.value.length
    ? editSlots.value[editSlots.value.length - 1].section
    : ''
  editSlots.value.push({
    slotNumber: editSlots.value.length + 1,
    section: type === 'КО' ? '' : lastSection,
    slotId: '',
    roleName: type === 'КО' ? 'Новое отделение' : 'Стрелок',
    type,
    equipment: [],
  })
  recalcIds()
}

function removeSlot(idx) {
  editSlots.value.splice(idx, 1)
  renumber()
  recalcIds()
}

function moveSlot(idx, dir) {
  const newIdx = idx + dir
  if (newIdx < 0 || newIdx >= editSlots.value.length) return
  const tmp = editSlots.value[idx]
  editSlots.value[idx] = editSlots.value[newIdx]
  editSlots.value[newIdx] = tmp
  renumber()
  recalcIds()
}

function renumber() {
  editSlots.value.forEach((s, i) => { s.slotNumber = i + 1 })
}

function recalcIds() {
  editSlots.value = generateSlotIds(editSlots.value)
}

function onSectionChange(idx, value) {
  editSlots.value[idx].section = value
  recalcIds()
}

function toggleSlotEquipment(slotIdx, eqName) {
  const eq = editSlots.value[slotIdx].equipment
  const i = eq.indexOf(eqName)
  if (i === -1) eq.push(eqName)
  else eq.splice(i, 1)
}

const equipmentMenuSlot = ref(null)

async function save() {
  if (!editName.value.trim()) return
  recalcIds()

  const data = {
    id: editingStructure.value || `struct-${Date.now()}`,
    name: editName.value.trim(),
    slots: editSlots.value,
  }

  await structures.saveStructure(data)
  showEditor.value = false
}

async function deleteStructure(id) {
  await structures.deleteStructure(id)
}
</script>

<template>
  <div class="pb-20 md:pb-0">
    <!-- Header -->
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-2xl font-bold">Структуры</h1>
        <p class="text-sm text-neutral-500">Шаблоны расстановки для загрузки в игры</p>
      </div>
      <button @click="openCreate"
        class="px-4 py-2 bg-delta-green hover:bg-delta-green/80 text-white text-sm font-medium rounded-lg transition-colors">
        Создать
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="!structures.structures.length" class="bg-neutral-900 rounded-xl border border-neutral-800 p-12 text-center">
      <p class="text-neutral-500">Нет структур</p>
      <p class="text-xs text-neutral-600 mt-1">Создайте шаблон расстановки</p>
    </div>

    <!-- Structure cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div v-for="s in structures.structures" :key="s.id"
        class="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
        <div class="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h3 class="font-medium">{{ s.name }}</h3>
            <p class="text-xs text-neutral-500 mt-0.5">
              {{ s.slots.filter(sl => sl.type !== 'КО').length }} слотов,
              {{ s.slots.filter(sl => sl.type === 'КО').length }} отделений
            </p>
          </div>
          <div class="flex gap-2">
            <button @click="openEdit(s)"
              class="px-3 py-1 text-xs border border-neutral-700 rounded-lg text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors">
              Редактировать
            </button>
            <button @click="deleteStructure(s.id)"
              class="px-3 py-1 text-xs border border-red-900/50 rounded-lg text-red-400 hover:text-red-300 hover:border-red-700 transition-colors">
              Удалить
            </button>
          </div>
        </div>

        <!-- Preview table -->
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <tbody>
              <tr v-for="(slot, idx) in s.slots" :key="idx"
                :class="[
                  'border-b border-neutral-800/30',
                  slot.type === 'КО' ? 'bg-neutral-800/40' : ''
                ]">
                <td class="px-4 py-1.5 font-mono text-neutral-600 w-16">{{ slot.slotId }}</td>
                <td :class="['px-3 py-1.5', slot.type === 'КО' ? 'font-bold text-delta-green' : 'text-neutral-300']">
                  {{ slot.roleName }}
                </td>
                <td class="px-3 py-1.5">
                  <div class="flex gap-1">
                    <EquipmentTag v-for="eq in (slot.equipment || [])" :key="eq" :name="eq" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Editor modal -->
    <BaseModal v-if="showEditor" :title="editingStructure ? 'Редактировать структуру' : 'Новая структура'" wide @close="showEditor = false">
      <div class="space-y-4">
        <!-- Name -->
        <div>
          <label class="text-xs text-neutral-500 block mb-1">Название</label>
          <input v-model="editName"
            class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:border-delta-green outline-none">
        </div>

        <!-- Slots -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs text-neutral-500">Слоты</label>
            <div class="flex gap-1">
              <button @click="addSlot('КО')"
                class="px-2 py-1 text-[10px] bg-delta-green/20 text-delta-green rounded hover:bg-delta-green/30 transition-colors">
                + Отделение
              </button>
              <button @click="addSlot()"
                class="px-2 py-1 text-[10px] bg-neutral-700 text-neutral-300 rounded hover:bg-neutral-600 transition-colors">
                + Слот
              </button>
            </div>
          </div>

          <div class="space-y-1 max-h-80 overflow-y-auto pr-1">
            <div v-for="(slot, idx) in editSlots" :key="idx"
              :class="[
                'flex items-center gap-2 p-2 rounded-lg',
                slot.type === 'КО' ? 'bg-neutral-800' : 'bg-neutral-800/50'
              ]">
              <!-- Slot ID -->
              <span class="text-[10px] font-mono text-neutral-600 w-12 shrink-0">{{ slot.slotId }}</span>

              <!-- Section (for КО) -->
              <input v-if="slot.type === 'КО'"
                :value="slot.section"
                @input="onSectionChange(idx, $event.target.value)"
                placeholder="1-3"
                class="w-14 bg-neutral-700 border border-neutral-600 rounded px-1.5 py-1 text-xs focus:border-delta-green outline-none shrink-0">

              <!-- Role name -->
              <input v-model="slot.roleName"
                placeholder="Название"
                :class="[
                  'flex-1 bg-transparent border-b border-transparent hover:border-neutral-700 focus:border-delta-green px-1 py-1 text-xs outline-none',
                  slot.type === 'КО' ? 'font-bold text-delta-green' : ''
                ]">

              <!-- Equipment toggle -->
              <div class="relative">
                <button @click="equipmentMenuSlot = equipmentMenuSlot === idx ? null : idx"
                  class="w-6 h-6 rounded text-[10px] bg-neutral-700 text-neutral-400 hover:text-white transition-colors flex items-center justify-center"
                  title="Снаряжение">
                  {{ (slot.equipment || []).length || '+' }}
                </button>
                <div v-if="equipmentMenuSlot === idx"
                  class="absolute right-0 top-full mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-30 p-2 min-w-36">
                  <div v-for="eq in EQUIPMENT_LIST" :key="eq"
                    class="px-2 py-0.5 hover:bg-neutral-700 rounded">
                    <BaseCheckbox
                      :checked="(slot.equipment || []).includes(eq)"
                      @change="toggleSlotEquipment(idx, eq)"
                      size="sm"
                    >
                      <span class="text-xs text-neutral-300">{{ eq }}</span>
                    </BaseCheckbox>
                  </div>
                </div>
              </div>

              <!-- Move / Delete -->
              <button @click="moveSlot(idx, -1)" :disabled="idx === 0"
                class="text-neutral-600 hover:text-neutral-300 text-xs disabled:opacity-30">^</button>
              <button @click="moveSlot(idx, 1)" :disabled="idx === editSlots.length - 1"
                class="text-neutral-600 hover:text-neutral-300 text-xs disabled:opacity-30 rotate-180">^</button>
              <button @click="removeSlot(idx)"
                class="text-red-500/50 hover:text-red-400 text-xs">x</button>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-2 pt-2">
          <button @click="showEditor = false"
            class="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors">
            Отмена
          </button>
          <button @click="save"
            class="px-4 py-2 bg-delta-green hover:bg-delta-green/80 text-white text-sm font-medium rounded-lg transition-colors">
            Сохранить
          </button>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
