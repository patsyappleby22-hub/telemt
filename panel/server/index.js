import express from 'express'
import { request as httpRequest } from 'http'
import { request as httpsRequest } from 'https'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import crypto from 'crypto'
import { initDb, query } from './db.js'
import {
  loadBotUsers, loadPlans, savePlans,
  loadBotSettings, saveBotSettings, loadPayments,
  upsertBotUser, getBotUser, generateProxyUsername, generateSecret
} from './bot-db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()

// ── Database helpers for nodes / proxy_users ─────────────────────────────────

async function loadNodes() {
  const r = await query('SELECT * FROM nodes ORDER BY created_at ASC')
  return r.rows
}

async function saveNode(node) {
  await query(
    `INSERT INTO nodes (id, name, url, auth_token, created_at)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET name=$2, url=$3, auth_token=$4`,
    [node.id, node.name, node.url, node.auth_token || null, node.created_at]
  )
}

async function deleteNode(id) {
  await query('DELETE FROM nodes WHERE id = $1', [id])
}

async function loadUsers() {
  const r = await query('SELECT * FROM proxy_users ORDER BY username ASC')
  return r.rows
}

async function saveUser(user) {
  const {
    username, secret, enabled = true,
    max_tcp_conns, data_quota_bytes,
    rate_limit_up_bps, rate_limit_down_bps,
    max_unique_ips, expiration_rfc3339, user_ad_tag
  } = user
  await query(
    `INSERT INTO proxy_users
       (username, secret, enabled, max_tcp_conns, data_quota_bytes,
        rate_limit_up_bps, rate_limit_down_bps, max_unique_ips,
        expiration_rfc3339, user_ad_tag, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (username) DO UPDATE SET
       secret=$2, enabled=$3, max_tcp_conns=$4, data_quota_bytes=$5,
       rate_limit_up_bps=$6, rate_limit_down_bps=$7, max_unique_ips=$8,
       expiration_rfc3339=$9, user_ad_tag=$10, updated_at=$11`,
    [
      username, secret, enabled !== false,
      max_tcp_conns || null, data_quota_bytes || null,
      rate_limit_up_bps || null, rate_limit_down_bps || null,
      max_unique_ips || null, expiration_rfc3339 || null,
      user_ad_tag || null, Date.now()
    ]
  )
}

async function deleteUser(username) {
  await query('DELETE FROM proxy_users WHERE username = $1', [username])
}

// ── Node API proxy helper ─────────────────────────────────────────────────────

function nodeApiRequest(node, method, path, body) {
  return new Promise((resolve) => {
    let targetUrl
    try { targetUrl = new URL(node.url) } catch { return resolve({ ok: false }) }

    const isHttps = targetUrl.protocol === 'https:'
    const transport = isHttps ? httpsRequest : httpRequest
    const bodyStr = body ? JSON.stringify(body) : undefined

    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    }
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr)
    if (node.auth_token) options.headers['Authorization'] = node.auth_token

    const req = transport(options, (res) => {
      let data = ''
      res.on('data', d => { data += d })
      res.on('end', () => resolve({ ok: res.statusCode < 300, status: res.statusCode, body: data }))
    })
    req.on('error', () => resolve({ ok: false }))
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }) })
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

async function syncUsersToNode(node) {
  const users = await loadUsers()
  if (users.length === 0) return
  let created = 0, updated = 0, fail = 0
  for (const user of users) {
    const body = { username: user.username, secret: user.secret, enabled: user.enabled !== false }
    if (user.max_tcp_conns) body.max_tcp_conns = user.max_tcp_conns
    if (user.data_quota_bytes) body.data_quota_bytes = user.data_quota_bytes
    if (user.rate_limit_up_bps) body.rate_limit_up_bps = user.rate_limit_up_bps
    if (user.rate_limit_down_bps) body.rate_limit_down_bps = user.rate_limit_down_bps
    if (user.max_unique_ips) body.max_unique_ips = user.max_unique_ips
    if (user.expiration_rfc3339) body.expiration_rfc3339 = user.expiration_rfc3339
    if (user.user_ad_tag) body.user_ad_tag = user.user_ad_tag
    const res = await nodeApiRequest(node, 'POST', '/v1/users', body)
    if (res.ok) {
      created++
    } else {
      const isConflict = res.status === 409 || res.status === 422 ||
        (res.body && (res.body.includes('exist') || res.body.includes('conflict')))
      if (isConflict) {
        const rotRes = await nodeApiRequest(node, 'POST',
          `/v1/users/${encodeURIComponent(user.username)}/rotate-secret`,
          { secret: user.secret })
        rotRes.ok ? updated++ : fail++
      } else {
        fail++
      }
    }
  }
  console.log(`[sync] Node "${node.name}": ${created} created, ${updated} secret-updated, ${fail} failed (${users.length} total)`)
}

