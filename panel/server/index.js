import express from 'express'
import { request as httpRequest } from 'http'
import { request as httpsRequest } from 'https'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import crypto from 'crypto'
import {
  loadBotUsers, saveBotUsers, loadPlans, savePlans,
  loadBotSettings, saveBotSettings, loadPayments, savePayments,
  upsertBotUser, getBotUser, generateProxyUsername, generateSecret
} from './bot-db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NODES_FILE = join(__dirname, 'nodes.json')
const USERS_FILE = join(__dirname, 'users.json')

const app = express()

function loadNodes() {
  if (!existsSync(NODES_FILE)) return []
  try { return JSON.parse(readFileSync(NODES_FILE, 'utf8')) } catch { return [] }
}

function saveNodes(nodes) {
  writeFileSync(NODES_FILE, JSON.stringify(nodes, null, 2))
}

function loadUsers() {
  if (!existsSync(USERS_FILE)) return []
  try { return JSON.parse(readFileSync(USERS_FILE, 'utf8')) } catch { return [] }
}

function saveUsers(users) {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}

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
  const users = loadUsers()
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
      // If user already exists — force rotate secret to match registry
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

let nodes = loadNodes()

// In-memory registration tokens: { token -> { name, panel_url, expires_at } }
const regTokens = new Map()

const parseJson = express.json()

// --- Node CRUD ---

app.get('/nodes', (req, res) => {
  res.json(nodes.map(n => ({ ...n, auth_token: n.auth_token ? '***' : undefined })))
})

app.post('/nodes', parseJson, (req, res) => {
  const { name, url, auth_token } = req.body
  if (!name || !url) return res.status(400).json({ error: 'name and url required' })
  const id = crypto.randomUUID()
  const node = { id, name, url: url.replace(/\/$/, ''), auth_token: auth_token || null, created_at: Date.now() }
  nodes.push(node)
  saveNodes(nodes)
  // Auto-sync all known users to the new node (async, don't block response)
  syncUsersToNode(node).catch(e => console.error('[sync] Error:', e.message))
  res.json({ ...node, auth_token: auth_token ? '***' : undefined })
})

