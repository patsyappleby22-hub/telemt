import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import crypto from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NODES_FILE = join(__dirname, 'nodes.json')

const app = express()

function loadNodes() {
  if (!existsSync(NODES_FILE)) return []
  try { return JSON.parse(readFileSync(NODES_FILE, 'utf8')) } catch { return [] }
}

function saveNodes(nodes) {
  writeFileSync(NODES_FILE, JSON.stringify(nodes, null, 2))
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
  res.json({ ok: true, node_id: id, name: entry.name })
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
    '',
    '# --- Install or reuse telemt binary ---',
    'if [ -f "$INSTALL_DIR/telemt" ] && "$INSTALL_DIR/telemt" --version >/dev/null 2>&1; then',
    '  info "Telemt уже установлен: $("$INSTALL_DIR/telemt" --version 2>&1 || echo "ok") — пропускаю сборку"',
    'elif command -v telemt &>/dev/null; then',
    '  info "Telemt найден в PATH — копирую в $INSTALL_DIR"',
    '  cp "$(command -v telemt)" "$INSTALL_DIR/telemt"',
    '  chmod +x "$INSTALL_DIR/telemt"',
    'else',
    '  info "Telemt не найден — собираю из исходников (3-8 мин)..."',
    '  # Install Rust',
    '  if ! command -v cargo &>/dev/null && [ ! -f "$HOME/.cargo/bin/cargo" ]; then',
    '    info "Устанавливаю Rust..."',
    '    curl -fsSL --retry 3 https://sh.rustup.rs | sh -s -- -y --no-modify-path >/dev/null 2>&1',
    '  fi',
    '  export PATH="$HOME/.cargo/bin:$PATH"',
    '  cargo --version >/dev/null 2>&1 || die "Не удалось установить Rust. Установите вручную: https://rustup.rs"',
    '  info "Rust: $(cargo --version)"',
    '  # Clone source',
    '  REPO_URL="https://github.com/patsyappleby22-hub/telemt"',
    '  SRC_DIR="/opt/telemt-src"',
    '  if [ -d "$SRC_DIR/.git" ]; then',
    '    git -C "$SRC_DIR" pull --ff-only -q 2>/dev/null || true',
    '  else',
    '    rm -rf "$SRC_DIR"',
    '    git clone --depth 1 -q "$REPO_URL" "$SRC_DIR" || die "Не удалось клонировать: $REPO_URL"',
    '  fi',
    '  # Build',
    '  cd "$SRC_DIR"',
    '  CARGO_BUILD_JOBS=$(nproc) cargo build --release 2>&1 | grep -E "(error\\[|^error|Finished|Compiling telemt)" || true',
    '  [ -f "target/release/telemt" ] || die "Сборка не удалась. Проверьте: journalctl и повторите скрипт."',
    '  cp "target/release/telemt" "$INSTALL_DIR/telemt"',
    '  chmod +x "$INSTALL_DIR/telemt"',
    '  cd "$INSTALL_DIR"',
    '  info "Telemt собран и установлен"',
    'fi',
    '',
    '# --- Generate secret ---',
    'SECRET=$(openssl rand -hex 16)',
    'info "Сгенерирован секрет прокси: $SECRET"',
    '',
    '# --- Write config ---',
    'info "Создаю конфиг..."',
    'cat > "$CONFIG_FILE" << EOF',
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
    '# --- Register with panel ---',
    'info "Регистрирую ноду в панели..."',
    'REG_RESPONSE=$(curl -fsSL --max-time 15 \\',
    '  -X POST \\',
    "  -H 'Content-Type: application/json' \\",
    '  -d "{\\"token\\":\\"${REG_TOKEN}\\",\\"url\\":\\"http://${PUBLIC_IP}:${API_PORT}\\"}" \\',
    '  "${PANEL_URL}/proxy/register" 2>&1)',
    '',
    'if echo "$REG_RESPONSE" | grep -q \'"ok":true\'; then',
    '  info "Нода успешно зарегистрирована в панели!"',
    'else',
    '  warn "Не удалось зарегистрироваться. Ответ: $REG_RESPONSE"',
    '  warn "Добавьте ноду вручную: http://${PUBLIC_IP}:${API_PORT}"',
    'fi',
    '',
    '# --- Summary ---',
    'echo ""',
    'echo "========================================"',
    'echo "  Telemt установлен и запущен!"',
    'echo "========================================"',
    'echo ""',
    'echo "  Нода:         $NODE_NAME"',
    'echo "  Публичный IP: $PUBLIC_IP"',
    'echo "  API порт:     $API_PORT"',
    'echo "  Proxy порт:   $PROXY_PORT"',
    'echo "  Секрет:       $SECRET"',
    'echo "  Конфиг:       $CONFIG_FILE"',
    'echo ""',
    'systemctl status telemt --no-pager -l | head -10 || true',
    'echo ""',
  ]

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.send(lines.join('\n') + '\n')
})

// --- Proxy to remote telemt nodes ---

app.use('/nodes/:id/api', (req, res, next) => {
  const node = nodes.find(n => n.id === req.params.id)
  if (!node) return res.status(404).json({ error: 'Node not found' })

  const proxy = createProxyMiddleware({
    target: node.url,
    changeOrigin: true,
    pathRewrite: (path) => path.replace(`/nodes/${req.params.id}/api`, ''),
    on: {
      proxyReq: (proxyReq) => {
        if (node.auth_token) {
          proxyReq.setHeader('Authorization', node.auth_token)
        }
      },
      error: (err, req, res) => {
        res.status(502).json({ ok: false, error: { message: 'Node unreachable: ' + err.message } })
      }
    }
  })
  proxy(req, res, next)
})

const PORT = 9092
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Proxy server running on http://127.0.0.1:${PORT}`)
})