// In-memory registration tokens
const regTokens = new Map()

const parseJson = express.json()
const router = express.Router()

// ── Node CRUD ──────────────────────────────────────────────────────────────────

router.get('/nodes', async (req, res) => {
  const nodes = await loadNodes()
  res.json(nodes.map(n => ({ ...n, auth_token: n.auth_token ? '***' : undefined })))
})

router.post('/nodes', parseJson, async (req, res) => {
  const { name, url, auth_token } = req.body
  if (!name || !url) return res.status(400).json({ error: 'name and url required' })
  const id = crypto.randomUUID()
  const node = { id, name, url: url.replace(/\/$/, ''), auth_token: auth_token || null, created_at: Date.now() }
  await saveNode(node)
  syncUsersToNode(node).catch(e => console.error('[sync] Error:', e.message))
  res.json({ ...node, auth_token: auth_token ? '***' : undefined })
})

router.patch('/nodes/:id', parseJson, async (req, res) => {
  const nodes = await loadNodes()
  const node = nodes.find(n => n.id === req.params.id)
  if (!node) return res.status(404).json({ error: 'Not found' })
  const { name, url, auth_token } = req.body
  if (name) node.name = name
  if (url) node.url = url.replace(/\/$/, '')
  if (auth_token !== undefined) node.auth_token = auth_token || null
  await saveNode(node)
  res.json({ ...node, auth_token: node.auth_token ? '***' : undefined })
})

router.delete('/nodes/:id', async (req, res) => {
  const nodes = await loadNodes()
  const node = nodes.find(n => n.id === req.params.id)
  if (!node) return res.status(404).json({ error: 'Not found' })
  await deleteNode(req.params.id)
  res.json({ ok: true })
})

// ── Auto-registration ──────────────────────────────────────────────────────────

router.post('/tokens', parseJson, (req, res) => {
  const { name, panel_url } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  if (!panel_url) return res.status(400).json({ error: 'panel_url required' })
  const token = crypto.randomBytes(24).toString('hex')
  const expires_at = Date.now() + 30 * 60 * 1000
  regTokens.set(token, { name, panel_url, expires_at })
  for (const [k, v] of regTokens) {
    if (v.expires_at < Date.now()) regTokens.delete(k)
  }
  res.json({ token, expires_at })
})

router.post('/register', parseJson, async (req, res) => {
  const { token, url } = req.body
  if (!token) return res.status(400).json({ error: 'token required' })
  if (!url) return res.status(400).json({ error: 'url required' })

  const entry = regTokens.get(token)
  if (!entry) return res.status(401).json({ error: 'Неверный или истёкший токен' })
  if (entry.expires_at < Date.now()) {
    regTokens.delete(token)
    return res.status(401).json({ error: 'Токен истёк' })
  }

  regTokens.delete(token)
  const id = crypto.randomUUID()
  const node = { id, name: entry.name, url: url.replace(/\/$/, ''), auth_token: null, created_at: Date.now() }
  await saveNode(node)
  console.log(`[register] New node: ${entry.name} @ ${url}`)
  setTimeout(() => syncUsersToNode(node).catch(e => console.error('[sync] Error:', e.message)), 2000)
  res.json({ ok: true, node_id: id, name: entry.name })
})

// ── User registry ──────────────────────────────────────────────────────────────

router.get('/users', async (req, res) => {
  const users = await loadUsers()
  res.json(users.map(u => ({ username: u.username, enabled: u.enabled })))
})

router.post('/users', parseJson, async (req, res) => {
  const { username, secret, ...settings } = req.body
  if (!username || !secret) return res.status(400).json({ error: 'username and secret required' })
  await saveUser({ username, secret, ...settings, updated_at: Date.now() })
  res.json({ ok: true })
})

