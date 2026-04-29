import { computed } from 'vue'
import { useWeekStateStore } from '../stores/weekState'
import { getDefaultWeekDates } from '../utils/gameWeek'

export function useGameWeek() {
  const weekState = useWeekStateStore()
  const fallbackWeek = computed(() => getDefaultWeekDates())
  const gameDates = computed(() => {
    if (weekState.lockedWeek) {
      return {
        friday: weekState.lockedWeek.friday,
        saturday: weekState.lockedWeek.saturday,
      }
    }
    return {
      friday: fallbackWeek.value.friday,
      saturday: fallbackWeek.value.saturday,
    }
  })

  const games = computed(() => [
    { id: 'friday_1', label: `Пятница 1`, date: gameDates.value.friday, day: 'friday' },
    { id: 'friday_2', label: `Пятница 2`, date: gameDates.value.friday, day: 'friday' },
    { id: 'saturday_1', label: `Суббота 1`, date: gameDates.value.saturday, day: 'saturday' },
    { id: 'saturday_2', label: `Суббота 2`, date: gameDates.value.saturday, day: 'saturday' },
  ])

  return { gameDates, games }
}