app.patch('/nodes/:id', parseJson, (req, res) => {
  const idx = nodes.findIndex(n => n.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  const { name, url, auth_token } = req.body
  if (name) nodes[idx].name = name
  if (url) nodes[idx].url = url.replace(/\/$/, '')
  if (auth_token !== undefined) nodes[idx].auth_token = auth_token || null
  saveNodes(nodes)
  const n = nodes[idx]
  res.json({ ...n, auth_token: n.auth_token ? '***' : undefined })
})

app.delete('/nodes/:id', (req, res) => {
  const idx = nodes.findIndex(n => n.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  nodes.splice(idx, 1)
  saveNodes(nodes)
  res.json({ ok: true })
})

// --- Auto-registration ---

// Create a one-time registration token
app.post('/tokens', parseJson, (req, res) => {
  const { name, panel_url } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  if (!panel_url) return res.status(400).json({ error: 'panel_url required' })
  const token = crypto.randomBytes(24).toString('hex')
  const expires_at = Date.now() + 30 * 60 * 1000 // 30 min
  regTokens.set(token, { name, panel_url, expires_at })
  // Cleanup expired tokens
  for (const [k, v] of regTokens) {
    if (v.expires_at < Date.now()) regTokens.delete(k)
  }
  res.json({ token, expires_at })
})

// VPS calls this after installing telemt to register itself
app.post('/register', parseJson, (req, res) => {
  const { token, url } = req.body
  if (!token) return res.status(400).json({ error: 'token required' })
  if (!url) return res.status(400).json({ error: 'url required' })

  const entry = regTokens.get(token)
  if (!entry) return res.status(401).json({ error: 'Неверный или истёкший токен' })
  if (entry.expires_at < Date.now()) {
    regTokens.delete(token)
    return res.status(401).json({ error: 'Токен истёк' })
  }

  regTokens.delete(token) // one-time use

  const id = crypto.randomUUID()
  const node = { id, name: entry.name, url: url.replace(/\/$/, ''), auth_token: null, created_at: Date.now() }
  nodes.push(node)
  saveNodes(nodes)
  console.log(`[register] New node: ${entry.name} @ ${url}`)
  // Auto-sync all known users to the newly registered node
  setTimeout(() => syncUsersToNode(node).catch(e => console.error('[sync] Error:', e.message)), 2000)
  res.json({ ok: true, node_id: id, name: entry.name })
})

// --- User registry (stores username+secret for cross-node sync) ---

app.get('/users', (req, res) => {
  const users = loadUsers()
  // Never expose secrets over the wire
  res.json(users.map(u => ({ username: u.username, enabled: u.enabled })))
})

app.post('/users', parseJson, (req, res) => {
  const { username, secret, ...settings } = req.body
  if (!username || !secret) return res.status(400).json({ error: 'username and secret required' })
  const users = loadUsers()
  const idx = users.findIndex(u => u.username === username)
  const entry = { username, secret, ...settings, updated_at: Date.now() }
  if (idx >= 0) { users[idx] = entry } else { users.push(entry) }
  saveUsers(users)
  res.json({ ok: true })
})

app.delete('/users/:username', (req, res) => {
  const users = loadUsers()
  saveUsers(users.filter(u => u.username !== req.params.username))
  res.json({ ok: true })
})

// Force re-sync all registry users (with their individual secrets) to all nodes
app.post('/sync', async (req, res) => {
  const currentNodes = loadNodes()
  if (currentNodes.length === 0) return res.json({ ok: true, message: 'No nodes', results: [] })
  const results = []
  for (const node of currentNodes) {
    const users = loadUsers()
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
      if (createRes.ok) {
        created++
        continue
      }

      const isConflict = createRes.status === 409 || createRes.status === 422 ||
        (createRes.body && (createRes.body.includes('exist') || createRes.body.includes('conflict')))

      if (!isConflict) {
        failed++
        nodeErrors.push(`${user.username}: create failed (${createRes.status})`)
        continue
      }

      // User already exists — try rotate-secret first
      const rotRes = await nodeApiRequest(node, 'POST',
        `/v1/users/${encodeURIComponent(user.username)}/rotate-secret`,
        { secret: user.secret })

      if (rotRes.ok) {
        rotated++
        continue
      }

      // rotate-secret not supported or failed — fallback: delete + recreate
      console.log(`[sync] rotate-secret failed for "${user.username}" on node "${node.name}" (${rotRes.status}), trying delete+recreate`)
      const delRes = await nodeApiRequest(node, 'DELETE',
        `/v1/users/${encodeURIComponent(user.username)}`, null)
      if (delRes.ok) {
        const reCreateRes = await nodeApiRequest(node, 'POST', '/v1/users', body)
        if (reCreateRes.ok) {
          recreated++
        } else {
          failed++
          nodeErrors.push(`${user.username}: recreate failed (${reCreateRes.status})`)
        }
      } else {
        failed++
        nodeErrors.push(`${user.username}: delete failed (${delRes.status})`)
      }
    }
    results.push({ node: node.name, created, rotated, recreated, failed, errors: nodeErrors, total: users.length })
    console.log(`[sync] Node "${node.name}": ${created} created, ${rotated} rotated, ${recreated} recreated, ${failed} failed`)
  }
  res.json({ ok: true, results })
})

// Serve the update-only script (no token needed, just updates binary and config)
app.get('/update.sh', (req, res) => {
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
    '# Detect public IP',
    `PUBLIC_IP=$(curl -fsSL --max-time 5 https://api.ipify.org 2>/dev/null || curl -fsSL --max-time 5 https://ifconfig.me 2>/dev/null || ${B}hostname -I | awk '{print $1}'${B})`,
    '[ -z "$PUBLIC_IP" ] && die "Не удалось определить публичный IP"',
    'info "Публичный IP: $PUBLIC_IP"',
    '',
    '# Build latest from source',
    'info "Обновляю исходники telemt..."',
    `cd "$REPO_DIR" && git fetch origin && git reset --hard ${B}git rev-parse origin/HEAD${B}`,
    'info "Собираю telemt (может занять несколько минут)..."',
    'export PATH="$HOME/.cargo/bin:$PATH"',
    'cargo build --release 2>&1 | tail -5',
    'info "Останавливаю сервис для замены бинарника..."',
    'systemctl stop telemt 2>/dev/null || true',
    'cp target/release/telemt "$BINARY"',
    'chmod +x "$BINARY"',
    'info "Версия: $("$BINARY" --version 2>/dev/null || echo ok)"',
    '',
    '# Update public_host in config',
    'if [ -f "$CONFIG_FILE" ]; then',
    '  if grep -qE "^#[[:space:]]*public_host[[:space:]]*=" "$CONFIG_FILE"; then',
    '    sed -i "s|^#[[:space:]]*public_host[[:space:]]*=.*|public_host = \\"$PUBLIC_IP\\"|" "$CONFIG_FILE"',
    '  elif grep -q "^public_host" "$CONFIG_FILE"; then',
    '    sed -i "s|^public_host = .*|public_host = \\"$PUBLIC_IP\\"|" "$CONFIG_FILE"',
    '  elif grep -q "^\\[general\\.links\\]" "$CONFIG_FILE"; then',
    '    sed -i "/^\\[general\\.links\\]/a public_host = \\"$PUBLIC_IP\\"" "$CONFIG_FILE"',
    '  else',
    '    printf "\\n[general.links]\\npublic_host = \\"%s\\"\\n" "$PUBLIC_IP" >> "$CONFIG_FILE"',
    '  fi',
    '  info "public_host = $PUBLIC_IP записан в конфиг"',
    'fi',
    '',
    '# Restart service',
    'systemctl restart telemt',
    'info "Ожидаю запуска..."',
    'for i in $(seq 1 20); do',
    '  systemctl is-active telemt -q && info "Telemt запущен!" && break',
    '  [ "$i" -eq 20 ] && die "Telemt не запустился. Проверьте: journalctl -u telemt -n 50"',
    '  sleep 1',
    'done',
    '',
    'echo ""',
    'echo "========================================"',
    'echo "  Telemt обновлён и перезапущен!"',
    'echo "========================================"',
    'echo "  Публичный IP: $PUBLIC_IP"',
    'echo "  Конфиг:       $CONFIG_FILE"',
    'echo ""',
    'systemctl status telemt --no-pager -l | head -8 || true',
  ]
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.send(lines.join('\n') + '\n')
})

