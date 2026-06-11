import { TelegramBot } from './telegram.js'
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import http from 'http'

const __dirname = dirname(fileURLToPath(import.meta.url))
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadToken() {
  const settingsFile = join(__dirname, '../panel/server/bot-settings.json')
  if (!existsSync(settingsFile)) return ''
  try {
    const s = JSON.parse(readFileSync(settingsFile, 'utf8'))
    return s.bot_token || ''
  } catch { return '' }
}

async function getSettings() {
  const f = join(__dirname, '../panel/server/bot-settings.json')
  if (!existsSync(f)) return {}
  try { return JSON.parse(readFileSync(f, 'utf8')) } catch { return {} }
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

function buildLinksKeyboard(links) {
  if (!links || links.length === 0) return []
  return links.map((link, i) => [{ text: `🔌 Подключить (сервер ${i + 1})`, url: link }])
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
function mainMenuInlineKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🔑 Тестовый доступ', callback_data: 'trial' }, { text: '💳 Купить доступ', callback_data: 'show_plans' }],
      [{ text: '🔐 Мой доступ', callback_data: 'my_access' }, { text: '👤 Профиль', callback_data: 'profile' }],
      [{ text: '💬 Поддержка', callback_data: 'support' }, { text: '📖 О нас', callback_data: 'about' }],
      [{ text: '👥 Рефералы', callback_data: 'referral' }, { text: '💰 Пополнить баланс', callback_data: 'topup' }],
    ]
  }
}

function plansKeyboard(plans) {
  const rows = plans.map(p => [{ text: `📅 ${p.label} — ${p.price} ₽`, callback_data: `buy_${p.id}` }])
  rows.push([{ text: '🏠 Главное меню', callback_data: 'main_menu' }])
  return { inline_keyboard: rows }
}

// ─── Message tracking: edit first, send if needed ────────────────────────────
// userId → { chatId, msgId }
const lastMsg = new Map()

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

// For callback queries: always edit in-place
async function editScreen(bot, query, text, opts = {}) {
  const chatId = query.message.chat.id
  const msgId = query.message.message_id
  const userId = query.from.id

  const r = await bot.editMessageText(chatId, msgId, text, opts)
  if (r && r.ok) {
    lastMsg.set(userId, { chatId, msgId })
  }
}

// ─── Screen builders ──────────────────────────────────────────────────────────
async function buildMainMenuText(settings) {
  const name = settings.bot_name || 'Telemt Proxy'
  const welcome = settings.welcome_text || 'Быстрый и надёжный MTProxy'
  const features = settings.features || ''
  return `🚀 *${name}* — ${welcome}\n\n${features ? features + '\n\n' : ''}Выберите нужное действие:`
}

