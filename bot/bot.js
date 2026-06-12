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

// ─── Translations ─────────────────────────────────────────────────────────────
const T = {
  ru: {
    // Main menu
    chooseAction: 'Выберите нужное действие:',
    // Keyboards
    kTrial:    '🛡 Тестовый доступ',
    kBuy:      '💳 Купить доступ',
    kAccess:   '🔑 Мой доступ',
    kProfile:  '👤 Профиль',
    kSupport:  '💬 Поддержка',
    kAbout:    '📖 О нас',
    kReferral: '👥 Рефералы',
    kTopup:    '💰 Пополнить',
    kLang:     '🌐 English',
    kLangCb:   'lang_en',
    kHome:     '🏠 Главное меню',
    kBack:     '← Назад',
    kBuyShort: '💳 Купить',
    kRenew:    '🔄 Продлить',
    kShare:    '📤 Поделиться',
    kWrite:    '✉️ Написать',
    kConnect:  (n, total) => total > 1 ? `⚡️ Подключить · Сервер ${n}` : '⚡️ Подключить',
    kSubscribe: (ch) => `🔔 Подписаться на @${ch}`,
    kSubscribed: '✅ Я подписался',
    kToPlans:  '← К тарифам',
    // Plans screen
    plansTitle: (name) => `💎 <b>${name}</b>\n\n<i>Выберите подходящий тарифный план:</i>`,
    plansEmpty: '⚠️ <b>Тарифы не настроены</b>\n\n<i>Обратитесь к администратору.</i>',
    planLabel: (label, price) => `💎 ${label} — ${price} ₽`,
    // Trial
    trialUsed: '⚠️ <b>Тестовый период уже использован</b>\n\n<i>Оформите подписку, чтобы продолжить:</i>',
    trialChannel: (ch, days) =>
      `📢 <b>Подпишитесь на канал</b>\n\n<i>Для получения тестового доступа необходимо подписаться на наш канал.</i>\n\nПосле подписки нажмите <b>«✅ Я подписался»</b> — доступ выдастся автоматически.\n\n⏱ Тест: <b>${days} дн.</b>`,
    trialActivated: (days, hasLinks) => hasLinks
      ? `✅ <b>Тестовый доступ активирован!</b>\n\n📅 Срок: <b>${days} дн.</b>\n\n<i>Нажмите кнопку ниже для подключения к прокси:</i>`
      : `✅ <b>Тестовый доступ активирован!</b>\n\n📅 Срок: <b>${days} дн.</b>\n\n<i>Ссылки для подключения появятся после настройки нод.</i>`,
    trialUsedShort: '⚠️ <b>Тестовый период уже использован</b>\n\n<i>Оформите подписку:</i>',
    trialError: (msg) => `❌ <b>Ошибка</b>\n\n<i>${msg}</i>`,
    // Access
    noAccess: '🔒 <b>Нет активного доступа</b>\n\n<i>Оформите подписку или активируйте тестовый период.</i>',
    accessTitle: '🔑 <b>Ваш доступ</b>\n\n',
    accessUntil: (badge, date) => `${badge} Активен до: <b>${date}</b>\n`,
    accessDays: (d) => `⏳ Осталось: <b>${d} дн.</b>\n`,
    accessConnect: '\n<i>Нажмите кнопку ниже для подключения к прокси:</i>',
    locale: 'ru-RU',
    // Profile
    profileTitle: '👤 <b>Профиль</b>\n\n',
    profileId: (id) => `<b>ID:</b> <code>${id}</code>\n`,
    profileUsername: (u) => `<b>Username:</b> @${u}\n`,
    profileName: (n) => `<b>Имя:</b> ${n}\n`,
    profileReg: (d) => `<b>Регистрация:</b> ${d}\n\n`,
    profileAccess: (active) => `<b>Доступ:</b> ${active ? '🟢 Активен' : '🔴 Не активен'}\n`,
    profileRefs: (n) => `<b>Рефералов:</b> ${n}\n`,
    profileBalance: (b) => `<b>Баланс:</b> ${b} ₽`,
    // Referral
    refTitle: '👥 <b>Реферальная программа</b>\n\n',
    refBonus: (d) => `🎁 За каждого приглашённого: <b>+${d} дн.</b>\n`,
    refCount: (n) => `👤 Ваших рефералов: <b>${n}</b>\n\n`,
    refLink: (l) => `🔗 <b>Ваша ссылка:</b>\n<code>${l}</code>`,
    refShareText: 'Быстрый MTProxy для Telegram!',
    // About
    aboutTitle: '📖 <b>О нас</b>\n\n',
    aboutDefault: 'Надёжный MTProxy для Telegram.',
    // Support
    supportTitle: '💬 <b>Поддержка</b>\n\n',
    supportLink: (l) => `Свяжитесь с нами: ${l}`,
    supportNoLink: '<i>Обратитесь к администратору бота.</i>',
    // Topup
    topupTitle: '💰 <b>Пополнение баланса</b>\n\n<i>Способ оплаты будет настроен позже.\nОбратитесь к администратору.</i>',
    // Buy
    buyNotFound: '❌ <b>Тариф не найден.</b>',
    buyTitle: (label, price) => `💳 <b>Оформление подписки</b>\n\n📋 Тариф: <b>${label}</b>\n💰 Сумма: <b>${price} ₽</b>\n\n<i>Способ оплаты будет добавлен позже.\nОбратитесь к администратору.</i>`,
  },
  en: {
    chooseAction: 'Choose an action:',
    kTrial:    '🛡 Trial access',
    kBuy:      '💳 Buy access',
    kAccess:   '🔑 My access',
    kProfile:  '👤 Profile',
    kSupport:  '💬 Support',
    kAbout:    '📖 About',
    kReferral: '👥 Referrals',
    kTopup:    '💰 Top up',
    kLang:     '🌐 Русский',
    kLangCb:   'lang_ru',
    kHome:     '🏠 Main menu',
    kBack:     '← Back',
    kBuyShort: '💳 Buy',
    kRenew:    '🔄 Renew',
    kShare:    '📤 Share',
    kWrite:    '✉️ Contact',
    kConnect:  (n, total) => total > 1 ? `⚡️ Connect · Server ${n}` : '⚡️ Connect',
    kSubscribe: (ch) => `🔔 Subscribe to @${ch}`,
    kSubscribed: '✅ I subscribed',
    kToPlans:  '← Back to plans',
    plansTitle: (name) => `💎 <b>${name}</b>\n\n<i>Choose a subscription plan:</i>`,
    plansEmpty: '⚠️ <b>No plans configured</b>\n\n<i>Please contact the administrator.</i>',
    planLabel: (label, price) => `💎 ${label} — ${price} ₽`,
    trialUsed: '⚠️ <b>Trial period already used</b>\n\n<i>Purchase a subscription to continue:</i>',
    trialChannel: (ch, days) =>
      `📢 <b>Subscribe to the channel</b>\n\n<i>To get trial access, you need to subscribe to our channel.</i>\n\nAfter subscribing, press <b>«✅ I subscribed»</b> — access will be granted automatically.\n\n⏱ Trial: <b>${days} day(s)</b>`,
    trialActivated: (days, hasLinks) => hasLinks
      ? `✅ <b>Trial access activated!</b>\n\n📅 Duration: <b>${days} day(s)</b>\n\n<i>Press the button below to connect to the proxy:</i>`
      : `✅ <b>Trial access activated!</b>\n\n📅 Duration: <b>${days} day(s)</b>\n\n<i>Connection links will appear once nodes are configured.</i>`,
    trialUsedShort: '⚠️ <b>Trial period already used</b>\n\n<i>Purchase a subscription:</i>',
    trialError: (msg) => `❌ <b>Error</b>\n\n<i>${msg}</i>`,
    noAccess: '🔒 <b>No active access</b>\n\n<i>Purchase a subscription or activate the trial period.</i>',
    accessTitle: '🔑 <b>Your access</b>\n\n',
    accessUntil: (badge, date) => `${badge} Active until: <b>${date}</b>\n`,
    accessDays: (d) => `⏳ Remaining: <b>${d} day(s)</b>\n`,
    accessConnect: '\n<i>Press the button below to connect to the proxy:</i>',
    locale: 'en-GB',
    profileTitle: '👤 <b>Profile</b>\n\n',
    profileId: (id) => `<b>ID:</b> <code>${id}</code>\n`,
    profileUsername: (u) => `<b>Username:</b> @${u}\n`,
    profileName: (n) => `<b>Name:</b> ${n}\n`,
    profileReg: (d) => `<b>Registered:</b> ${d}\n\n`,
    profileAccess: (active) => `<b>Access:</b> ${active ? '🟢 Active' : '🔴 Inactive'}\n`,
    profileRefs: (n) => `<b>Referrals:</b> ${n}\n`,
    profileBalance: (b) => `<b>Balance:</b> ${b} ₽`,
    refTitle: '👥 <b>Referral program</b>\n\n',
    refBonus: (d) => `🎁 For each invited friend: <b>+${d} day(s)</b>\n`,
    refCount: (n) => `👤 Your referrals: <b>${n}</b>\n\n`,
    refLink: (l) => `🔗 <b>Your link:</b>\n<code>${l}</code>`,
    refShareText: 'Fast MTProxy for Telegram!',
    aboutTitle: '📖 <b>About</b>\n\n',
    aboutDefault: 'Reliable MTProxy for Telegram.',
    supportTitle: '💬 <b>Support</b>\n\n',
    supportLink: (l) => `Contact us: ${l}`,
    supportNoLink: '<i>Please contact the bot administrator.</i>',
    topupTitle: '💰 <b>Top up balance</b>\n\n<i>Payment method will be configured later.\nPlease contact the administrator.</i>',
    buyNotFound: '❌ <b>Plan not found.</b>',
    buyTitle: (label, price) => `💳 <b>Purchase subscription</b>\n\n📋 Plan: <b>${label}</b>\n💰 Amount: <b>${price} ₽</b>\n\n<i>Payment method will be added later.\nPlease contact the administrator.</i>`,
  }
}