// Serve the install bash script
app.get('/setup.sh', (req, res) => {
  const { token, name, panel_url, api_port = '9091', proxy_port = '8443' } = req.query
  if (!token || !panel_url) {
    return res.status(400).send('# Error: token and panel_url required\n')
  }

  const safeName = (name || 'vps').replace(/[^a-zA-Z0-9_-]/g, '_')
  const safePanel = panel_url.replace(/'/g, '')
  const safeToken = token.replace(/[^a-f0-9]/g, '')

  // Build the script using string array to avoid JS template literal
  // interpolating bash variables like ${GREEN}, ${PUBLIC_IP}, etc.
  const B = '`'  // backtick helper to avoid nesting issues
  const lines = [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    '# ======================================================',
    `#  Telemt Auto-Install Script`,
    `#  Панель: ${safePanel}`,
    `#  Нода:   ${safeName}`,
    '# ======================================================',
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
    'info()    { echo -e "\\n${GREEN}[+]${NC} $*"; }',
    'warn()    { echo -e "\\n${YELLOW}[!]${NC} $*"; }',
    'die()     { echo -e "\\n${RED}[x]${NC} $*"; exit 1; }',
    '',
    '[ "$(id -u)" -ne 0 ] && die "Запускайте скрипт от root: sudo bash setup.sh"',
    '',
    '# --- Detect public IP ---',
    'info "Определяю публичный IP..."',
    'PUBLIC_IP=$(curl -fsSL --max-time 5 https://api.ipify.org 2>/dev/null || \\',
    '            curl -fsSL --max-time 5 https://ifconfig.me 2>/dev/null || \\',
    "            hostname -I | awk '{print $1}')",
    '[ -z "$PUBLIC_IP" ] && die "Не удалось определить публичный IP"',
    'info "Публичный IP: $PUBLIC_IP"',
    '',
    '# --- Install dependencies ---',
    'info "Устанавливаю зависимости..."',
    'DEBIAN_FRONTEND=noninteractive',
    'export DEBIAN_FRONTEND',
    'if command -v apt-get &>/dev/null; then',
    '  apt-get update -qq',
    '  apt-get install -y -qq curl wget git build-essential pkg-config libssl-dev ca-certificates',
    'elif command -v yum &>/dev/null; then',
    '  yum install -y -q curl wget git gcc openssl-devel',
    'elif command -v dnf &>/dev/null; then',
    '  dnf install -y -q curl wget git gcc openssl-devel',
    'fi',
    '',
    '# --- Create install directory ---',
    'mkdir -p "$INSTALL_DIR"',
    'IS_UPDATE=false',
    '[ -f "$INSTALL_DIR/telemt" ] && IS_UPDATE=true',
    '',
    '# --- Install Rust if needed ---',
    'export PATH="$HOME/.cargo/bin:$PATH"',
    'if ! command -v cargo &>/dev/null; then',
    '  info "Устанавливаю Rust..."',
    '  curl -fsSL --retry 3 https://sh.rustup.rs | sh -s -- -y --no-modify-path >/dev/null 2>&1',
    '  export PATH="$HOME/.cargo/bin:$PATH"',
    'fi',
    'cargo --version >/dev/null 2>&1 || die "Не удалось установить Rust. Установите вручную: https://rustup.rs"',
    '',
    '# --- Build/update telemt from source ---',
    'REPO_URL="https://github.com/patsyappleby22-hub/telemt"',
    'SRC_DIR="/opt/telemt-src"',
    'if [ -d "$SRC_DIR/.git" ]; then',
    '  info "Получаю обновления из репозитория..."',
    '  git -C "$SRC_DIR" fetch -q 2>/dev/null || true',
    '  git -C "$SRC_DIR" reset --hard "$(git -C "$SRC_DIR" rev-parse --abbrev-ref origin/HEAD 2>/dev/null || echo origin/main)" -q 2>/dev/null || true',
    'else',
    '  info "Клонирую репозиторий telemt..."',
    '  rm -rf "$SRC_DIR"',
    '  git clone --depth 1 -q "$REPO_URL" "$SRC_DIR" || die "Не удалось клонировать: $REPO_URL"',
    'fi',
    '$IS_UPDATE && { info "Останавливаю старый telemt для обновления..."; systemctl stop telemt 2>/dev/null || true; }',
    'info "Сборка telemt (3-8 мин при первом запуске)..."',
    'cd "$SRC_DIR"',
    'CARGO_BUILD_JOBS=$(nproc) cargo build --release 2>&1 | grep -E "(error\\[|^error|Finished|Compiling telemt)" || true',
    '[ -f "target/release/telemt" ] || die "Сборка не удалась. Проверьте: journalctl -u telemt -n 50"',
    'cp "target/release/telemt" "$INSTALL_DIR/telemt"',
    'chmod +x "$INSTALL_DIR/telemt"',
    'cd "$INSTALL_DIR"',
    'info "Telemt обновлён: $("$INSTALL_DIR/telemt" --version 2>&1 || echo ok)"',
    '',
    '# --- Config: update public_host if exists, create fresh if not ---',
    'SECRET=""',
    'if [ -f "$CONFIG_FILE" ]; then',
    '  info "Конфиг уже есть — обновляю только public_host (пользователи сохранены)..."',
    '  if grep -qE "^#[[:space:]]*public_host[[:space:]]*=" "$CONFIG_FILE"; then',
    '    sed -i "s|^#[[:space:]]*public_host[[:space:]]*=.*|public_host = \\"${PUBLIC_IP}\\"|" "$CONFIG_FILE"',
    '  elif grep -q "^public_host" "$CONFIG_FILE"; then',
    '    sed -i "s|^public_host = .*|public_host = \\"${PUBLIC_IP}\\"|" "$CONFIG_FILE"',
    '  elif grep -q "^\\[general\\.links\\]" "$CONFIG_FILE"; then',
    '    sed -i "/^\\[general\\.links\\]/a public_host = \\"${PUBLIC_IP}\\"" "$CONFIG_FILE"',
    '  else',
    '    sed -i "1s|^|[general.links]\\npublic_host = \\"${PUBLIC_IP}\\"\\n\\n|" "$CONFIG_FILE"',
    '  fi',
    '  info "public_host → ${PUBLIC_IP}"',
    'else',
    '  SECRET=$(openssl rand -hex 16)',
    '  info "Создаю конфиг... Секрет дефолтного пользователя: $SECRET"',
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
    '# --- Systemd service ---',
    'info "Настраиваю systemd сервис..."',
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
    '# --- Firewall ---',
    'if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then',
    '  info "Открываю порты в UFW..."',
    '  ufw allow "${API_PORT}/tcp"   >/dev/null 2>&1 || true',
    '  ufw allow "${PROXY_PORT}/tcp" >/dev/null 2>&1 || true',
    'fi',
    'if command -v firewall-cmd &>/dev/null; then',
    '  info "Открываю порты в firewalld..."',
    '  firewall-cmd --permanent --add-port="${API_PORT}/tcp"   >/dev/null 2>&1 || true',
    '  firewall-cmd --permanent --add-port="${PROXY_PORT}/tcp" >/dev/null 2>&1 || true',
    '  firewall-cmd --reload >/dev/null 2>&1 || true',
    'fi',
    '',
    '# --- Start service ---',
    'info "Запускаю telemt..."',
    'systemctl daemon-reload',
    'systemctl enable telemt >/dev/null 2>&1',
    'systemctl restart telemt',
    '',
    '# Wait for API to come up',
    'for i in $(seq 1 20); do',
    '  if curl -fsSL --max-time 2 "http://127.0.0.1:${API_PORT}/v1/health" >/dev/null 2>&1; then',
    '    info "API доступен"',
    '    break',
    '  fi',
    '  [ "$i" -eq 20 ] && die "Telemt не запустился. Проверьте: journalctl -u telemt -n 50"',
    '  sleep 1',
    'done',
    '',
    '# --- Register with panel (always if token provided) ---',
    'if [ -n "$REG_TOKEN" ]; then',
    '  info "Регистрирую ноду в панели..."',
    '  REG_RESPONSE=$(curl -fsSL --max-time 15 \\',
    '    -X POST \\',
    "    -H 'Content-Type: application/json' \\",
    '    -d "{\\"token\\":\\"${REG_TOKEN}\\",\\"url\\":\\"http://${PUBLIC_IP}:${API_PORT}\\"}" \\',
    '    "${PANEL_URL}/proxy/register" 2>&1)',
    '  if echo "$REG_RESPONSE" | grep -q \'"ok":true\'; then',
    '    info "Нода успешно зарегистрирована в панели!"',
    '  else',
    '    warn "Не удалось зарегистрироваться. Ответ: $REG_RESPONSE"',
    '    warn "Добавьте ноду вручную в панели: http://${PUBLIC_IP}:${API_PORT}"',
    '  fi',
    'fi',
    '',
    '# --- Summary ---',
    'echo ""',
    'if $IS_UPDATE; then',
    '  echo "========================================"',
    '  echo "  Telemt обновлён и перезапущен!"',
    '  echo "========================================"',
    'else',
    '  echo "========================================"',
    '  echo "  Telemt установлен и запущен!"',
    '  echo "========================================"',
    'fi',
    'echo ""',
    'echo "  Нода:         $NODE_NAME"',
    'echo "  Публичный IP: $PUBLIC_IP"',
    'echo "  API порт:     $API_PORT"',
    'echo "  Proxy порт:   $PROXY_PORT"',
    '[ -n "$SECRET" ] && echo "  Секрет default: $SECRET  (сохраните — показывается один раз!)"',
    'echo "  Конфиг:       $CONFIG_FILE"',
    'echo ""',
    'systemctl status telemt --no-pager -l | head -10 || true',
    'echo ""',
  ]

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.send(lines.join('\n') + '\n')
})

// --- Proxy to remote telemt nodes ---

app.use('/nodes/:id/api', (req, res) => {
  const node = nodes.find(n => n.id === req.params.id)
  if (!node) return res.status(404).json({ error: 'Node not found' })

  let targetUrl
  try {
    targetUrl = new URL(node.url)
  } catch {
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

  if (node.auth_token) {
    options.headers['Authorization'] = node.auth_token
  }

  delete options.headers['content-length']

  const proxyReq = transport(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.status(502).json({ ok: false, error: { message: 'Node unreachable: ' + err.message } })
    }
  })

  req.pipe(proxyReq)
})