router.delete('/users/:username', async (req, res) => {
  await deleteUser(req.params.username)
  res.json({ ok: true })
})

// ── Force sync ─────────────────────────────────────────────────────────────────

router.post('/sync', async (req, res) => {
  const currentNodes = await loadNodes()
  if (currentNodes.length === 0) return res.json({ ok: true, message: 'No nodes', results: [] })
  const results = []
  for (const node of currentNodes) {
    const users = await loadUsers()
    let created = 0, rotated = 0, recreated = 0, failed = 0
    const nodeErrors = []
    for (const user of users) {
      const body = { username: user.username, secret: user.secret, enabled: user.enabled !== false }
      if (user.max_tcp_conns) body.max_tcp_conns = user.max_tcp_conns
      if (user.data_quota_bytes) body.data_quota_bytes = user.data_quota_bytes
      if (user.rate_limit_up_bps) body.rate_limit_up_bps = user.rate_limit_up_bps
      if (user.rate_limit_down_bps) body.rate_limit_down_bps = user.rate_limit_down_bps
      if (user.max_unique_ips) body.max_unique_ips = user.max_unique_ips
      if (user.expiration_rfc3339) body.expiration_rfc3339 = user.expiration_rfc3339
      if (user.user_ad_tag) body.user_ad_tag = user.user_ad_tag

      const createRes = await nodeApiRequest(node, 'POST', '/v1/users', body)
      if (createRes.ok) { created++; continue }

      const isConflict = createRes.status === 409 || createRes.status === 422 ||
        (createRes.body && (createRes.body.includes('exist') || createRes.body.includes('conflict')))

      if (!isConflict) { failed++; nodeErrors.push(`${user.username}: create failed (${createRes.status})`); continue }

      const rotRes = await nodeApiRequest(node, 'POST',
        `/v1/users/${encodeURIComponent(user.username)}/rotate-secret`, { secret: user.secret })
      if (rotRes.ok) { rotated++; continue }

      const delRes = await nodeApiRequest(node, 'DELETE', `/v1/users/${encodeURIComponent(user.username)}`, null)
      if (delRes.ok) {
        const reCreateRes = await nodeApiRequest(node, 'POST', '/v1/users', body)
        reCreateRes.ok ? recreated++ : (failed++, nodeErrors.push(`${user.username}: recreate failed`))
      } else {
        failed++
        nodeErrors.push(`${user.username}: delete failed (${delRes.status})`)
      }
    }
    results.push({ node: node.name, created, rotated, recreated, failed, errors: nodeErrors, total: users.length })
  }
  res.json({ ok: true, results })
})

// ── Install / update scripts ───────────────────────────────────────────────────

router.get('/update.sh', (req, res) => {
  const { node_url } = req.query
  const B = '`'
  const lines = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'GREEN="\\033[0;32m"; YELLOW="\\033[1;33m"; RED="\\033[0;31m"; NC="\\033[0m"',
    'info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }',
    'warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }',
    'die()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }',
    '',
    'INSTALL_DIR=/opt/telemt',
    'BINARY="$INSTALL_DIR/telemt"',
    'CONFIG_FILE="$INSTALL_DIR/config.toml"',
    'REPO_DIR=/opt/telemt-src',
    '',
    '[ -f "$BINARY" ] || die "Telemt не установлен. Используйте команду Авто-установки из панели."',
    '',
    `PUBLIC_IP=$(curl -fsSL --max-time 5 https://api.ipify.org 2>/dev/null || curl -fsSL --max-time 5 https://ifconfig.me 2>/dev/null || ${B}hostname -I | awk '{print $1}'${B})`,
    '[ -z "$PUBLIC_IP" ] && die "Не удалось определить публичный IP"',
    'info "Публичный IP: $PUBLIC_IP"',
    '',
    'info "Обновляю исходники telemt..."',
    `cd "$REPO_DIR" && git fetch origin && git reset --hard ${B}git rev-parse origin/HEAD${B}`,
    'info "Собираю telemt (может занять несколько минут)..."',
    'export PATH="$HOME/.cargo/bin:$PATH"',
    'cargo build --release 2>&1 | tail -5',
    'info "Останавливаю сервис для замены бинарника..."',
    'systemctl stop telemt 2>/dev/null || true',
    'cp target/release/telemt "$BINARY"',
    'chmod +x "$BINARY"',
    'systemctl restart telemt',
    'info "Telemt обновлён и перезапущен!"',
  ]
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.send(lines.join('\n') + '\n')
})

