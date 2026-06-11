import { query } from './db.js'
import crypto from 'crypto'

// ── Bot Users ──────────────────────────────────────────────────────────────

export async function loadBotUsers() {
  const r = await query('SELECT * FROM bot_users ORDER BY created_at DESC')
  return r.rows.map(rowToUser)
}

export async function saveBotUsers() {
  throw new Error('saveBotUsers not supported in DB mode — use upsertBotUser')
}

export async function getBotUser(telegramId) {
  const r = await query('SELECT * FROM bot_users WHERE telegram_id = $1', [telegramId])
  return r.rows[0] ? rowToUser(r.rows[0]) : null
}

export async function upsertBotUser(telegramId, data) {
  const cols = Object.keys(data).filter(k => k !== 'telegram_id')
  const vals = cols.map(k => toDbValue(data[k]))

  if (cols.length === 0) {
    const r = await query('SELECT * FROM bot_users WHERE telegram_id = $1', [telegramId])
    if (r.rows[0]) return rowToUser(r.rows[0])
    const ins = await query(
      'INSERT INTO bot_users (telegram_id, updated_at, created_at) VALUES ($1, $2, $2) RETURNING *',
      [telegramId, Date.now()]
    )
    return rowToUser(ins.rows[0])
  }

  const setClauses = cols.map((c, i) => `${c} = $${i + 2}`).join(', ')
  const r = await query(
    `INSERT INTO bot_users (telegram_id, ${cols.join(', ')}, updated_at, created_at)
     VALUES ($1, ${vals.map((_, i) => `$${i + 2}`).join(', ')}, $${cols.length + 2}, $${cols.length + 2})
     ON CONFLICT (telegram_id) DO UPDATE SET ${setClauses}, updated_at = $${cols.length + 2}
     RETURNING *`,
    [telegramId, ...vals, Date.now()]
  )
  return rowToUser(r.rows[0])
}

// ── Plans ──────────────────────────────────────────────────────────────────

export async function loadPlans() {
  const r = await query('SELECT * FROM bot_plans ORDER BY sort_order, id')
  if (r.rows.length === 0) {
    return [
      { id: 'day1',    label: '1 день',     days: 1,   price: 15,   enabled: true },
      { id: 'month1',  label: '1 месяц',    days: 30,  price: 149,  enabled: true },
      { id: 'month3',  label: '3 месяца',   days: 90,  price: 379,  enabled: true },
      { id: 'month6',  label: '6 месяцев',  days: 180, price: 699,  enabled: true },
      { id: 'month12', label: '12 месяцев', days: 365, price: 1290, enabled: true },
    ]
  }
  return r.rows.map(r => ({ id: r.id, label: r.label, days: r.days, price: Number(r.price), enabled: r.enabled }))
}

export async function savePlans(plans) {
  await query('BEGIN')
  try {
    await query('DELETE FROM bot_plans')
    for (let i = 0; i < plans.length; i++) {
      const p = plans[i]
      await query(
        'INSERT INTO bot_plans (id, label, days, price, enabled, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
        [p.id, p.label, p.days, p.price, p.enabled !== false, i]
      )
    }
    await query('COMMIT')
  } catch (e) {
    await query('ROLLBACK')
    throw e
  }
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function loadBotSettings() {
  const r = await query('SELECT key, value FROM bot_settings')
  const map = {}
  for (const row of r.rows) map[row.key] = row.value
  return {
    bot_token:        map.bot_token        ?? '',
    bot_name:         map.bot_name         ?? 'Telemt Proxy',
    welcome_text:     map.welcome_text     ?? 'Быстрый и надёжный сервис для работы с Telegram',
    features:         map.features         ?? '',
    support_link:     map.support_link     ?? '',
    about_text:       map.about_text       ?? 'Мы предоставляем премиальный MTProxy для Telegram.',
    ref_bonus_days:   Number(map.ref_bonus_days   ?? 3),
    trial_days:       Number(map.trial_days       ?? 1),
    required_channel: map.required_channel ?? '',
  }
}

export async function saveBotSettings(data) {
  for (const [key, value] of Object.entries(data)) {
    await query(
      'INSERT INTO bot_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, String(value ?? '')]
    )
  }
}

// ── Payments ───────────────────────────────────────────────────────────────

export async function loadPayments() {
  const r = await query('SELECT * FROM payments ORDER BY created_at DESC')
  return r.rows.map(r => ({
    id: r.id,
    telegram_id: Number(r.telegram_id),
    plan_id: r.plan_id,
    amount: Number(r.amount),
    status: r.status,
    created_at: Number(r.created_at),
  }))
}

export async function savePayments() {
  throw new Error('savePayments not supported in DB mode — use individual inserts')
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function generateProxyUsername(telegramId) {
  return `tg_${telegramId}`
}

export function generateSecret() {
  return crypto.randomBytes(16).toString('hex')
}

function rowToUser(r) {
  return {
    telegram_id:       Number(r.telegram_id),
    first_name:        r.first_name        ?? '',
    last_name:         r.last_name         ?? '',
    username:          r.username          ?? '',
    balance:           Number(r.balance    ?? 0),
    referral_count:    Number(r.referral_count ?? 0),
    referred_by:       r.referred_by ? Number(r.referred_by) : null,
    proxy_username:    r.proxy_username    ?? null,
    proxy_secret:      r.proxy_secret      ?? null,
    subscription_until: r.subscription_until ? Number(r.subscription_until) : null,
    subscription_plan: r.subscription_plan ?? null,
    has_access:        Boolean(r.has_access),
    trial_used:        Boolean(r.trial_used),
    created_at:        Number(r.created_at ?? 0),
    updated_at:        Number(r.updated_at ?? 0),
  }
}

function toDbValue(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v
  return String(v)
}
