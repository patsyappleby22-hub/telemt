import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import crypto from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NODES_FILE = join(__dirname, 'nodes.json')

const app = express()
app.use(express.json())
app.use(express.text({ type: '*/*' }))

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

// --- Node CRUD ---

app.get('/nodes', (req, res) => {
  res.json(nodes.map(n => ({ ...n, auth_token: n.auth_token ? '***' : undefined })))
})

app.post('/nodes', (req, res) => {
  const { name, url, auth_token } = req.body
  if (!name || !url) return res.status(400).json({ error: 'name and url required' })
  const id = crypto.randomUUID()
  const node = { id, name, url: url.replace(/\/$/, ''), auth_token: auth_token || null, created_at: Date.now() }
  nodes.push(node)
  saveNodes(nodes)
  res.json({ ...node, auth_token: auth_token ? '***' : undefined })
})

app.patch('/nodes/:id', (req, res) => {
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
app.post('/tokens', (req, res) => {
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
app.post('/register', (req, res) => {
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

  const script = `#!/bin/bash
set -euo pipefail

# ======================================================
#  Telemt Auto-Install Script
#  Панель: ${safePanel}
#  Нода:   ${safeName}
# ======================================================

PANEL_URL='${safePanel}'
REG_TOKEN='${safeToken}'
NODE_NAME='${safeName}'
API_PORT='${api_port}'
PROXY_PORT='${proxy_port}'
INSTALL_DIR='/opt/telemt'
CONFIG_FILE="$INSTALL_DIR/config.toml"
SERVICE_FILE='/etc/systemd/system/telemt.service'

RED='\\033[0;31m'; GREEN='\\033[0;32m'; YELLOW='\\033[1;33m'; NC='\\033[0m'
info()    { echo -e "\\n${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "\\n${YELLOW}[!]${NC} $*"; }
die()     { echo -e "\\n${RED}[✗]${NC} $*"; exit 1; }

[ "$(id -u)" -ne 0 ] && die "Запускайте скрипт от root: sudo bash setup.sh"

# --- Detect public IP ---
info "Определяю публичный IP..."
PUBLIC_IP=$(curl -fsSL --max-time 5 https://api.ipify.org 2>/dev/null || \\
            curl -fsSL --max-time 5 https://ifconfig.me 2>/dev/null || \\
            hostname -I | awk '{print $1}')
[ -z "$PUBLIC_IP" ] && die "Не удалось определить публичный IP"
info "Публичный IP: $PUBLIC_IP"

# --- Install dependencies ---
info "Устанавливаю зависимости..."
if command -v apt-get &>/dev/null; then
  apt-get update -qq
  apt-get install -y -qq curl wget openssl ca-certificates
elif command -v yum &>/dev/null; then
  yum install -y -q curl wget openssl ca-certificates
fi

# --- Create install directory ---
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# --- Download telemt binary ---
info "Скачиваю telemt..."
ARCH=$(uname -m)
case "$ARCH" in
  x86_64)  ARCH_TAG="x86_64-unknown-linux-musl" ;;
  aarch64) ARCH_TAG="aarch64-unknown-linux-musl" ;;
  *)       die "Неподдерживаемая архитектура: $ARCH" ;;
esac

RELEASE_URL="https://github.com/telemt/telemt/releases/latest/download/telemt-$ARCH_TAG"
if wget -q --timeout=30 -O telemt.tmp "$RELEASE_URL" 2>/dev/null; then
  mv telemt.tmp telemt
  chmod +x telemt
  info "Бинарник скачан"
elif [ -f telemt ]; then
  warn "Не удалось скачать — использую имеющийся бинарник"
else
  die "Бинарник telemt не найден. Скопируйте его в $INSTALL_DIR/telemt вручную и перезапустите скрипт."
fi

# --- Generate secrets ---
SECRET=$(openssl rand -hex 16)
info "Сгенерирован секрет прокси: $SECRET"

# --- Write config ---
info "Создаю конфиг..."
cat > "$CONFIG_FILE" << TOML
[server]
listen = "0.0.0.0:$PROXY_PORT"
workers = 0

[server.api]
listen = "0.0.0.0:$API_PORT"
whitelist = ["0.0.0.0/0"]

[[users]]
username = "default"
secret = "$SECRET"
enabled = true
TOML

# --- Systemd service ---
info "Настраиваю systemd сервис..."
cat > "$SERVICE_FILE" << UNIT
[Unit]
Description=Telemt MTProxy Server
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/telemt $CONFIG_FILE
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT

# --- Firewall ---
if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
  info "Открываю порты в UFW..."
  ufw allow "$API_PORT/tcp"   >/dev/null 2>&1 || true
  ufw allow "$PROXY_PORT/tcp" >/dev/null 2>&1 || true
fi
if command -v firewall-cmd &>/dev/null; then
  info "Открываю порты в firewalld..."
  firewall-cmd --permanent --add-port="$API_PORT/tcp"   >/dev/null 2>&1 || true
  firewall-cmd --permanent --add-port="$PROXY_PORT/tcp" >/dev/null 2>&1 || true
  firewall-cmd --reload >/dev/null 2>&1 || true
fi

# --- Start service ---
info "Запускаю telemt..."
systemctl daemon-reload
systemctl enable telemt >/dev/null 2>&1
systemctl restart telemt

# Wait for API to become available
for i in $(seq 1 15); do
  if curl -fsSL --max-time 2 "http://127.0.0.1:$API_PORT/v1/health" >/dev/null 2>&1; then
    info "API доступен"
    break
  fi
  [ "$i" -eq 15 ] && die "Telemt не запустился за 15 секунд. Проверьте: journalctl -u telemt -n 50"
  sleep 1
done

# --- Register with panel ---
info "Регистрирую ноду в панели..."
REG_RESPONSE=$(curl -fsSL --max-time 10 \\
  -X POST \\
  -H 'Content-Type: application/json' \\
  -d "{\\"token\\":\\"$REG_TOKEN\\",\\"url\\":\\"http://$PUBLIC_IP:$API_PORT\\"}" \\
  "$PANEL_URL/proxy/register" 2>&1)

if echo "$REG_RESPONSE" | grep -q '"ok":true'; then
  info "Нода успешно зарегистрирована в панели!"
else
  warn "Не удалось зарегистрироваться автоматически. Ответ: $REG_RESPONSE"
  warn "Добавьте ноду вручную: http://$PUBLIC_IP:$API_PORT"
fi

# --- Summary ---
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Telemt установлен и запущен!           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  Нода:       $NODE_NAME"
echo "  Публичный IP: $PUBLIC_IP"
echo "  API порт:   $API_PORT"
echo "  Proxy порт: $PROXY_PORT"
echo "  Секрет:     $SECRET"
echo "  Конфиг:     $CONFIG_FILE"
echo ""
echo "  Статус сервиса:"
systemctl status telemt --no-pager -l | head -8 || true
echo ""
`

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.send(script)
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