// ============================================================
// BOT API ROUTES
// ============================================================

// --- Plans ---
app.get('/bot/plans', (req, res) => {
  res.json(loadPlans())
})

app.post('/bot/plans', parseJson, (req, res) => {
  const plans = req.body
  if (!Array.isArray(plans)) return res.status(400).json({ error: 'Array expected' })
  savePlans(plans)
  res.json({ ok: true })
})

app.patch('/bot/plans/:id', parseJson, (req, res) => {
  const plans = loadPlans()
  const idx = plans.findIndex(p => p.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  plans[idx] = { ...plans[idx], ...req.body }
  savePlans(plans)
  res.json(plans[idx])
})

app.delete('/bot/plans/:id', (req, res) => {
  const plans = loadPlans()
  savePlans(plans.filter(p => p.id !== req.params.id))
  res.json({ ok: true })
})

// --- Bot Settings ---
app.get('/bot/settings', (req, res) => {
  const s = loadBotSettings()
  res.json({ ...s, bot_token: s.bot_token ? '***' : '' })
})

app.patch('/bot/settings', parseJson, (req, res) => {
  const cur = loadBotSettings()
  const update = { ...req.body }
  if (update.bot_token === '***') delete update.bot_token
  saveBotSettings({ ...cur, ...update })
  res.json({ ok: true })
})

// --- Bot Users ---
app.get('/bot/users', (req, res) => {
  const users = loadBotUsers()
  res.json(users)
})

app.get('/bot/users/:telegram_id', (req, res) => {
  const u = getBotUser(Number(req.params.telegram_id))
  if (!u) return res.status(404).json({ error: 'Not found' })
  res.json(u)
})

app.patch('/bot/users/:telegram_id', parseJson, (req, res) => {
  const u = upsertBotUser(Number(req.params.telegram_id), req.body)
  res.json(u)
})

app.delete('/bot/users/:telegram_id', (req, res) => {
  const users = loadBotUsers()
  saveBotUsers(users.filter(u => u.telegram_id !== Number(req.params.telegram_id)))
  res.json({ ok: true })
})

// --- Payments ---
app.get('/bot/payments', (req, res) => {
  const payments = loadPayments()
  res.json(payments)
})

app.post('/bot/payments', parseJson, (req, res) => {
  const payments = loadPayments()
  const p = { id: crypto.randomUUID(), ...req.body, created_at: Date.now() }
  payments.push(p)
  savePayments(payments)
  res.json(p)
})

// --- Bot stats summary ---
app.get('/bot/stats', (req, res) => {
  const users = loadBotUsers()
  const payments = loadPayments()
  const now = Date.now()
  const active = users.filter(u => u.subscription_until && u.subscription_until > now).length
  const total = users.length
  const revenue = payments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0)
  const today = payments.filter(p => p.status === 'paid' && p.created_at > now - 86400000).reduce((s, p) => s + (p.amount || 0), 0)
  res.json({ total_users: total, active_subscriptions: active, total_revenue: revenue, today_revenue: today })
})

