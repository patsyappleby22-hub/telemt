import { TelegramBot } from './telegram.js'
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import http from 'http'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PANEL_API = process.env.PANEL_API || 'http://127.0.0.1:9092'

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

function loadToken() {
  const settingsFile = join(__dirname, '../panel/server/bot-settings.json')
  if (!existsSync(settingsFile)) return ''
  try {
    const s = JSON.parse(readFileSync(settingsFile, 'utf8'))
    return s.bot_token || ''
  } catch { return '' }
}

async function getSettings() {
  const settingsFile = join(__dirname, '../panel/server/bot-settings.json')
  if (!existsSync(settingsFile)) return {}
  try { return JSON.parse(readFileSync(settingsFile, 'utf8')) } catch { return {} }
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

// Fetch ready-to-use proxy links from all nodes for a user
async function getProxyLinks(telegramId) {
  const result = await api(`/users/${telegramId}/links`)
  return result?.links || []
}

// Build inline keyboard rows from proxy links (each link = button)
function buildLinksKeyboard(links) {
  if (!links || links.length === 0) return []
  return links.map((link, i) => [{ text: `🔌 Подключить (сервер ${i + 1})`, url: link }])
}

// Merge link buttons with action buttons into one inline_keyboard
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

function mainMenuKeyboard() {
  return {
    keyboard: [
      [{ text: '🔑 Тестовый доступ' }, { text: '💳 Купить доступ' }],
      [{ text: '🔐 Мой доступ' }, { text: '👤 Профиль' }],
      [{ text: '💬 Поддержка' }, { text: '📖 О нас' }],
      [{ text: '👥 Реферальная программа' }, { text: '💰 Пополнить баланс' }],
    ],
    resize_keyboard: true,
  }
}

function backKeyboard() {
  return { keyboard: [[{ text: '🏠 Главное меню' }]], resize_keyboard: true }
}

function plansKeyboard(plans) {
  const rows = plans.map(p => [{ text: `📅 ${p.label} — ${p.price} ₽`, callback_data: `buy_${p.id}` }])
  rows.push([{ text: '↩️ Назад', callback_data: 'main_menu' }])
  return { inline_keyboard: rows }
}

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

  async function sendMainMenu(chatId) {
    const s = await getSettings()
    const name = s.bot_name || 'Telemt Proxy'
    const welcome = s.welcome_text || 'Быстрый и надёжный MTProxy'
    const features = s.features || ''
    const text = `🚀 *${name}* — ${welcome}\n\n${features ? features + '\n\n' : ''}Выберите нужное действие:`
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() })
  }

  // /start
  bot.onText(/\/start(.*)/, async (msg, match) => {
    const refParam = (match[1] || '').trim()
    const referrerId = refParam ? Number(refParam) : null
    const user = await getOrCreateUser(msg.from)
    if (referrerId && !user.referred_by) {
      await api(`/users/${msg.from.id}`, { method: 'PATCH', body: { referred_by: referrerId } })
      await handleReferral(msg.from.id, referrerId)
    }
    await sendMainMenu(msg.chat.id)
  })

  // Купить доступ
  bot.onText(/💳 Купить доступ/, async (msg) => {
    const plans = await getPlans()
    if (!plans.length) return bot.sendMessage(msg.chat.id, '❌ Тарифы не настроены. Обратитесь к администратору.')
    const s = await getSettings()
    const name = s.bot_name || 'Proxy'
    await bot.sendMessage(msg.chat.id,
      `📦 *${name}*\n\nВыбери срок подписки:`,
      { parse_mode: 'Markdown', reply_markup: plansKeyboard(plans) }
    )
  })

  // Тестовый доступ
  bot.onText(/🔑 Тестовый доступ/, async (msg) => {
    const userId = msg.from.id
    await getOrCreateUser(msg.from)
    const s = await getSettings()
    const trialDays = s.trial_days || 1

    const result = await api(`/users/${userId}/trial`, { method: 'POST', body: {} })
    if (!result || result.error) {
      const errMsg = result?.error || 'Ошибка'
      if (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('trial')) {
        return bot.sendMessage(msg.chat.id,
          '⚠️ Вы уже использовали тестовый период.\n\nЧтобы продолжить — оформите подписку 👇',
          { reply_markup: { inline_keyboard: [[{ text: '💳 Купить доступ', callback_data: 'show_plans' }]] } }
        )
      }
      return bot.sendMessage(msg.chat.id, `❌ Ошибка: ${errMsg}`)
    }

    // Fetch proxy links from nodes
    const links = await getProxyLinks(userId)
    const linkRows = buildLinksKeyboard(links)

    const trialText = links.length > 0
      ? `✅ *Тестовый доступ активирован!*\n\nСрок: *${trialDays} ${trialDays === 1 ? 'день' : 'дней'}*\n\n🔌 Нажмите кнопку ниже, чтобы подключиться:`
      : `✅ *Тестовый доступ активирован!*\n\nСрок: *${trialDays} ${trialDays === 1 ? 'день' : 'дней'}*\n\n⏳ Ноды загружаются, зайдите в «Мой доступ» через минуту.`

    await bot.sendMessage(msg.chat.id, trialText, {
      parse_mode: 'Markdown',
      reply_markup: linkRows.length > 0
        ? mergeKeyboard(linkRows, [[{ text: '🏠 Главное меню', callback_data: 'main_menu' }]])
        : undefined
    })
    if (linkRows.length === 0) await bot.sendMessage(msg.chat.id, '🏠', { reply_markup: mainMenuKeyboard() }).catch(() => {})
  })

  // Мой доступ
  bot.onText(/🔐 Мой доступ/, async (msg) => {
    const userId = msg.from.id
    const user = await getOrCreateUser(msg.from)
    const now = Date.now()
    const active = user.subscription_until && user.subscription_until > now

    if (!active) {
      return bot.sendMessage(msg.chat.id,
        '❌ *У вас нет активного доступа*\n\nОформите подписку или активируйте тестовый период.',
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [
            [{ text: '🔑 Тестовый доступ', callback_data: 'trial' }, { text: '💳 Купить', callback_data: 'show_plans' }]
          ]}
        }
      )
    }

    const until = new Date(user.subscription_until).toLocaleDateString('ru-RU')
    const daysLeft = Math.ceil((user.subscription_until - now) / 86400000)

    // Fetch fresh proxy links from all nodes
    const links = await getProxyLinks(userId)
    const linkRows = buildLinksKeyboard(links)

    const accessText = links.length > 0
      ? `🔐 *Ваш доступ*\n\n📅 Активен до: *${until}*\n⏳ Осталось: *${daysLeft} дн.*\n\n🔌 Нажмите кнопку для подключения:`
      : `🔐 *Ваш доступ*\n\n📅 Активен до: *${until}*\n⏳ Осталось: *${daysLeft} дн.*`

    await bot.sendMessage(msg.chat.id, accessText, {
      parse_mode: 'Markdown',
      reply_markup: mergeKeyboard(linkRows, [
        [{ text: '🔄 Продлить', callback_data: 'show_plans' }],
        [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
      ])
    })
  })

  // Профиль
  bot.onText(/👤 Профиль/, async (msg) => {
    const user = await getOrCreateUser(msg.from)
    const now = Date.now()
    const active = user.subscription_until && user.subscription_until > now
    const reg = user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : '—'
    let text = `👤 *Твой профиль*\n\n`
    text += `🆔 ID: \`${msg.from.id}\`\n`
    if (msg.from.username) text += `👤 Username: @${msg.from.username}\n`
    text += `📝 Имя: ${msg.from.first_name || '—'}\n`
    text += `📅 Регистрация: ${reg}\n\n`
    text += `🔑 Доступ: ${active ? '✅ Активен' : '❌ Нет'}\n`
    text += `👥 Рефералов: ${user.referral_count || 0}\n`
    text += `💰 Баланс: ${(user.balance || 0).toFixed(2)} RUB`
    await bot.sendMessage(msg.chat.id, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🏠 Главное меню', callback_data: 'main_menu' }]] }
    })
  })

  // Поддержка
  bot.onText(/💬 Поддержка/, async (msg) => {
    const s = await getSettings()
    const link = s.support_link || ''
    const text = link ? `💬 *Поддержка*\n\nСвяжитесь с нами: ${link}` : '💬 *Поддержка*\n\nОбратитесь к администратору бота.'
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown', reply_markup: backKeyboard() })
  })

  // О нас
  bot.onText(/📖 О нас/, async (msg) => {
    const s = await getSettings()
    const about = s.about_text || 'Мы предоставляем надёжный MTProxy для Telegram.'
    await bot.sendMessage(msg.chat.id, `📖 *О нас*\n\n${about}`, { parse_mode: 'Markdown', reply_markup: backKeyboard() })
  })

  // Реферальная программа
  bot.onText(/👥 Реферальная программа/, async (msg) => {
    const user = await getOrCreateUser(msg.from)
    const s = await getSettings()
    const bonusDays = s.ref_bonus_days || 3
    const refLink = `https://t.me/${me.username}?start=${msg.from.id}`
    let text = `👥 *Реферальная программа*\n\n`
    text += `Приглашайте друзей и получайте бонусы!\n\n`
    text += `🎁 За каждого приглашённого: *+${bonusDays} дн.* к подписке\n`
    text += `👤 Ваших рефералов: *${user.referral_count || 0}*\n\n`
    text += `🔗 Ваша ссылка:\n\`${refLink}\``
    await bot.sendMessage(msg.chat.id, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [
        [{ text: '📤 Поделиться', url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('Быстрый MTProxy для Telegram!')}` }],
        [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
      ]}
    })
  })

  // Пополнить баланс
  bot.onText(/💰 Пополнить баланс/, async (msg) => {
    await bot.sendMessage(msg.chat.id,
      '💰 *Пополнение баланса*\n\nСпособ оплаты будет настроен позже. Обратитесь к администратору.',
      { parse_mode: 'Markdown', reply_markup: backKeyboard() }
    )
  })

  // Главное меню
  bot.onText(/🏠 Главное меню/, async (msg) => {
    await sendMainMenu(msg.chat.id)
  })

  // Callback queries
  bot.on('callback_query', async (query) => {
    const msg = query.message
    const userId = query.from.id
    const data = query.data
    await bot.answerCallbackQuery(query.id)

    if (data === 'main_menu') { await sendMainMenu(msg.chat.id); return }

    if (data === 'show_plans') {
      const plans = await getPlans()
      const s = await getSettings()
      await bot.sendMessage(msg.chat.id,
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
        if (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('trial')) {
          await bot.sendMessage(msg.chat.id, '⚠️ Вы уже использовали тестовый период.')
        } else {
          await bot.sendMessage(msg.chat.id, `❌ Ошибка: ${errMsg}`)
        }
        return
      }
      const links = await getProxyLinks(userId)
      const linkRows = buildLinksKeyboard(links)
      const trialCbText = links.length > 0
        ? `✅ *Тестовый доступ активирован!*\nСрок: ${trialDays} дн.\n\n🔌 Нажмите кнопку для подключения:`
        : `✅ *Тестовый доступ активирован!*\nСрок: ${trialDays} дн.`
      await bot.sendMessage(msg.chat.id, trialCbText, {
        parse_mode: 'Markdown',
        reply_markup: mergeKeyboard(linkRows, [[{ text: '🏠 Главное меню', callback_data: 'main_menu' }]])
      })
      return
    }

    if (data.startsWith('buy_')) {
      const planId = data.replace('buy_', '')
      const plans = await getPlans()
      const plan = plans.find(p => p.id === planId)
      if (!plan) return bot.sendMessage(msg.chat.id, '❌ Тариф не найден.')
      await bot.sendMessage(msg.chat.id,
        `💳 *Оплата подписки*\n\n📋 Тариф: *${plan.label}*\n💰 Сумма: *${plan.price} ₽*\n\n⚙️ Способ оплаты будет добавлен позже.\nОбратитесь к администратору.`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [
            [{ text: '↩️ Назад к тарифам', callback_data: 'show_plans' }],
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
