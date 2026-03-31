import { ref } from 'vue'
import { useAppConfig } from '../stores/appConfig'

/**
 * Telegram Bot API integration for squad notifications.
 *
 * Env vars: VITE_TELEGRAM_BOT_TOKEN, VITE_TELEGRAM_CHAT_ID
 * Players need `telegramUsername` for @mentions.
 */

const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || ''
const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID || ''

export function useTelegram() {
  const sending = ref(false)
  const lastError = ref(null)
  const app = useAppConfig()

  const isConfigured = !!(botToken && chatId)

  // ─── Core ────────────────────────────────────────────

  async function sendMessage(text, options = {}) {
    sending.value = true
    lastError.value = null

    if (!isConfigured) {
      console.log('[Telegram Demo]', text)
      sending.value = false
      return { ok: true, demo: true }
    }

    try {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: options.chatId || chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      })

      const data = await resp.json()
      if (!data.ok) {
        lastError.value = data.description || 'Telegram API error'
        return { ok: false, error: lastError.value }
      }
      return { ok: true }
    } catch (e) {
      lastError.value = e.message
      return { ok: false, error: e.message }
    } finally {
      sending.value = false
    }
  }

  function mention(player) {
    if (player.telegramUsername) {
      return `@${player.telegramUsername.replace(/^@/, '')}`
    }
    return player.nickname
  }

  // ─── Message builders ────────────────────────────────

  /** Missions loaded — sent to group */
  function buildMissionsMessage(missions, gameDates, squadSide) {
    const daySlots = {
      friday: { label: 'Пятница', slots: ['friday_1', 'friday_2'] },
      saturday: { label: 'Суббота', slots: ['saturday_1', 'saturday_2'] },
    }

    const lines = [
      `<b>Опубликованы миссии на этой неделе</b>`,
      '',
    ]

    for (const [day, info] of Object.entries(daySlots)) {
      const date = gameDates?.[day] || '—'
      const dayMissions = info.slots.map(s => missions[s]).filter(Boolean)
      if (!dayMissions.length) continue

      lines.push(`<b>${info.label} ${date}</b>`)
      lines.push('')

      for (let i = 0; i < dayMissions.length; i++) {
        const mission = dayMissions[i]
        const title = mission.missionTitle || mission.title || '—'
        const map = mission.map || ''
        const slot = info.slots[i]

        lines.push(`${i === 1 ? 'Вторая' : 'Первая'} миссия: <b>${title}</b> | ${map}`)
        lines.push('')

        // Group sides by ally/enemy
        const sides = mission.sides || []
        const allySides = []
        const enemySides = []

        if (squadSide && mission.rotationSides) {
          for (const side of sides) {
            let team = null
            for (const rot of mission.rotationSides) {
              if (rot.gameSides.some(gs => gs.color === side.color)) {
                team = rot.color === squadSide ? 'ally' : 'enemy'
                break
              }
            }
            if (team === 'ally') allySides.push(side)
            else enemySides.push(side)
          }
        }

        function formatSide(s, rotSides) {
          const gameSide = s.name || ''
          const role = s.role || ''
          const count = s.playerCount || s.players || 0
          // Find faction name from rotationSides
          let faction = ''
          if (rotSides) {
            for (const rot of rotSides) {
              const gs = rot.gameSides.find(g => g.color === s.color)
              if (gs) { faction = gs.name; break }
            }
          }
          const parts = [gameSide]
          if (faction) parts.push(faction)
          if (role) parts.push(`(${role})`)
          parts.push(`${count} чел.`)
          lines.push(`  ${parts.join(' — ')}`)
          if (s.vehicles) lines.push(`  Техника: ${s.vehicles}`)
        }

        const rotSides = mission.rotationSides || null

        if (allySides.length || enemySides.length) {
          if (allySides.length) {
            lines.push('<b>Союзники:</b>')
            allySides.forEach(s => formatSide(s, rotSides))
          }
          if (enemySides.length) {
            lines.push('<b>Противники:</b>')
            enemySides.forEach(s => formatSide(s, rotSides))
          }
        } else {
          sides.forEach(s => formatSide(s, rotSides))
        }

        lines.push('')
        const links = []
        if (mission.sourceUrl) links.push(`<a href="${mission.sourceUrl}">TSG</a>`)
        links.push(`<a href="${app.siteUrl}/lineup?game=${slot}">Запросить слоты</a>`)
        lines.push(links.join(' | '))
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  /** Personal slot notification — sent to player DM */
  function buildSlotNotification({ slot, dayLabel, gameDate, missionTitle, missionNumber }) {
    const SLOT_TYPE_LABELS = {
      squadCommander: 'КО',
      sideCommander: 'Командир стороны',
      vehicle: 'Техника',
      reserve: 'Запас',
    }
    const missionNum = missionNumber === 1 ? 'Первая миссия' : 'Вторая миссия'

    const lines = [
      `<b>Уведомление о слоте</b>`,
      '',
      `<b>${dayLabel} ${gameDate}</b>`,
      '',
    ]

    if (missionTitle) {
      lines.push(`${missionNum}: ${missionTitle}`)
      lines.push('')
    }

    lines.push(`<b>${slot.side} — ${slot.squad} — ${slot.number} — ${slot.name}</b>`)

    if (slot.type) lines.push(`Тип: ${SLOT_TYPE_LABELS[slot.type] || slot.type}`)
    if (slot.fireteam) lines.push(`ФТ: ${slot.fireteam}`)
    if (slot.equipment?.length) lines.push(`Снаряжение: ${slot.equipment.join(', ')}`)
    if (slot.notes) lines.push(`Заметки: ${slot.notes}`)

    if (slot.personalTask) {
      lines.push('')
      lines.push(`<b>Личная задача:</b>`)
      lines.push(slot.personalTask)
    }

    lines.push('')
    lines.push(`<a href="${app.siteUrl}/lineup?game=${slot.gameId || ''}">Посмотреть расстановку</a>`)

    return lines.join('\n')
  }

  /** Lineup published — group summary */
  function buildLineupSummaryMessage(gamesData, rosterPlayers, missions, gameDates) {
    const daySlots = {
      friday: { label: 'Пятница', slots: ['friday_1', 'friday_2'] },
      saturday: { label: 'Суббота', slots: ['saturday_1', 'saturday_2'] },
    }

    const resolveNick = (playerId) => {
      const p = rosterPlayers.find(r => r.uid === playerId)
      return p ? p.nickname : '—'
    }

    const lines = [
      `<b>Расстановка опубликована</b>`,
      '',
    ]

    for (const [day, info] of Object.entries(daySlots)) {
      const date = gameDates?.[day] || '—'
      const dayHasSlots = info.slots.some(s => gamesData[s]?.slots?.some(sl => sl.playerId))
      if (!dayHasSlots) continue

      lines.push(`<b>${info.label} ${date}</b>`)
      lines.push('')

      for (let i = 0; i < info.slots.length; i++) {
        const gameId = info.slots[i]
        const game = gamesData[gameId]
        if (!game || !game.slots || !game.slots.some(s => s.playerId)) continue

        const mission = missions?.[gameId]
        const title = mission?.title || '—'
        const map = mission?.map || ''

        lines.push(`${i === 1 ? 'Вторая' : 'Первая'} миссия: <b>${title}</b>${map ? ' | ' + map : ''}`)
        lines.push('')

        // Group assigned slots by side → squad
        const assigned = game.slots.filter(s => s.playerId)
        const bySideSquad = {}
        for (const slot of assigned) {
          const key = `${slot.side}::${slot.squad}`
          if (!bySideSquad[key]) bySideSquad[key] = { side: slot.side, squad: slot.squad, slots: [] }
          bySideSquad[key].slots.push(slot)
        }

        for (const group of Object.values(bySideSquad)) {
          lines.push(`<b>${group.side} — ${group.squad}</b>`)
          let num = 1
          for (const slot of group.slots) {
            lines.push(`${num}  ${slot.name} — ${resolveNick(slot.playerId)}`)
            num++
          }
          lines.push('')
        }

        // Task
        if (game.task) {
          lines.push('<b>Задача отряда</b>')
          lines.push(game.task)
          lines.push('')
        }

        lines.push(`<a href="${app.siteUrl}/lineup?game=${gameId}">Просмотр расстановки</a>`)
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  /** Reminder for unresponded players */
  function buildReminderMessage(unrespondedPlayers, gameDates) {
    const mentions = unrespondedPlayers.map(p => `  - ${mention(p)} (${p.nickname})`)

    const dates = []
    if (gameDates?.friday) dates.push(`Пятница ${gameDates.friday}`)
    if (gameDates?.saturday) dates.push(`Суббота ${gameDates.saturday}`)

    return [
      `<b>Обновление посещаемости</b>`,
      '',
      dates.join(' | '),
      '',
      `Не отметили посещаемость (${unrespondedPlayers.length}):`,
      ...mentions,
      '',
      `<a href="${app.siteUrl}">Отметиться</a>`,
    ].join('\n')
  }


  return {
    isConfigured, sending, lastError,
    sendMessage, mention,
    buildMissionsMessage,
    buildSlotNotification,
    buildLineupSummaryMessage,
    buildReminderMessage,
  }
}
