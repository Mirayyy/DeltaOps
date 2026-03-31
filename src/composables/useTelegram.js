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

  /** Lineup notification — sent to individual player DM or group */
  function buildLineupMessage(playerNickname, playerSlots, gameDates) {
    const gameLabels = {
      friday_1: 'Пятница 1', friday_2: 'Пятница 2',
      saturday_1: 'Суббота 1', saturday_2: 'Суббота 2',
    }

    const lines = [
      `<b>${app.siteName} — Расстановка</b>`,
      `Игрок: <b>${playerNickname}</b>`,
      '',
    ]

    let hasSlot = false
    for (const [gameId, slot] of Object.entries(playerSlots)) {
      if (!slot) continue
      hasSlot = true
      const label = gameLabels[gameId] || gameId
      const equipment = (slot.equipment || []).join(', ')
      lines.push(`<b>${label}:</b> ${slot.name} (${slot.squad})`)
      if (equipment) lines.push(`  Снаряжение: ${equipment}`)
    }

    if (!hasSlot) {
      lines.push('Ты не в расстановке на эту неделю.')
    }

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
  function buildReminderMessage(unrespondedPlayers, weekId) {
    const mentions = unrespondedPlayers.map(p => `  - ${mention(p)} (${p.nickname})`)

    return [
      `<b>${app.siteName} — Неделя ${weekId}</b>`,
      '',
      `Не отметили посещаемость (${unrespondedPlayers.length}):`,
      ...mentions,
      '',
      `<a href="${app.siteUrl}">Открыть ${app.siteName}</a>`,
    ].join('\n')
  }

  /** New week announcement */
  function buildNewWeekMessage(weekId, fridayDate, saturdayDate) {
    return [
      `<b>${app.siteName} — Новая неделя ${weekId}</b>`,
      '',
      `Пятница: ${fridayDate || '—'}`,
      `Суббота: ${saturdayDate || '—'}`,
      '',
      `<a href="${app.siteUrl}">Открыть ${app.siteName}</a>`,
    ].join('\n')
  }

  /** Week finalized summary */
  function buildWeekSummaryMessage(weekId, stats) {
    const lines = [
      `<b>${app.siteName} — Неделя ${weekId} завершена</b>`,
      '',
    ]
    if (stats && stats.length) {
      for (const g of stats) {
        lines.push(`${g.label}: ${g.confirmed} пришли, ${g.absent} нет, ${g.noResponse} без ответа`)
      }
    }
    lines.push('')
    lines.push(`<a href="${app.siteUrl}">Открыть ${app.siteName}</a>`)
    return lines.join('\n')
  }

  return {
    isConfigured, sending, lastError,
    sendMessage, mention,
    buildMissionsMessage,
    buildLineupMessage,
    buildLineupSummaryMessage,
    buildReminderMessage,
    buildNewWeekMessage,
    buildWeekSummaryMessage,
  }
}
