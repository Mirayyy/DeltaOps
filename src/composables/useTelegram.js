import { ref } from 'vue'

/**
 * Telegram Bot API integration for sending notifications.
 * Bot token and chat ID from env vars (.env.local).
 * Falls back to demo mode (console.log) when not configured.
 *
 * Players must have `telegramUsername` field for @mentions to work.
 */

const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || ''
const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID || ''

export function useTelegram() {
  const sending = ref(false)
  const lastError = ref(null)

  const isConfigured = !!(botToken && chatId)

  /**
   * Send a message to the configured Telegram chat.
   * Supports HTML formatting: <b>, <i>, <a>, <code>
   */
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

  /**
   * Format player name with @mention if telegramUsername is available.
   * In groups: @username creates a clickable mention.
   * Without username: just shows nickname.
   */
  function formatPlayerMention(player) {
    if (player.telegramUsername) {
      const username = player.telegramUsername.replace(/^@/, '')
      return `@${username}`
    }
    return player.nickname
  }

  /**
   * Build reminder for players who haven't responded.
   */
  function buildReminderMessage(unrespondedPlayers, weekId) {
    const mentions = unrespondedPlayers.map(p => {
      const mention = formatPlayerMention(p)
      return `  - ${mention} (${p.nickname})`
    })

    return [
      `<b>DeltaOps — Неделя ${weekId}</b>`,
      '',
      `Не отметили посещаемость (${unrespondedPlayers.length}):`,
      ...mentions,
      '',
      'Отметьтесь на сайте!',
    ].join('\n')
  }

  /**
   * Build new week announcement.
   */
  function buildNewWeekMessage(weekId, fridayDate, saturdayDate) {
    return [
      `<b>DeltaOps — Новая неделя ${weekId}</b>`,
      '',
      `Пятница: ${fridayDate || '—'}`,
      `Суббота: ${saturdayDate || '—'}`,
      '',
      'Отметьте посещаемость на сайте!',
    ].join('\n')
  }

  /**
   * Build week finalized summary.
   */
  function buildWeekSummaryMessage(weekId, stats) {
    const lines = [
      `<b>DeltaOps — Неделя ${weekId} завершена</b>`,
      '',
    ]

    if (stats && stats.length) {
      for (const g of stats) {
        lines.push(`${g.label}: ${g.confirmed} пришли, ${g.absent} нет, ${g.noResponse} без ответа`)
      }
    }

    return lines.join('\n')
  }

  return {
    isConfigured, sending, lastError,
    sendMessage, formatPlayerMention,
    buildReminderMessage, buildNewWeekMessage, buildWeekSummaryMessage,
  }
}