function t(lang) { return T[lang] || T.ru }

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

function buildLinksKeyboard(links, lang) {
  if (!links || links.length === 0) return []
  const i18n = t(lang)
  return links.map((link, i) => [{ text: i18n.kConnect(i + 1, links.length), url: link }])
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
  await api(`/users/${referrerId}`, { method: 'PATCH', body: { referral_count: (refUser.referral_count || 0) + 1 } })
  const now = Date.now()
  if (refUser.subscription_until && refUser.subscription_until > now) {
    await api(`/users/${referrerId}`, { method: 'PATCH', body: { subscription_until: refUser.subscription_until + bonusDays * 86400000 } })
  }
}

// ─── Keyboards ────────────────────────────────────────────────────────────────
function mainMenuKeyboard(lang) {
  const i18n = t(lang)
  return {
    inline_keyboard: [
      [{ text: i18n.kTrial, callback_data: 'trial' }, { text: i18n.kBuy, callback_data: 'show_plans' }],
      [{ text: i18n.kAccess, callback_data: 'my_access' }, { text: i18n.kProfile, callback_data: 'profile' }],
      [{ text: i18n.kSupport, callback_data: 'support' }, { text: i18n.kAbout, callback_data: 'about' }],
      [{ text: i18n.kReferral, callback_data: 'referral' }, { text: i18n.kTopup, callback_data: 'topup' }],
      [{ text: i18n.kLang, callback_data: i18n.kLangCb }],
    ]
  }
}

