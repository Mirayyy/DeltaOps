import { ref } from 'vue'

/**
 * Telegram Bot API integration for sending reminders.
 * Bot token and chat ID are stored in Firestore config or env vars.
 * Falls back to demo mode (console.log) when not configured.
 */

const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || ''
const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID || ''

export function useTelegram() {
  const sending = ref(false)
  const lastError = ref(null)

  const isConfigured = !!(botToken && chatId)

  async function sendMessage(text) {
    sending.value = true
    lastError.value = null

    if (!isConfigured) {
      // Demo mode
      console.log('[Telegram Demo]', text)
      sending.value = false
      return { ok: true, demo: true }
    }

    try {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      })

      const data = await resp.json()
      if (!data.ok) {
        lastError.value = data.description || 'Ошибка Telegram API'
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

  function buildReminderMessage(unrespondedPlayers, weekId) {
    const names = unrespondedPlayers.map(p => p.nickname).join(', ')
    return `📋 <b>DeltaOps — Неделя ${weekId}</b>\n\nНе отметили посещаемость:\n${names}\n\nОтметьтесь на сайте!`
  }

  function buildNewWeekMessage(weekId) {
    return `🆕 <b>DeltaOps — Новая неделя ${weekId}</b>\n\nОтметьте посещаемость на сайте!`
  }

  return {
    isConfigured, sending, lastError,
    sendMessage, buildReminderMessage, buildNewWeekMessage,
  }
}