// --- Bot subscription management (activate/deactivate) ---
app.post('/bot/users/:telegram_id/activate', parseJson, async (req, res) => {
  const telegramId = Number(req.params.telegram_id)
  const { plan_id } = req.body
  const plans = loadPlans()
  const plan = plans.find(p => p.id === plan_id)
  if (!plan) return res.status(400).json({ error: 'Plan not found' })

  const user = getBotUser(telegramId)
  const username = generateProxyUsername(telegramId)
  const secret = (user && user.proxy_secret) || generateSecret()

  const now = Date.now()
  const currentUntil = (user && user.subscription_until && user.subscription_until > now)
    ? user.subscription_until : now
  const newUntil = currentUntil + plan.days * 86400000
  const expirationRfc = new Date(newUntil).toISOString()

  // Sync to all nodes
  const currentNodes = loadNodes()
  for (const node of currentNodes) {
    const body = {
      username,
      secret,
      enabled: true,
      expiration_rfc3339: expirationRfc
    }
    const r = await nodeApiRequest(node, 'POST', '/v1/users', body)
    if (!r.ok) {
      await nodeApiRequest(node, 'POST', `/v1/users/${encodeURIComponent(username)}/rotate-secret`, { secret })
    }
  }

  // Save to central users registry too
  const regUsers = loadUsers()
  const regIdx = regUsers.findIndex(u => u.username === username)
  const regEntry = { username, secret, enabled: true, expiration_rfc3339: expirationRfc }
  if (regIdx >= 0) regUsers[regIdx] = { ...regUsers[regIdx], ...regEntry }
  else regUsers.push(regEntry)
  saveUsers(regUsers)

  const updated = upsertBotUser(telegramId, {
    proxy_username: username,
    proxy_secret: secret,
    subscription_until: newUntil,
    subscription_plan: plan_id,
    has_access: true
  })
  res.json(updated)
})