function plansKeyboard(plans, lang) {
  const i18n = t(lang)
  const rows = plans.map(p => [{ text: i18n.planLabel(p.label, p.price), callback_data: `buy_${p.id}` }])
  rows.push([{ text: i18n.kHome, callback_data: 'main_menu' }])
  return { inline_keyboard: rows }
}

function backKbd(lang, cb = 'main_menu') {
  return { inline_keyboard: [[{ text: t(lang).kBack, callback_data: cb }]] }
}

// ─── User language preference ─────────────────────────────────────────────────
const userLang = new Map()
function getLang(userId) { return userLang.get(userId) || 'ru' }

// ─── Message tracking ─────────────────────────────────────────────────────────
const lastMsg = new Map()
const pendingTrial = new Map()

async function editScreen(bot, query, text, opts = {}) {
  const chatId = query.message.chat.id
  const msgId = query.message.message_id
  const userId = query.from.id
  try {
    const r = await bot.editMessageText(chatId, msgId, text, opts)
    if (r && r.ok) { lastMsg.set(userId, { chatId, msgId }); return r.result }
    console.warn(`[bot] editMessageText failed: ${JSON.stringify(r?.description || r)}`)
  } catch (e) { console.warn('[bot] editMessageText error:', e.message) }
  try {
    const sent = await bot.sendMessage(chatId, text, opts)
    if (sent && sent.ok && sent.result) { lastMsg.set(userId, { chatId, msgId: sent.result.message_id }); return sent.result }
  } catch (e) { console.error('[bot] sendMessage fallback error:', e.message) }
}