router.get('/setup.sh', (req, res) => {
  const { token, name, panel_url, api_port = '9091', proxy_port = '8443' } = req.query
  if (!token || !panel_url) return res.status(400).send('# Error: token and panel_url required\n')

  const safeName  = (name || 'vps').replace(/[^a-zA-Z0-9_-]/g, '_')
  const safePanel = panel_url.replace(/'/g, '')
  const safeToken = token.replace(/[^a-f0-9]/g, '')
  const B = '`'

  const lines = [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    `PANEL_URL='${safePanel}'`,
    `REG_TOKEN='${safeToken}'`,
    `NODE_NAME='${safeName}'`,
    `API_PORT='${api_port}'`,
    `PROXY_PORT='${proxy_port}'`,
    "INSTALL_DIR='/opt/telemt'",
    'CONFIG_FILE="$INSTALL_DIR/config.toml"',
    'SERVICE_FILE=\'/etc/systemd/system/telemt.service\'',
    '',
    "RED='\\033[0;31m'; GREEN='\\033[0;32m'; YELLOW='\\033[1;33m'; NC='\\033[0m'",
    'info() { echo -e "\\n${GREEN}[+]${NC} $*"; }',
    'warn() { echo -e "\\n${YELLOW}[!]${NC} $*"; }',
    'die()  { echo -e "\\n${RED}[x]${NC} $*"; exit 1; }',
    '',
    '[ "$(id -u)" -ne 0 ] && die "Запускайте скрипт от root: sudo bash setup.sh"',
    '',
    'info "Определяю публичный IP..."',
    `PUBLIC_IP=$(curl -fsSL --max-time 5 https://api.ipify.org 2>/dev/null || curl -fsSL --max-time 5 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')`,
    '[ -z "$PUBLIC_IP" ] && die "Не удалось определить публичный IP"',
    'info "Публичный IP: $PUBLIC_IP"',
    '',
    'info "Устанавливаю зависимости..."',
    'if command -v apt-get &>/dev/null; then',
    '  apt-get update -qq && apt-get install -y -qq curl wget git build-essential pkg-config libssl-dev ca-certificates',
    'elif command -v yum &>/dev/null; then',
    '  yum install -y -q curl wget git gcc openssl-devel',
    'fi',
    '',
    'mkdir -p "$INSTALL_DIR"',
    'IS_UPDATE=false',
    '[ -f "$INSTALL_DIR/telemt" ] && IS_UPDATE=true',
    '',
    'export PATH="$HOME/.cargo/bin:$PATH"',
    'if ! command -v cargo &>/dev/null; then',
    '  info "Устанавливаю Rust..."',
    '  curl -fsSL --retry 3 https://sh.rustup.rs | sh -s -- -y --no-modify-path >/dev/null 2>&1',
    '  export PATH="$HOME/.cargo/bin:$PATH"',
    'fi',
    '',
    'REPO_URL="https://github.com/patsyappleby22-hub/telemt"',
    'SRC_DIR="/opt/telemt-src"',
    'if [ -d "$SRC_DIR/.git" ]; then',
    '  git -C "$SRC_DIR" fetch -q 2>/dev/null || true',
    `  git -C "$SRC_DIR" reset --hard ${B}git -C "$SRC_DIR" rev-parse --abbrev-ref origin/HEAD 2>/dev/null || echo origin/main${B} -q 2>/dev/null || true`,
    'else',
    '  rm -rf "$SRC_DIR"',
    '  git clone --depth 1 -q "$REPO_URL" "$SRC_DIR" || die "Не удалось клонировать: $REPO_URL"',
    'fi',
    '$IS_UPDATE && { systemctl stop telemt 2>/dev/null || true; }',
    'info "Сборка telemt..."',
    'cd "$SRC_DIR"',
    'CARGO_BUILD_JOBS=$(nproc) cargo build --release 2>&1 | grep -E "(error|Finished|Compiling telemt)" || true',
    '[ -f "target/release/telemt" ] || die "Сборка не удалась."',
    'cp "target/release/telemt" "$INSTALL_DIR/telemt"',
    'chmod +x "$INSTALL_DIR/telemt"',
    'cd "$INSTALL_DIR"',
    '',
    'SECRET=""',
    'if [ -f "$CONFIG_FILE" ]; then',
    '  if grep -q "^public_host" "$CONFIG_FILE"; then',
    '    sed -i "s|^public_host = .*|public_host = \\"${PUBLIC_IP}\\"|" "$CONFIG_FILE"',
    '  fi',
    'else',
    '  SECRET=$(openssl rand -hex 16)',
    '  cat > "$CONFIG_FILE" << EOF',
    '[general.links]',
    'public_host = "${PUBLIC_IP}"',
    '',
    '[server]',
    'listen = "0.0.0.0:${PROXY_PORT}"',
    'workers = 0',
    '',
    '[server.api]',
    'listen = "0.0.0.0:${API_PORT}"',
    'whitelist = ["0.0.0.0/0"]',
    '',
    '[[users]]',
    'username = "default"',
    'secret = "${SECRET}"',
    'enabled = true',
    'EOF',
    'fi',
    '',
    'cat > "$SERVICE_FILE" << UNIT',
    '[Unit]',
    'Description=Telemt MTProxy Server',
    'After=network.target',
    '',
    '[Service]',
    'Type=simple',
    'User=root',
    'WorkingDirectory=$INSTALL_DIR',
    'ExecStart=$INSTALL_DIR/telemt $CONFIG_FILE',
    'Restart=always',
    'RestartSec=5',
    'LimitNOFILE=65536',
    '',
    '[Install]',
    'WantedBy=multi-user.target',
    'UNIT',
    '',
    'systemctl daemon-reload',
    'systemctl enable telemt >/dev/null 2>&1',
    'systemctl restart telemt',
    '',
    'for i in $(seq 1 20); do',
    `  if curl -fsSL --max-time 2 "http://127.0.0.1:\${API_PORT}/v1/health" >/dev/null 2>&1; then`,
    '    info "API доступен"; break',
    '  fi',
    '  [ "$i" -eq 20 ] && die "Telemt не запустился."',
    '  sleep 1',
    'done',
    '',
    'if [ -n "$REG_TOKEN" ]; then',
    '  info "Регистрирую ноду в панели..."',
    `  REG_RESPONSE=$(curl -fsSL --max-time 15 -X POST -H 'Content-Type: application/json' -d "{\\"token\\":\\"\${REG_TOKEN}\\",\\"url\\":\\"http://\${PUBLIC_IP}:\${API_PORT}\\"}" "\${PANEL_URL}/proxy/register" 2>&1)`,
    `  echo "$REG_RESPONSE" | grep -q '"ok":true' && info "Нода зарегистрирована!" || warn "Не удалось зарегистрироваться: $REG_RESPONSE"`,
    'fi',
    '',
    'echo "Нода: $NODE_NAME | IP: $PUBLIC_IP | API: $API_PORT | Proxy: $PROXY_PORT"',
    '[ -n "$SECRET" ] && echo "Секрет default: $SECRET (сохраните!)"',
  ]
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.send(lines.join('\n') + '\n')
})

// ── Proxy to remote telemt nodes ───────────────────────────────────────────────

router.use('/nodes/:id/api', async (req, res) => {
  const nodes = await loadNodes()
  const node = nodes.find(n => n.id === req.params.id)
  if (!node) return res.status(404).json({ error: 'Node not found' })

  let targetUrl
  try { targetUrl = new URL(node.url) } catch {
    return res.status(500).json({ error: 'Invalid node URL' })
  }

  const apiPath = req.url
  const isHttps = targetUrl.protocol === 'https:'
  const transport = isHttps ? httpsRequest : httpRequest

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (isHttps ? 443 : 80),
    path: apiPath,
    method: req.method,
    headers: { ...req.headers, host: targetUrl.host }
  }
  if (node.auth_token) options.headers['Authorization'] = node.auth_token
  delete options.headers['content-length']

  const proxyReq = transport(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
  })
  proxyReq.on('error', (err) => {
    if (!res.headersSent) res.status(502).json({ ok: false, error: { message: 'Node unreachable: ' + err.message } })
  })
  req.pipe(proxyReq)
})