async function buildAccessScreen(userId, subscriptionUntil) {
  const now = Date.now()
  const links = await getProxyLinks(userId)
  const linkRows = buildLinksKeyboard(links)

  const until = new Date(subscriptionUntil).toLocaleDateString('ru-RU')
  const daysLeft = Math.ceil((subscriptionUntil - now) / 86400000)

  const text = links.length > 0
    ? `🔐 *Ваш доступ*\n\n📅 Активен до: *${until}*\n⏳ Осталось: *${daysLeft} дн.*\n\n🔌 Нажмите кнопку для подключения:`
    : `🔐 *Ваш доступ*\n\n📅 Активен до: *${until}*\n⏳ Осталось: *${daysLeft} дн.*`

  return {
    text,
    reply_markup: mergeKeyboard(linkRows, [
      [{ text: '🔄 Продлить', callback_data: 'show_plans' }],
      [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
    ])
  }
}

// ─── Bot startup ──────────────────────────────────────────────────────────────
async function startBot() {
  const token = loadToken()
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
    const text = await buildMainMenuText(s)
    // Remove any old reply keyboard, send single inline message
    await bot.sendMessage(msg.chat.id, '⠀', {
      reply_markup: { remove_keyboard: true }
    }).catch(() => {})
    const r = await bot.sendMessage(msg.chat.id, text, {
      parse_mode: 'Markdown',
      reply_markup: mainMenuInlineKeyboard()
    })
    if (r?.ok && r?.result) {
      lastMsg.set(msg.from.id, { chatId: msg.chat.id, msgId: r.result.message_id })
    }
  })

  // ── Callback queries (все редактируют существующее сообщение) ────────────────
  bot.on('callback_query', async (query) => {
    const msg = query.message
    const userId = query.from.id
    const data = query.data
    await bot.answerCallbackQuery(query.id)

    if (data === 'main_menu') {
      const s = await getSettings()
      const text = await buildMainMenuText(s)
      await editScreen(bot, query, text, { parse_mode: 'Markdown', reply_markup: mainMenuInlineKeyboard() })
      return
    }

    if (data === 'show_plans') {
      const plans = await getPlans()
      if (!plans.length) {
        await editScreen(bot, query, '❌ Тарифы не настроены.', {
          reply_markup: { inline_keyboard: [[{ text: '↩️ Назад', callback_data: 'main_menu' }]] }
        })
        return
      }
      const s = await getSettings()
      await editScreen(bot, query,
        `📦 *${s.bot_name || 'Proxy'}*\n\nВыбери срок подписки:`,
        { parse_mode: 'Markdown', reply_markup: plansKeyboard(plans) }
      )
      return
    }

    if (data === 'trial') {
      await getOrCreateUser(query.from)
      const s = await getSettings()
      const trialDays = s.trial_days || 1
      const result = await api(`/users/${userId}/trial`, { method: 'POST', body: {} })
      if (!result || result.error) {
        const errMsg = result?.error || 'Ошибка'
        const isUsed = errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('trial')
        await editScreen(bot, query,
          isUsed ? '⚠️ *Тестовый период уже использован*\n\nОформите подписку:' : `❌ Ошибка: ${errMsg}`,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [
              [{ text: '💳 Купить доступ', callback_data: 'show_plans' }],
              [{ text: '↩️ Назад', callback_data: 'main_menu' }]
            ]}
          }
        )
        return
      }
      const links = await getProxyLinks(userId)
      const linkRows = buildLinksKeyboard(links)
      await editScreen(bot, query,
        links.length > 0
          ? `✅ *Тестовый доступ активирован!*\nСрок: ${trialDays} дн.\n\n🔌 Нажмите кнопку для подключения:`
          : `✅ *Тестовый доступ активирован!*\nСрок: ${trialDays} дн.`,
        {
          parse_mode: 'Markdown',
          reply_markup: mergeKeyboard(linkRows, [[{ text: '🏠 Главное меню', callback_data: 'main_menu' }]])
        }
      )
      return
    }

    if (data === 'my_access') {
      const user = await getOrCreateUser(query.from)
      const now = Date.now()
      const active = user.subscription_until && user.subscription_until > now
      if (!active) {
        await editScreen(bot, query,
          '❌ *Нет активного доступа*\n\nОформите подписку или активируйте тестовый период.',
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [
              [{ text: '🔑 Тестовый доступ', callback_data: 'trial' }, { text: '💳 Купить', callback_data: 'show_plans' }],
              [{ text: '↩️ Назад', callback_data: 'main_menu' }]
            ]}
          }
        )
        return
      }
      const screen = await buildAccessScreen(userId, user.subscription_until)
      await editScreen(bot, query, screen.text, { parse_mode: 'Markdown', reply_markup: screen.reply_markup })
      return
    }

    if (data === 'profile') {
      const user = await getOrCreateUser(query.from)
      const now = Date.now()
      const active = user.subscription_until && user.subscription_until > now
      const reg = user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : '—'
      let text = `👤 *Твой профиль*\n\n`
      text += `🆔 ID: \`${userId}\`\n`
      if (query.from.username) text += `👤 Username: @${query.from.username}\n`
      text += `📝 Имя: ${query.from.first_name || '—'}\n`
      text += `📅 Регистрация: ${reg}\n\n`
      text += `🔑 Доступ: ${active ? '✅ Активен' : '❌ Нет'}\n`
      text += `👥 Рефералов: ${user.referral_count || 0}\n`
      text += `💰 Баланс: ${(user.balance || 0).toFixed(2)} RUB`
      await editScreen(bot, query, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '↩️ Назад', callback_data: 'main_menu' }]] }
      })
      return
    }

    if (data === 'referral') {
      const user = await getOrCreateUser(query.from)
      const s = await getSettings()
      const bonusDays = s.ref_bonus_days || 3
      const refLink = `https://t.me/${me.username}?start=${userId}`
      let text = `👥 *Реферальная программа*\n\n`
      text += `🎁 За каждого приглашённого: *+${bonusDays} дн.*\n`
      text += `👤 Ваших рефералов: *${user.referral_count || 0}*\n\n`
      text += `🔗 Ваша ссылка:\n\`${refLink}\``
      await editScreen(bot, query, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
          [{ text: '📤 Поделиться', url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('Быстрый MTProxy для Telegram!')}` }],
          [{ text: '↩️ Назад', callback_data: 'main_menu' }]
        ]}
      })
      return
    }

    if (data === 'about') {
      const s = await getSettings()
      await editScreen(bot, query,
        `📖 *О нас*\n\n${s.about_text || 'Надёжный MTProxy для Telegram.'}`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '↩️ Назад', callback_data: 'main_menu' }]] }
        }
      )
      return
    }

    if (data === 'support') {
      const s = await getSettings()
      const link = s.support_link || ''
      const text = link ? `💬 *Поддержка*\n\nСвяжитесь с нами: ${link}` : '💬 *Поддержка*\n\nОбратитесь к администратору бота.'
      await editScreen(bot, query, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '↩️ Назад', callback_data: 'main_menu' }]] }
      })
      return
    }

    if (data === 'topup') {
      await editScreen(bot, query,
        '💰 *Пополнение баланса*\n\nСпособ оплаты будет настроен позже. Обратитесь к администратору.',
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '↩️ Назад', callback_data: 'main_menu' }]] }
        }
      )
      return
    }

    if (data.startsWith('buy_')) {
      const planId = data.replace('buy_', '')
      const plans = await getPlans()
      const plan = plans.find(p => p.id === planId)
      if (!plan) {
        await editScreen(bot, query, '❌ Тариф не найден.', {
          reply_markup: { inline_keyboard: [[{ text: '↩️ Назад', callback_data: 'show_plans' }]] }
        })
        return
      }
      await editScreen(bot, query,
        `💳 *Оплата подписки*\n\n📋 Тариф: *${plan.label}*\n💰 Сумма: *${plan.price} ₽*\n\n⚙️ Способ оплаты будет добавлен позже.\nОбратитесь к администратору.`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [
            [{ text: '↩️ К тарифам', callback_data: 'show_plans' }],
            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
          ]}
        }
      )
      return
    }
  })

  bot.startPolling()
}

startBot()
