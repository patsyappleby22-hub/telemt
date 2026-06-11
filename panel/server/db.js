import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message)
})

export async function query(sql, params = []) {
  const client = await pool.connect()
  try {
    return await client.query(sql, params)
  } finally {
    client.release()
  }
}

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS nodes (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  auth_token  TEXT,
  created_at  BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

CREATE TABLE IF NOT EXISTS proxy_users (
  username            TEXT PRIMARY KEY,
  secret              TEXT NOT NULL,
  enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  max_tcp_conns       INTEGER,
  data_quota_bytes    BIGINT,
  rate_limit_up_bps   BIGINT,
  rate_limit_down_bps BIGINT,
  max_unique_ips      INTEGER,
  expiration_rfc3339  TEXT,
  user_ad_tag         TEXT,
  updated_at          BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

CREATE TABLE IF NOT EXISTS bot_users (
  telegram_id         BIGINT PRIMARY KEY,
  first_name          TEXT,
  last_name           TEXT,
  username            TEXT,
  balance             NUMERIC(12,2) NOT NULL DEFAULT 0,
  referral_count      INTEGER NOT NULL DEFAULT 0,
  referred_by         BIGINT,
  proxy_username      TEXT,
  proxy_secret        TEXT,
  subscription_until  BIGINT,
  subscription_plan   TEXT,
  has_access          BOOLEAN NOT NULL DEFAULT FALSE,
  trial_used          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  updated_at          BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

CREATE TABLE IF NOT EXISTS bot_plans (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  days       INTEGER NOT NULL,
  price      NUMERIC(10,2) NOT NULL,
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO bot_plans (id, label, days, price, enabled, sort_order)
SELECT * FROM (VALUES
  ('day1',    '1 день',     1,   15.00,  TRUE, 1),
  ('month1',  '1 месяц',    30,  149.00, TRUE, 2),
  ('month3',  '3 месяца',   90,  379.00, TRUE, 3),
  ('month6',  '6 месяцев',  180, 699.00, TRUE, 4),
  ('month12', '12 месяцев', 365, 1290.00,TRUE, 5)
) AS v(id, label, days, price, enabled, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM bot_plans LIMIT 1);

CREATE TABLE IF NOT EXISTS bot_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO bot_settings (key, value) VALUES
  ('bot_token',        ''),
  ('bot_name',         'Telemt Proxy'),
  ('welcome_text',     'Быстрый и надёжный сервис для работы с Telegram'),
  ('features',         '— Высокая скорость\n— Безопасность\n— Безлимит\n— Стабильность'),
  ('support_link',     ''),
  ('about_text',       'Мы предоставляем премиальный MTProxy для Telegram.'),
  ('ref_bonus_days',   '3'),
  ('trial_days',       '1'),
  ('required_channel', '')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS payments (
  id          TEXT PRIMARY KEY,
  telegram_id BIGINT,
  plan_id     TEXT,
  amount      NUMERIC(10,2),
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

CREATE INDEX IF NOT EXISTS idx_payments_telegram_id ON payments(telegram_id);
CREATE INDEX IF NOT EXISTS idx_bot_users_proxy_username ON bot_users(proxy_username);
`

export async function initDb() {
  await pool.query(INIT_SQL)
  console.log('[db] Schema initialized')
}

export default pool