// ══════════════════════════════════════════════════════════════════════════════
// BOT API ROUTES
// ══════════════════════════════════════════════════════════════════════════════

router.get('/bot/plans', async (req, res) => { res.json(await loadPlans()) })

router.post('/bot/plans', parseJson, async (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Array expected' })
  await savePlans(req.body)
  res.json({ ok: true })
})

router.patch('/bot/plans/:id', parseJson, async (req, res) => {
  const plans = await loadPlans()
  const idx = plans.findIndex(p => p.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  plans[idx] = { ...plans[idx], ...req.body }
  await savePlans(plans)
  res.json(plans[idx])
})

router.delete('/bot/plans/:id', async (req, res) => {
  const plans = await loadPlans()
  await savePlans(plans.filter(p => p.id !== req.params.id))
  res.json({ ok: true })
})

router.get('/bot/settings', async (req, res) => {
  try {
    const s = await loadBotSettings()
    res.json({ ...s, bot_token: s.bot_token ? '***' : '' })
  } catch {
    res.json({ bot_token: '', bot_name: 'Telemt Proxy', welcome_text: '', features: '', support_link: '', about_text: '', ref_bonus_days: 3, trial_days: 1, required_channel: '' })
  }
})

router.patch('/bot/settings', parseJson, async (req, res) => {
  try {
    const cur = await loadBotSettings().catch(() => ({}))
    const update = { ...req.body }
    if (update.bot_token === '***') delete update.bot_token
    await saveBotSettings({ ...cur, ...update })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Database unavailable: ' + e.message })
  }
})

router.get('/bot/users', async (req, res) => { res.json(await loadBotUsers()) })

router.get('/bot/users/:telegram_id', async (req, res) => {
  const u = await getBotUser(Number(req.params.telegram_id))
  if (!u) return res.status(404).json({ error: 'Not found' })
  res.json(u)
})

router.patch('/bot/users/:telegram_id', parseJson, async (req, res) => {
  const u = await upsertBotUser(Number(req.params.telegram_id), req.body)
  res.json(u)
})

router.delete('/bot/users/:telegram_id', async (req, res) => {
  await query('DELETE FROM bot_users WHERE telegram_id = $1', [Number(req.params.telegram_id)])
  res.json({ ok: true })
})

router.get('/bot/payments', async (req, res) => { res.json(await loadPayments()) })

router.post('/bot/payments', parseJson, async (req, res) => {
  const p = { id: crypto.randomUUID(), ...req.body, created_at: Date.now() }
  await query(
    'INSERT INTO payments (id, telegram_id, plan_id, amount, status, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
    [p.id, p.telegram_id || null, p.plan_id || null, p.amount || 0, p.status || 'pending', p.created_at]
  )
  res.json(p)
})

router.get('/bot/users/:telegram_id/links', async (req, res) => {
  const telegramId = Number(req.params.telegram_id)
  const user = await getBotUser(telegramId)
  if (!user || !user.proxy_username) return res.json({ links: [] })

  const username = user.proxy_username
  const currentNodes = await loadNodes()
  const allLinks = []

  for (const node of currentNodes) {
    const r = await nodeApiRequest(node, 'GET', `/v1/users/${encodeURIComponent(username)}`, null)
    if (!r.ok) continue
    try {
      const data = JSON.parse(r.body)
      const links = data?.data?.user?.links ?? data?.data?.links ?? data?.links ?? {}
      const tls = (links.tls || []).filter(Boolean)
      const secure = (links.secure || []).filter(Boolean)
      const classic = (links.classic || []).filter(Boolean)
      allLinks.push(...tls, ...secure, ...classic)
    } catch {}
  }

  res.json({ links: [...new Set(allLinks)], username })
})

router.get('/bot/stats', async (req, res) => {
  const now = Date.now()
  const usersR = await query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE subscription_until > $1) as active FROM bot_users', [now])
  const revR = await query(`SELECT COALESCE(SUM(amount),0) as total, COALESCE(SUM(CASE WHEN created_at > $1 THEN amount ELSE 0 END),0) as today FROM payments WHERE status='paid'`, [now - 86400000])
  res.json({
    total_users: Number(usersR.rows[0].total),
    active_subscriptions: Number(usersR.rows[0].active),
    total_revenue: Number(revR.rows[0].total),
    today_revenue: Number(revR.rows[0].today),
  })
})

