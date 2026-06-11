import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))

const BOT_USERS_FILE = join(__dirname, 'bot-users.json')
const BOT_PLANS_FILE = join(__dirname, 'bot-plans.json')
const BOT_SETTINGS_FILE = join(__dirname, 'bot-settings.json')
const BOT_PAYMENTS_FILE = join(__dirname, 'bot-payments.json')

function loadFile(file, def) {
  if (!existsSync(file)) return def
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return def }
}
function saveFile(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2))
}

export function loadBotUsers() { return loadFile(BOT_USERS_FILE, []) }
export function saveBotUsers(d) { saveFile(BOT_USERS_FILE, d) }

export function loadPlans() {
  const defaults = [
    { id: 'day1', label: '1 день', days: 1, price: 15, enabled: true },
    { id: 'month1', label: '1 месяц', days: 30, price: 149, enabled: true },
    { id: 'month3', label: '3 месяца', days: 90, price: 379, enabled: true },
    { id: 'month6', label: '6 месяцев', days: 180, price: 699, enabled: true },
    { id: 'month12', label: '12 месяцев', days: 365, price: 1290, enabled: true },
  ]
  return loadFile(BOT_PLANS_FILE, defaults)
}
export function savePlans(d) { saveFile(BOT_PLANS_FILE, d) }

export function loadBotSettings() {
  return loadFile(BOT_SETTINGS_FILE, {
    bot_token: '',
    bot_name: 'Telemt Proxy',
    welcome_text: 'Быстрый и надёжный сервис для работы с Telegram',
    features: '— Высокая скорость - никаких тормозов\n— Безопасность - не храним логи\n— Безлимит - пользуйся сколько хочешь\n— Стабильность - подключение к любым сервисам',
    support_link: '',
    about_text: 'Мы предоставляем премиальный MTProxy для Telegram.',
    ref_bonus_days: 3,
    trial_days: 1,
  })
}
export function saveBotSettings(d) { saveFile(BOT_SETTINGS_FILE, d) }

export function loadPayments() { return loadFile(BOT_PAYMENTS_FILE, []) }
export function savePayments(d) { saveFile(BOT_PAYMENTS_FILE, d) }

export function getBotUser(telegramId) {
  const users = loadBotUsers()
  return users.find(u => u.telegram_id === telegramId) || null
}

export function upsertBotUser(telegramId, data) {
  const users = loadBotUsers()
  const idx = users.findIndex(u => u.telegram_id === telegramId)
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...data, updated_at: Date.now() }
    saveBotUsers(users)
    return users[idx]
  } else {
    const user = { telegram_id: telegramId, ...data, created_at: Date.now(), updated_at: Date.now() }
    users.push(user)
    saveBotUsers(users)
    return user
  }
}

export function generateProxyUsername(telegramId) {
  return `tg_${telegramId}`
}

export function generateSecret() {
  return crypto.randomBytes(16).toString('hex')
}
