import { TelegramBot } from './telegram.js'
import http from 'http'
const PANEL_API = process.env.PANEL_API || 'http://127.0.0.1:9092'

// ─── Panel API client ─────────────────────────────────────────────────────────
function apiCall(path, opts = {}) {
  return new Promise((resolve) => {
    const url = new URL(PANEL_API + '/bot' + path)
    const body = opts.body || null
    const method = opts.method || 'GET'
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + (url.search || ''),
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    }
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body)
    const req = http.request(options, res => {
      let data = ''
      res.on('data', d => { data += d })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve(null) }
      })
    })
    req.on('error', () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
    if (body) req.write(body)
    req.end()
  })
}

function api(path, opts = {}) {
  const newOpts = { ...opts }
  if (opts.body && typeof opts.body !== 'string') newOpts.body = JSON.stringify(opts.body)
  return apiCall(path, newOpts)
}

// ─── HTML escape ──────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function loadToken() {
  if (process.env.BOT_TOKEN) return process.env.BOT_TOKEN
  const s = await api('/settings').catch(() => null)
  return s?.bot_token && s.bot_token !== '***' ? s.bot_token : ''
}

async function getSettings() {
  const s = await api('/settings').catch(() => ({}))
  if (process.env.BOT_TOKEN && s && !s.bot_token) s.bot_token = process.env.BOT_TOKEN
  return s || {}
}

async function getPlans() {
  const plans = await api('/plans')
  return (Array.isArray(plans) ? plans : []).filter(p => p.enabled)
}

async function getOrCreateUser(from) {
  const { id, first_name, last_name, username } = from
  let user = await api(`/users/${id}`)
  if (!user || user.error) {
    user = await api(`/users/${id}`, {
      method: 'PATCH',
      body: { telegram_id: id, first_name: first_name || '', last_name: last_name || '', username: username || '', balance: 0, referral_count: 0 }
    })
  }
  return user || {}
}

async function getProxyLinks(telegramId) {
  const result = await api(`/users/${telegramId}/links`)
  return result?.links || []
}

// Returns true if user is subscribed (or channel not configured)
async function isSubscribedToChannel(bot, userId, channelUsername) {
  if (!channelUsername) return true
  const chatId = channelUsername.startsWith('@') ? channelUsername : `@${channelUsername}`
  try {
    const r = await bot.getChatMember(chatId, userId)
    if (!r || !r.ok) return false
    const status = r.result?.status
    return ['member', 'administrator', 'creator'].includes(status)
  } catch { return false }
}

function buildLinksKeyboard(links) {
  if (!links || links.length === 0) return []
  return links.map((link, i) => [{ text: `⚡️ Подключить${links.length > 1 ? ` · Сервер ${i + 1}` : ''}`, url: link }])
}

function mergeKeyboard(linkRows, actionRows) {
  return { inline_keyboard: [...linkRows, ...actionRows] }
}

async function handleReferral(userId, referrerId) {
  if (!referrerId || referrerId === userId) return
  const refUser = await api(`/users/${referrerId}`)
  if (!refUser || refUser.error) return
  const settings = await getSettings()
  const bonusDays = settings.ref_bonus_days || 3
  await api(`/users/${referrerId}`, {
    method: 'PATCH',
    body: { referral_count: (refUser.referral_count || 0) + 1 }
  })
  const now = Date.now()
  if (refUser.subscription_until && refUser.subscription_until > now) {
    await api(`/users/${referrerId}`, {
      method: 'PATCH',
      body: { subscription_until: refUser.subscription_until + bonusDays * 86400000 }
    })
  }
}

