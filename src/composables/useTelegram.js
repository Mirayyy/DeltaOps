import { ref } from 'vue'
import { useSquadConfig } from '../stores/squadConfig'

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
  const squad = useSquadConfig()

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
  function buildMissionsMessage(missions, gameDates) {
    const gameLabels = {
      friday_1: 'Пятница 1', friday_2: 'Пятница 2',
      saturday_1: 'Суббота 1', saturday_2: 'Суббота 2',
    }

    const lines = [
      `<b>${squad.siteName} — Миссии на неделю</b>`,
      '',
    ]

    if (gameDates) {
      lines.push(`Пт: ${gameDates.friday || '—'}  |  Сб: ${gameDates.saturday || '—'}`)
      lines.push('')
    }

    for (const [slot, mission] of Object.entries(missions)) {
      if (!mission) continue
      const label = gameLabels[slot] || slot
      const title = mission.missionTitle || mission.title || '—'
      const map = mission.map || ''
      const sides = (mission.sides || []).map(s => {
        const name = s.name || ''
        const count = s.playerCount || s.players || 0
        const role = s.role || ''
        return `${name} (${count}, ${role})`
      }).join(' vs ')

      lines.push(`<b>${label}:</b> ${title}`)
      if (map) lines.push(`  Карта: ${map}`)
      if (sides) lines.push(`  ${sides}`)
      if (mission.sourceUrl) lines.push(`  <a href="${mission.sourceUrl}">TSG</a>`)
      lines.push('')
    }

    lines.push(`<a href="${squad.siteUrl}">Открыть ${squad.siteName}</a>`)
    return lines.join('\n')
  }

  /** Lineup notification — sent to individual player DM or group */
  function buildLineupMessage(playerNickname, playerSlots, gameDates) {
    const gameLabels = {
      friday_1: 'Пятница 1', friday_2: 'Пятница 2',
      saturday_1: 'Суббота 1', saturday_2: 'Суббота 2',
    }

    const lines = [
      `<b>${squad.siteName} — Расстановка</b>`,
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
  function buildLineupSummaryMessage(gamesData, rosterPlayers) {
    const gameLabels = {
      friday_1: 'Пятница 1', friday_2: 'Пятница 2',
      saturday_1: 'Суббота 1', saturday_2: 'Суббота 2',
    }

    const resolveNick = (playerId) => {
      const p = rosterPlayers.find(r => r.uid === playerId)
      return p ? p.nickname : '—'
    }

    const lines = [
      `<b>${squad.siteName} — Расстановка опубликована</b>`,
      '',
    ]

    for (const gameId of ['friday_1', 'friday_2', 'saturday_1', 'saturday_2']) {
      const game = gamesData[gameId]
      if (!game || !game.slots || !game.slots.length) continue

      const assigned = game.slots.filter(s => s.playerId)
      if (!assigned.length) continue

      lines.push(`<b>${gameLabels[gameId]}:</b> ${assigned.length}/${game.slots.length} слотов`)
      for (const slot of assigned) {
        lines.push(`  ${slot.name} — ${resolveNick(slot.playerId)}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  /** Reminder for unresponded players */
  function buildReminderMessage(unrespondedPlayers, weekId) {
    const mentions = unrespondedPlayers.map(p => `  - ${mention(p)} (${p.nickname})`)

    return [
      `<b>${squad.siteName} — Неделя ${weekId}</b>`,
      '',
      `Не отметили посещаемость (${unrespondedPlayers.length}):`,
      ...mentions,
      '',
      `<a href="${squad.siteUrl}">Открыть ${squad.siteName}</a>`,
    ].join('\n')
  }

  /** New week announcement */
  function buildNewWeekMessage(weekId, fridayDate, saturdayDate) {
    return [
      `<b>${squad.siteName} — Новая неделя ${weekId}</b>`,
      '',
      `Пятница: ${fridayDate || '—'}`,
      `Суббота: ${saturdayDate || '—'}`,
      '',
      `<a href="${squad.siteUrl}">Открыть ${squad.siteName}</a>`,
    ].join('\n')
  }

  /** Week finalized summary */
  function buildWeekSummaryMessage(weekId, stats) {
    const lines = [
      `<b>${squad.siteName} — Неделя ${weekId} завершена</b>`,
      '',
    ]
    if (stats && stats.length) {
      for (const g of stats) {
        lines.push(`${g.label}: ${g.confirmed} пришли, ${g.absent} нет, ${g.noResponse} без ответа`)
      }
    }
    lines.push('')
    lines.push(`<a href="${squad.siteUrl}">Открыть ${squad.siteName}</a>`)
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