app.post('/bot/users/:telegram_id/deactivate', async (req, res) => {
  const telegramId = Number(req.params.telegram_id)
  const username = generateProxyUsername(telegramId)

  const currentNodes = loadNodes()
  for (const node of currentNodes) {
    await nodeApiRequest(node, 'PATCH', `/v1/users/${encodeURIComponent(username)}`, { enabled: false })
  }

  const regUsers = loadUsers()
  const regIdx = regUsers.findIndex(u => u.username === username)
  if (regIdx >= 0) { regUsers[regIdx].enabled = false; saveUsers(regUsers) }

  const updated = upsertBotUser(telegramId, { has_access: false })
  res.json(updated)
})

// --- Trial ---
app.post('/bot/users/:telegram_id/trial', async (req, res) => {
  const telegramId = Number(req.params.telegram_id)
  const user = getBotUser(telegramId)
  if (user && user.trial_used) return res.status(400).json({ error: 'Trial already used' })

  const settings = loadBotSettings()
  const trialDays = settings.trial_days || 1
  const username = generateProxyUsername(telegramId)
  const secret = generateSecret()
  const newUntil = Date.now() + trialDays * 86400000
  const expirationRfc = new Date(newUntil).toISOString()

  const currentNodes = loadNodes()
  for (const node of currentNodes) {
    const body = { username, secret, enabled: true, expiration_rfc3339: expirationRfc }
    const r = await nodeApiRequest(node, 'POST', '/v1/users', body)
    if (!r.ok) {
      await nodeApiRequest(node, 'POST', `/v1/users/${encodeURIComponent(username)}/rotate-secret`, { secret })
    }
  }

  const regUsers = loadUsers()
  const regIdx = regUsers.findIndex(u => u.username === username)
  const regEntry = { username, secret, enabled: true, expiration_rfc3339: expirationRfc }
  if (regIdx >= 0) regUsers[regIdx] = { ...regUsers[regIdx], ...regEntry }
  else regUsers.push(regEntry)
  saveUsers(regUsers)

  const updated = upsertBotUser(telegramId, {
    proxy_username: username,
    proxy_secret: secret,
    subscription_until: newUntil,
    has_access: true,
    trial_used: true
  })
  res.json(updated)
})

const PORT = 9092
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Proxy server running on http://127.0.0.1:${PORT}`)
})