// ─── Keyboards ────────────────────────────────────────────────────────────────
function mainMenuInlineKeyboard(lang = 'ru') {
  if (lang === 'en') {
    return {
      inline_keyboard: [
        [{ text: '🛡 Trial access', callback_data: 'trial' }, { text: '💳 Buy access', callback_data: 'show_plans' }],
        [{ text: '🔑 My access', callback_data: 'my_access' }, { text: '👤 Profile', callback_data: 'profile' }],
        [{ text: '💬 Support', callback_data: 'support' }, { text: '📖 About', callback_data: 'about' }],
        [{ text: '👥 Referral program', callback_data: 'referral' }, { text: '💰 Top up balance', callback_data: 'topup' }],
        [{ text: '🌐 Русский', callback_data: 'lang_ru' }],
      ]
    }
  }
  return {
    inline_keyboard: [
      [{ text: '🛡 Тестовый доступ', callback_data: 'trial' }, { text: '💳 Купить доступ', callback_data: 'show_plans' }],
      [{ text: '🔑 Мой доступ', callback_data: 'my_access' }, { text: '👤 Профиль', callback_data: 'profile' }],
      [{ text: '💬 Поддержка', callback_data: 'support' }, { text: '📖 О нас', callback_data: 'about' }],
      [{ text: '👥 Реферальная программа', callback_data: 'referral' }, { text: '💰 Пополнить баланс', callback_data: 'topup' }],
      [{ text: '🌐 English', callback_data: 'lang_en' }],
    ]
  }
}

function plansKeyboard(plans) {
  const rows = plans.map(p => [{ text: `💎 ${p.label} — ${p.price} ₽`, callback_data: `buy_${p.id}` }])
  rows.push([{ text: '🏠 Главное меню', callback_data: 'main_menu' }])
  return { inline_keyboard: rows }
}

function backKeyboard(cb = 'main_menu', label = '← Назад') {
  return { inline_keyboard: [[{ text: label, callback_data: cb }]] }
}

function backKeyboardL(lang, cb = 'main_menu') {
  const label = lang === 'en' ? '← Back' : '← Назад'
  return { inline_keyboard: [[{ text: label, callback_data: cb }]] }
}

// ─── User language preference (in-memory) ────────────────────────────────────
const userLang = new Map() // userId → 'ru' | 'en'
function getLang(userId) { return userLang.get(userId) || 'ru' }

// ─── Message tracking: edit first, send if needed ────────────────────────────
const lastMsg = new Map()
const pendingTrial = new Map()

async function showScreen(bot, chatId, userId, text, opts = {}) {
  const hasInline = !!opts.reply_markup?.inline_keyboard
  const prev = lastMsg.get(userId)

  if (prev && hasInline) {
    const r = await bot.editMessageText(prev.chatId, prev.msgId, text, opts)
    if (r && r.ok) return r.result
  }

  const r = await bot.sendMessage(chatId, text, opts)
  if (r && r.ok && r.result) {
    lastMsg.set(userId, { chatId, msgId: r.result.message_id })
  }
  return r?.result
}

async function editScreen(bot, query, text, opts = {}) {
  const chatId = query.message.chat.id
  const msgId = query.message.message_id
  const userId = query.from.id

  try {
    const r = await bot.editMessageText(chatId, msgId, text, opts)
    if (r && r.ok) {
      lastMsg.set(userId, { chatId, msgId })
      return r.result
    }
    console.warn(`[bot] editMessageText failed: ${JSON.stringify(r?.description || r)}`)
  } catch (e) {
    console.warn('[bot] editMessageText error:', e.message)
  }

  try {
    const sent = await bot.sendMessage(chatId, text, opts)
    if (sent && sent.ok && sent.result) {
      lastMsg.set(userId, { chatId, msgId: sent.result.message_id })
      return sent.result
    }
  } catch (e) {
    console.error('[bot] sendMessage fallback error:', e.message)
  }
}