router.post('/bot/users/:telegram_id/activate', parseJson, async (req, res) => {
  const telegramId = Number(req.params.telegram_id)
  const { plan_id } = req.body
  const plans = await loadPlans()
  const plan = plans.find(p => p.id === plan_id)
  if (!plan) return res.status(400).json({ error: 'Plan not found' })

  const user = await getBotUser(telegramId)
  const username = generateProxyUsername(telegramId)
  const secret = (user && user.proxy_secret) || generateSecret()

  const now = Date.now()
  const currentUntil = (user && user.subscription_until && user.subscription_until > now) ? user.subscription_until : now
  const newUntil = currentUntil + plan.days * 86400000
  const expirationRfc = new Date(newUntil).toISOString()

  const currentNodes = await loadNodes()
  for (const node of currentNodes) {
    const body = { username, secret, enabled: true, expiration_rfc3339: expirationRfc }
    const r = await nodeApiRequest(node, 'POST', '/v1/users', body)
    if (!r.ok) await nodeApiRequest(node, 'POST', `/v1/users/${encodeURIComponent(username)}/rotate-secret`, { secret })
  }

  await saveUser({ username, secret, enabled: true, expiration_rfc3339: expirationRfc })

  const updated = await upsertBotUser(telegramId, {
    proxy_username: username, proxy_secret: secret,
    subscription_until: newUntil, subscription_plan: plan_id, has_access: true
  })
  res.json(updated)
})