// ─── Main menu text ───────────────────────────────────────────────────────────
function buildMainMenuText(settings, lang) {
  const i18n = t(lang)
  const name = esc(settings.bot_name || 'Telemt Proxy')
  const welcome = esc(settings.welcome_text || 'Быстрый и надёжный MTProxy')
  const features = settings.features || ''

  let text = `⚡️ <b>${name}</b>\n<i>${welcome}</i>\n`

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

  text += `\n${i18n.chooseAction}`
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

  // ── /start ───────────────────────────────────────────────────────────────────
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
    const r = await bot.sendMessage(msg.chat.id, buildMainMenuText(s, lang), {
      parse_mode: 'HTML',
      reply_markup: mainMenuKeyboard(lang)
    })
    if (r?.ok && r?.result) lastMsg.set(msg.from.id, { chatId: msg.chat.id, msgId: r.result.message_id })
  })

  // ── Callback queries ──────────────────────────────────────────────────────────
  bot.on('callback_query', async (query) => {
    const userId = query.from.id
    const data = query.data
    await bot.answerCallbackQuery(query.id)
    const lang = getLang(userId)
    const i18n = t(lang)

    // ── Переключение языка ─────────────────────────────────────────────────────
    if (data === 'lang_en' || data === 'lang_ru') {
      const newLang = data === 'lang_en' ? 'en' : 'ru'
      userLang.set(userId, newLang)
      const s = await getSettings()
      await editScreen(bot, query, buildMainMenuText(s, newLang), {
        parse_mode: 'HTML',
        reply_markup: mainMenuKeyboard(newLang)
      })
      return
    }

    // ── Главное меню ───────────────────────────────────────────────────────────
    if (data === 'main_menu') {
      const s = await getSettings()
      await editScreen(bot, query, buildMainMenuText(s, lang), {
        parse_mode: 'HTML',
        reply_markup: mainMenuKeyboard(lang)
      })
      return
    }

    // ── Тарифы ────────────────────────────────────────────────────────────────
    if (data === 'show_plans') {
      const plans = await getPlans()
      if (!plans.length) {
        await editScreen(bot, query, i18n.plansEmpty, { parse_mode: 'HTML', reply_markup: backKbd(lang) })
        return
      }
      const s = await getSettings()
      await editScreen(bot, query, i18n.plansTitle(esc(s.bot_name || 'Proxy')), {
        parse_mode: 'HTML',
        reply_markup: plansKeyboard(plans, lang)
      })
      return
    }

    // ── Тестовый доступ ────────────────────────────────────────────────────────
    if (data === 'trial' || data === 'check_sub') {
      const user = await getOrCreateUser(query.from)
      const s = await getSettings()
      const trialDays = s.trial_days || 1
      const channel = (s.required_channel || '').trim().replace(/^@/, '')

      if (user.trial_used) {
        await editScreen(bot, query, i18n.trialUsed, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [
            [{ text: i18n.kBuy, callback_data: 'show_plans' }],
            [{ text: i18n.kBack, callback_data: 'main_menu' }]
          ]}
        })
        return
      }

      if (channel) {
        const subscribed = await isSubscribedToChannel(bot, userId, channel)
        if (!subscribed) {
          await editScreen(bot, query, i18n.trialChannel(channel, trialDays), {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [
              [{ text: i18n.kSubscribe(channel), url: `https://t.me/${channel}` }],
              [{ text: i18n.kSubscribed, callback_data: 'check_sub' }],
              [{ text: i18n.kBack, callback_data: 'main_menu' }]
            ]}
          })
          pendingTrial.set(userId, { chatId: query.message.chat.id, msgId: query.message.message_id })
          return
        }
        pendingTrial.delete(userId)
      }

      const result = await api(`/users/${userId}/trial`, { method: 'POST', body: {} })
      if (!result || result.error) {
        const errMsg = result?.error || 'Unknown error'
        const isUsed = errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('trial')
        await editScreen(bot, query, isUsed ? i18n.trialUsedShort : i18n.trialError(esc(errMsg)), {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [
            [{ text: i18n.kBuy, callback_data: 'show_plans' }],
            [{ text: i18n.kBack, callback_data: 'main_menu' }]
          ]}
        })
        return
      }

      const links = await getProxyLinks(userId)
      const linkRows = buildLinksKeyboard(links, lang)
      await editScreen(bot, query, i18n.trialActivated(trialDays, links.length > 0), {
        parse_mode: 'HTML',
        reply_markup: mergeKeyboard(linkRows, [[{ text: i18n.kHome, callback_data: 'main_menu' }]])
      })
      return
    }

    // ── Мой доступ ─────────────────────────────────────────────────────────────
    if (data === 'my_access') {
      const user = await getOrCreateUser(query.from)
      const now = Date.now()
      const active = user.subscription_until && user.subscription_until > now
      if (!active) {
        await editScreen(bot, query, i18n.noAccess, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [
            [{ text: i18n.kTrial, callback_data: 'trial' }, { text: i18n.kBuyShort, callback_data: 'show_plans' }],
            [{ text: i18n.kBack, callback_data: 'main_menu' }]
          ]}
        })
        return
      }
      const links = await getProxyLinks(userId)
      const linkRows = buildLinksKeyboard(links, lang)
      const until = new Date(user.subscription_until).toLocaleDateString(i18n.locale)
      const daysLeft = Math.ceil((user.subscription_until - now) / 86400000)
      const badge = daysLeft <= 3 ? '🔴' : daysLeft <= 7 ? '🟡' : '🟢'
      let text = i18n.accessTitle + i18n.accessUntil(badge, until) + i18n.accessDays(daysLeft)
      if (links.length > 0) text += i18n.accessConnect
      await editScreen(bot, query, text, {
        parse_mode: 'HTML',
        reply_markup: mergeKeyboard(linkRows, [
          [{ text: i18n.kRenew, callback_data: 'show_plans' }],
          [{ text: i18n.kBack, callback_data: 'main_menu' }]
        ])
      })
      return
    }

    // ── Профиль ────────────────────────────────────────────────────────────────
    if (data === 'profile') {
      const user = await getOrCreateUser(query.from)
      const now = Date.now()
      const active = user.subscription_until && user.subscription_until > now
      const reg = user.created_at ? new Date(user.created_at).toLocaleDateString(i18n.locale) : '—'
      const name = esc([query.from.first_name, query.from.last_name].filter(Boolean).join(' ') || '—')
      let text = i18n.profileTitle
      text += i18n.profileId(userId)
      if (query.from.username) text += i18n.profileUsername(esc(query.from.username))
      text += i18n.profileName(name)
      text += i18n.profileReg(reg)
      text += i18n.profileAccess(active)
      text += i18n.profileRefs(user.referral_count || 0)
      text += i18n.profileBalance((user.balance || 0).toFixed(2))
      await editScreen(bot, query, text, { parse_mode: 'HTML', reply_markup: backKbd(lang) })
      return
    }

    // ── Реферальная программа ──────────────────────────────────────────────────
    if (data === 'referral') {
      const user = await getOrCreateUser(query.from)
      const s = await getSettings()
      const bonusDays = s.ref_bonus_days || 3
      const refLink = `https://t.me/${me.username}?start=${userId}`
      let text = i18n.refTitle + i18n.refBonus(bonusDays) + i18n.refCount(user.referral_count || 0) + i18n.refLink(refLink)
      await editScreen(bot, query, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [
          [{ text: i18n.kShare, url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(i18n.refShareText)}` }],
          [{ text: i18n.kBack, callback_data: 'main_menu' }]
        ]}
      })
      return
    }

    // ── О нас ──────────────────────────────────────────────────────────────────
    if (data === 'about') {
      const s = await getSettings()
      await editScreen(bot, query,
        i18n.aboutTitle + esc(s.about_text || i18n.aboutDefault),
        { parse_mode: 'HTML', reply_markup: backKbd(lang) }
      )
      return
    }

    // ── Поддержка ──────────────────────────────────────────────────────────────
    if (data === 'support') {
      const s = await getSettings()
      const raw = (s.support_link || '').trim()
      let link = raw
      if (link.startsWith('@')) link = `https://t.me/${link.slice(1)}`
      else if (/^t\.me\//i.test(link)) link = `https://${link}`
      const validUrl = /^https?:\/\//i.test(link)
      const text = i18n.supportTitle + (raw ? i18n.supportLink(esc(raw)) : i18n.supportNoLink)
      await editScreen(bot, query, text, {
        parse_mode: 'HTML',
        reply_markup: validUrl
          ? { inline_keyboard: [[{ text: i18n.kWrite, url: link }], [{ text: i18n.kBack, callback_data: 'main_menu' }]] }
          : backKbd(lang)
      })
      return
    }

    // ── Пополнить баланс ───────────────────────────────────────────────────────
    if (data === 'topup') {
      await editScreen(bot, query, i18n.topupTitle, { parse_mode: 'HTML', reply_markup: backKbd(lang) })
      return
    }

    // ── Покупка тарифа ─────────────────────────────────────────────────────────
    if (data.startsWith('buy_')) {
      const planId = data.replace('buy_', '')
      const plans = await getPlans()
      const plan = plans.find(p => p.id === planId)
      if (!plan) {
        await editScreen(bot, query, i18n.buyNotFound, {
          parse_mode: 'HTML',
          reply_markup: backKbd(lang, 'show_plans')
        })
        return
      }
      await editScreen(bot, query, i18n.buyTitle(esc(plan.label), plan.price), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [
          [{ text: i18n.kToPlans, callback_data: 'show_plans' }],
          [{ text: i18n.kHome, callback_data: 'main_menu' }]
        ]}
      })
      return
    }
  })

  // ── Автовыдача триала при подписке на канал ───────────────────────────────────
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

      const lang = getLang(userId)
      const i18n = t(lang)
      const s = await getSettings()
      const trialDays = s.trial_days || 1

      const result = await api(`/users/${userId}/trial`, { method: 'POST', body: {} })
      if (!result || result.error) {
        const errMsg = result?.error || 'Unknown error'
        const isUsed = errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('trial')
        await bot.editMessageText(chatId, msgId,
          isUsed ? i18n.trialUsedShort : i18n.trialError(esc(errMsg)),
          {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [
              [{ text: i18n.kBuy, callback_data: 'show_plans' }],
              [{ text: i18n.kHome, callback_data: 'main_menu' }]
            ]}
          }
        )
        return
      }

      const links = await getProxyLinks(userId)
      const linkRows = buildLinksKeyboard(links, lang)
      await bot.editMessageText(chatId, msgId,
        i18n.trialActivated(trialDays, links.length > 0),
        {
          parse_mode: 'HTML',
          reply_markup: mergeKeyboard(linkRows, [[{ text: i18n.kHome, callback_data: 'main_menu' }]])
        }
      )
    } catch (e) {
      console.error('[bot] chat_member handler error:', e.message)
    }
  })

  bot.startPolling()
}

startBot()