// ─── Screen builders ──────────────────────────────────────────────────────────
function buildMainMenuText(settings, lang = 'ru') {
  const name = esc(settings.bot_name || 'Telemt Proxy')
  const welcome = esc(settings.welcome_text || 'Быстрый и надёжный MTProxy')
  const features = settings.features || ''

  let text = `⚡️ <b>${name}</b>\n`
  text += `<i>${welcome}</i>\n`

  if (features) {
    const lines = features.split('\n').filter(Boolean)
    const formatted = lines.map(l => {
      const m = l.match(/^[-–—•*]\s*(.+)/)
      if (m) {
        const parts = m[1].split(' - ')
        if (parts.length >= 2) return `— <b>${esc(parts[0].trim())}</b> · ${esc(parts.slice(1).join(' - ').trim())}`
        return `— ${esc(m[1])}`
      }
      return esc(l)
    }).join('\n')
    text += `\n<blockquote>${formatted}</blockquote>\n`
  }

  text += lang === 'en' ? `\nChoose an action:` : `\nВыберите нужное действие:`
  return text
}

function buildAccessText(until, daysLeft, hasLinks) {
  const badge = daysLeft <= 3 ? '🔴' : daysLeft <= 7 ? '🟡' : '🟢'
  let text = `🔑 <b>Ваш доступ</b>\n\n`
  text += `${badge} Активен до: <b>${until}</b>\n`
  text += `⏳ Осталось: <b>${daysLeft} дн.</b>\n`
  if (hasLinks) text += `\n<i>Нажмите кнопку ниже для подключения к прокси:</i>`
  return text
}