router.post('/bot/users/:telegram_id/deactivate', async (req, res) => {
  const telegramId = Number(req.params.telegram_id)
  const username = generateProxyUsername(telegramId)

  const currentNodes = await loadNodes()
  for (const node of currentNodes) {
    const r = await nodeApiRequest(node, 'POST', `/v1/users/${encodeURIComponent(username)}/disable`, null)
    if (!r.ok) await nodeApiRequest(node, 'PATCH', `/v1/users/${encodeURIComponent(username)}`, { enabled: false })
  }

  await query('UPDATE proxy_users SET enabled = FALSE, updated_at = $1 WHERE username = $2', [Date.now(), username])
  const updated = await upsertBotUser(telegramId, { has_access: false, subscription_until: Date.now() })
  res.json(updated)
})

router.post('/bot/users/:telegram_id/trial', async (req, res) => {
  const telegramId = Number(req.params.telegram_id)
  const user = await getBotUser(telegramId)
  if (user && user.trial_used) return res.status(400).json({ error: 'Trial already used' })

  const settings = await loadBotSettings()
  const trialDays = settings.trial_days || 1
  const username = generateProxyUsername(telegramId)
  const secret = generateSecret()
  const newUntil = Date.now() + trialDays * 86400000
  const expirationRfc = new Date(newUntil).toISOString()

  const currentNodes = await loadNodes()
  for (const node of currentNodes) {
    const body = { username, secret, enabled: true, expiration_rfc3339: expirationRfc }
    const r = await nodeApiRequest(node, 'POST', '/v1/users', body)
    if (!r.ok) await nodeApiRequest(node, 'POST', `/v1/users/${encodeURIComponent(username)}/rotate-secret`, { secret })
  }

  await saveUser({ username, secret, enabled: true, expiration_rfc3339: expirationRfc })

  const updated = await upsertBotUser(telegramId, {
    proxy_username: username, proxy_secret: secret,
    subscription_until: newUntil, has_access: true, trial_used: true
  })
  res.json(updated)
})

// ── Mount API router ───────────────────────────────────────────────────────────
// /proxy — production browser requests (no Vite rewrite)
// /     — dev mode (Vite strips /proxy prefix) + bot service-to-service calls

app.use('/proxy', router)
app.use('/', router)

// ── Health check ───────────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ ok: true }))

// ── Serve built React frontend (production) ────────────────────────────────────

const distDir = join(__dirname, '../dist')
if (existsSync(distDir)) {
  const { default: serveStatic } = await import('serve-static')
  app.use(serveStatic(distDir))
  app.get('*', (req, res) => {
    res.sendFile(join(distDir, 'index.html'))
  })
}

// ── Start ──────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 9092

async function main() {
  try {
    await initDb()
  } catch (e) {
    console.error('[db] Failed to initialize database:', e.message)
    if (!process.env.DATABASE_URL) {
      console.warn('[db] DATABASE_URL not set — running without persistent database')
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Panel server running on port ${PORT}`)
  })
}

main()
