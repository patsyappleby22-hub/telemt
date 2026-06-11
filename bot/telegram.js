import https from 'https'
import http from 'http'

export class TelegramBot {
  constructor(token) {
    this.token = token
    this.baseUrl = `https://api.telegram.org/bot${token}`
    this.offset = 0
    this.handlers = []
    this.cbHandlers = []
    this.chatMemberHandlers = []
    this.polling = false
  }

  async _call(method, body = {}) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body)
      const url = new URL(`${this.baseUrl}/${method}`)
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: 30000
      }, res => {
        let buf = ''
        res.on('data', d => buf += d)
        res.on('end', () => {
          try { resolve(JSON.parse(buf)) } catch { resolve({ ok: false }) }
        })
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
      req.write(data)
      req.end()
    })
  }

  async getMe() {
    const r = await this._call('getMe')
    return r.ok ? r.result : null
  }

  async sendMessage(chatId, text, extra = {}) {
    return this._call('sendMessage', { chat_id: chatId, text, ...extra })
  }

  async editMessageText(chatId, messageId, text, extra = {}) {
    return this._call('editMessageText', { chat_id: chatId, message_id: messageId, text, ...extra })
  }

  async editMessageReplyMarkup(chatId, messageId, replyMarkup) {
    return this._call('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: replyMarkup })
  }

  async answerCallbackQuery(id, opts = {}) {
    return this._call('answerCallbackQuery', { callback_query_id: id, ...opts })
  }

  async getChatMember(chatId, userId) {
    return this._call('getChatMember', { chat_id: chatId, user_id: userId })
  }

  async getUpdates(offset, timeout = 25) {
    return this._call('getUpdates', { offset, timeout, allowed_updates: ['message', 'callback_query', 'chat_member'] })
  }

  onText(regex, handler) {
    this.handlers.push({ regex, handler })
  }

  on(event, handler) {
    if (event === 'callback_query') this.cbHandlers.push(handler)
    if (event === 'chat_member') this.chatMemberHandlers.push(handler)
  }

  async startPolling() {
    this.polling = true
    console.log('[bot] Long-polling started')
    while (this.polling) {
      try {
        const r = await this.getUpdates(this.offset)
        if (r.ok && r.result && r.result.length > 0) {
          for (const update of r.result) {
            this.offset = update.update_id + 1
            try {
              if (update.message) {
                const text = update.message.text || ''
                for (const { regex, handler } of this.handlers) {
                  const match = text.match(regex)
                  if (match) { await handler(update.message, match); break }
                }
              }
              if (update.callback_query) {
                for (const h of this.cbHandlers) await h(update.callback_query)
              }
              if (update.chat_member) {
                for (const h of this.chatMemberHandlers) await h(update.chat_member)
              }
            } catch (e) {
              console.error('[bot] Handler error:', e.message)
            }
          }
        }
      } catch (e) {
        if (this.polling) {
          console.error('[bot] Poll error:', e.message)
          await new Promise(r => setTimeout(r, 5000))
        }
      }
    }
  }

  stop() { this.polling = false }
}