// ─── Bot startup ──────────────────────────────────────────────────────────────
async function startBot() {
  const token = await loadToken()
  if (!token) {
    console.log('[bot] Токен не настроен. Добавьте токен в Панель → Бот → Настройки.')
    setTimeout(startBot, 30000)
    return
  }

  console.log('[bot] Запускаем Telegram бот...')
  const bot = new TelegramBot(token)

  const me = await bot.getMe()
  if (!me) {
    console.log('[bot] Ошибка: неверный токен или нет соединения с Telegram.')
    setTimeout(startBot, 60000)
    return
  }
  console.log(`[bot] Бот @${me.username} запущен!`)

  // ── /start ──────────────────────────────────────────────────────────────────
  bot.onText(/\/start(.*)/, async (msg, match) => {
    const refParam = (match[1] || '').trim()
    const referrerId = refParam ? Number(refParam) : null
    const user = await getOrCreateUser(msg.from)
    if (referrerId && !user.referred_by) {
      await api(`/users/${msg.from.id}`, { method: 'PATCH', body: { referred_by: referrerId } })
      await handleReferral(msg.from.id, referrerId)
    }
    const s = await getSettings()
    const lang = getLang(msg.from.id)
    const text = buildMainMenuText(s, lang)
    const r = await bot.sendMessage(msg.chat.id, text, {
      parse_mode: 'HTML',
      reply_markup: mainMenuInlineKeyboard(lang)
    })
    if (r?.ok && r?.result) {
      lastMsg.set(msg.from.id, { chatId: msg.chat.id, msgId: r.result.message_id })
    }
  })

  // ── Callback queries ─────────────────────────────────────────────────────────
  bot.on('callback_query', async (query) => {
    const userId = query.from.id
    const data = query.data
    await bot.answerCallbackQuery(query.id)

    // ── Переключение языка ────────────────────────────────────────────────────
    if (data === 'lang_en' || data === 'lang_ru') {
      const lang = data === 'lang_en' ? 'en' : 'ru'
      userLang.set(userId, lang)
      const s = await getSettings()
      await editScreen(bot, query, buildMainMenuText(s, lang), {
        parse_mode: 'HTML',
        reply_markup: mainMenuInlineKeyboard(lang)
      })
      return
    }

    // ── Главное меню ──────────────────────────────────────────────────────────
    if (data === 'main_menu') {
      const lang = getLang(userId)
      const s = await getSettings()
      await editScreen(bot, query, buildMainMenuText(s, lang), {
        parse_mode: 'HTML',
        reply_markup: mainMenuInlineKeyboard(lang)
      })
      return
    }

    // ── Тарифы ───────────────────────────────────────────────────────────────
    if (data === 'show_plans') {
      const plans = await getPlans()
      if (!plans.length) {
        await editScreen(bot, query,
          '⚠️ <b>Тарифы не настроены</b>\n\n<i>Обратитесь к администратору.</i>',
          { parse_mode: 'HTML', reply_markup: backKeyboard() }
        )
        return
      }
      const s = await getSettings()
      const name = esc(s.bot_name || 'Proxy')
      await editScreen(bot, query,
        `💎 <b>${name}</b>\n\n<i>Выберите подходящий тарифный план:</i>`,
        { parse_mode: 'HTML', reply_markup: plansKeyboard(plans) }
      )
      return
    }

    // ── Тестовый доступ / проверка подписки ──────────────────────────────────
    if (data === 'trial' || data === 'check_sub') {
      const user = await getOrCreateUser(query.from)
      const s = await getSettings()
      const trialDays = s.trial_days || 1
      const channel = (s.required_channel || '').trim().replace(/^@/, '')

      if (user.trial_used) {
        await editScreen(bot, query,
          '⚠️ <b>Тестовый период уже использован</b>\n\n<i>Оформите подписку, чтобы продолжить:</i>',
          {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [
              [{ text: '💳 Купить доступ', callback_data: 'show_plans' }],
              [{ text: '← Назад', callback_data: 'main_menu' }]
            ]}
          }
        )
        return
      }

      if (channel) {
        const subscribed = await isSubscribedToChannel(bot, userId, channel)
        if (!subscribed) {
          await editScreen(bot, query,
            `📢 <b>Подпишитесь на канал</b>\n\n<i>Для получения тестового доступа необходимо подписаться на наш канал.</i>\n\nПосле подписки нажмите <b>«✅ Я подписался»</b> — доступ выдастся автоматически.\n\n⏱ Тест: <b>${trialDays} дн.</b>`,
            {
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: [
                [{ text: `🔔 Подписаться на @${channel}`, url: `https://t.me/${channel}` }],
                [{ text: '✅ Я подписался', callback_data: 'check_sub' }],
                [{ text: '← Назад', callback_data: 'main_menu' }]
              ]}
            }
          )
          pendingTrial.set(userId, { chatId: query.message.chat.id, msgId: query.message.message_id })
          return
        }
        pendingTrial.delete(userId)
      }

      const result = await api(`/users/${userId}/trial`, { method: 'POST', body: {} })
      if (!result || result.error) {
        const errMsg = result?.error || 'Неизвестная ошибка'
        const isUsed = errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('trial')
        await editScreen(bot, query,
          isUsed
            ? '⚠️ <b>Тестовый период уже использован</b>\n\n<i>Оформите подписку:</i>'
            : `❌ <b>Ошибка</b>\n\n<i>${esc(errMsg)}</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [
              [{ text: '💳 Купить доступ', callback_data: 'show_plans' }],
              [{ text: '← Назад', callback_data: 'main_menu' }]
            ]}
          }
        )
        return
      }

      const links = await getProxyLinks(userId)
      const linkRows = buildLinksKeyboard(links)
      await editScreen(bot, query,
        links.length > 0
          ? `✅ <b>Тестовый доступ активирован!</b>\n\n📅 Срок: <b>${trialDays} дн.</b>\n\n<i>Нажмите кнопку ниже для подключения к прокси:</i>`
          : `✅ <b>Тестовый доступ активирован!</b>\n\n📅 Срок: <b>${trialDays} дн.</b>\n\n<i>Ссылки для подключения появятся после настройки нод.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: mergeKeyboard(linkRows, [[{ text: '🏠 Главное меню', callback_data: 'main_menu' }]])
        }
      )
      return
    }

    // ── Мой доступ ────────────────────────────────────────────────────────────
    if (data === 'my_access') {
      const user = await getOrCreateUser(query.from)
      const now = Date.now()
      const active = user.subscription_until && user.subscription_until > now
      if (!active) {
        await editScreen(bot, query,
          '🔒 <b>Нет активного доступа</b>\n\n<i>Оформите подписку или активируйте тестовый период.</i>',
          {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [
              [{ text: '🛡 Тестовый доступ', callback_data: 'trial' }, { text: '💳 Купить', callback_data: 'show_plans' }],
              [{ text: '← Назад', callback_data: 'main_menu' }]
            ]}
          }
        )
        return
      }
      const links = await getProxyLinks(userId)
      const linkRows = buildLinksKeyboard(links)
      const until = new Date(user.subscription_until).toLocaleDateString('ru-RU')
      const daysLeft = Math.ceil((user.subscription_until - now) / 86400000)
      await editScreen(bot, query,
        buildAccessText(until, daysLeft, links.length > 0),
        {
          parse_mode: 'HTML',
          reply_markup: mergeKeyboard(linkRows, [
            [{ text: '🔄 Продлить', callback_data: 'show_plans' }],
            [{ text: '← Назад', callback_data: 'main_menu' }]
          ])
        }
      )
      return
    }

    // ── Профиль ───────────────────────────────────────────────────────────────
    if (data === 'profile') {
      const user = await getOrCreateUser(query.from)
      const now = Date.now()
      const active = user.subscription_until && user.subscription_until > now
      const reg = user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : '—'
      const name = esc([query.from.first_name, query.from.last_name].filter(Boolean).join(' ') || '—')
      let text = `👤 <b>Профиль</b>\n\n`
      text += `<b>ID:</b> <code>${userId}</code>\n`
      if (query.from.username) text += `<b>Username:</b> @${esc(query.from.username)}\n`
      text += `<b>Имя:</b> ${name}\n`
      text += `<b>Регистрация:</b> ${reg}\n\n`
      text += `<b>Доступ:</b> ${active ? '🟢 Активен' : '🔴 Не активен'}\n`
      text += `<b>Рефералов:</b> ${user.referral_count || 0}\n`
      text += `<b>Баланс:</b> ${(user.balance || 0).toFixed(2)} ₽`
      await editScreen(bot, query, text, {
        parse_mode: 'HTML',
        reply_markup: backKeyboard()
      })
      return
    }

    // ── Реферальная программа ─────────────────────────────────────────────────
    if (data === 'referral') {
      const user = await getOrCreateUser(query.from)
      const s = await getSettings()
      const bonusDays = s.ref_bonus_days || 3
      const refLink = `https://t.me/${me.username}?start=${userId}`
      let text = `👥 <b>Реферальная программа</b>\n\n`
      text += `🎁 За каждого приглашённого: <b>+${bonusDays} дн.</b>\n`
      text += `👤 Ваших рефералов: <b>${user.referral_count || 0}</b>\n\n`
      text += `🔗 <b>Ваша ссылка:</b>\n<code>${refLink}</code>`
      await editScreen(bot, query, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [
          [{ text: '📤 Поделиться', url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('Быстрый MTProxy для Telegram!')}` }],
          [{ text: '← Назад', callback_data: 'main_menu' }]
        ]}
      })
      return
    }

    // ── О нас ─────────────────────────────────────────────────────────────────
    if (data === 'about') {
      const s = await getSettings()
      const aboutText = esc(s.about_text || 'Надёжный MTProxy для Telegram.')
      await editScreen(bot, query,
        `📖 <b>О нас</b>\n\n${aboutText}`,
        { parse_mode: 'HTML', reply_markup: backKeyboard() }
      )
      return
    }

    // ── Поддержка ─────────────────────────────────────────────────────────────
    if (data === 'support') {
      const s = await getSettings()
      const link = s.support_link || ''
      let text = `💬 <b>Поддержка</b>\n\n`
      text += link
        ? `Свяжитесь с нами: ${esc(link)}`
        : `<i>Обратитесь к администратору бота.</i>`
      await editScreen(bot, query, text, {
        parse_mode: 'HTML',
        reply_markup: link
          ? { inline_keyboard: [[{ text: '✉️ Написать', url: link }], [{ text: '← Назад', callback_data: 'main_menu' }]] }
          : backKeyboard()
      })
      return
    }

    // ── Пополнить баланс ──────────────────────────────────────────────────────
    if (data === 'topup') {
      await editScreen(bot, query,
        '💰 <b>Пополнение баланса</b>\n\n<i>Способ оплаты будет настроен позже.\nОбратитесь к администратору.</i>',
        { parse_mode: 'HTML', reply_markup: backKeyboard() }
      )
      return
    }

    // ── Покупка тарифа ────────────────────────────────────────────────────────
    if (data.startsWith('buy_')) {
      const planId = data.replace('buy_', '')
      const plans = await getPlans()
      const plan = plans.find(p => p.id === planId)
      if (!plan) {
        await editScreen(bot, query, '❌ <b>Тариф не найден.</b>', {
          parse_mode: 'HTML',
          reply_markup: backKeyboard('show_plans', '← К тарифам')
        })
        return
      }
      await editScreen(bot, query,
        `💳 <b>Оформление подписки</b>\n\n📋 Тариф: <b>${esc(plan.label)}</b>\n💰 Сумма: <b>${plan.price} ₽</b>\n\n<i>Способ оплаты будет добавлен позже.\nОбратитесь к администратору.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [
            [{ text: '← К тарифам', callback_data: 'show_plans' }],
            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
          ]}
        }
      )
      return
    }
  })

  // ── chat_member: auto-grant trial when user joins the required channel ────────
  bot.on('chat_member', async (update) => {
    try {
      const newStatus = update.new_chat_member?.status
      const oldStatus = update.old_chat_member?.status
      const user = update.new_chat_member?.user
      if (!user || user.is_bot) return

      const joined = ['member', 'administrator', 'creator'].includes(newStatus) &&
        !['member', 'administrator', 'creator'].includes(oldStatus)
      if (!joined) return

      const userId = user.id
      if (!pendingTrial.has(userId)) return

      const { chatId, msgId } = pendingTrial.get(userId)
      pendingTrial.delete(userId)

      const s = await getSettings()
      const trialDays = s.trial_days || 1

      const result = await api(`/users/${userId}/trial`, { method: 'POST', body: {} })
      if (!result || result.error) {
        const errMsg = result?.error || 'Ошибка'
        const isUsed = errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('trial')
        await bot.editMessageText(chatId, msgId,
          isUsed
            ? '⚠️ <b>Тестовый период уже использован</b>\n\n<i>Оформите подписку:</i>'
            : `❌ <b>Ошибка</b>\n\n<i>${esc(errMsg)}</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [
              [{ text: '💳 Купить доступ', callback_data: 'show_plans' }],
              [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
            ]}
          }
        )
        return
      }

      const links = await getProxyLinks(userId)
      const linkRows = buildLinksKeyboard(links)
      await bot.editMessageText(chatId, msgId,
        links.length > 0
          ? `✅ <b>Тестовый доступ активирован!</b>\n\n📅 Срок: <b>${trialDays} дн.</b>\n\n<i>Нажмите кнопку ниже для подключения:</i>`
          : `✅ <b>Тестовый доступ активирован!</b>\n\n📅 Срок: <b>${trialDays} дн.</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: mergeKeyboard(linkRows, [[{ text: '🏠 Главное меню', callback_data: 'main_menu' }]])
        }
      )
    } catch (e) {
      console.error('[bot] chat_member handler error:', e.message)
    }
  })

  bot.startPolling()
}

startBot()
