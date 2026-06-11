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

function loadNodes() {
  if (!existsSync(NODES_FILE)) return []
  try { return JSON.parse(readFileSync(NODES_FILE, 'utf8')) } catch { return [] }
}

function saveNodes(nodes) {
  writeFileSync(NODES_FILE, JSON.stringify(nodes, null, 2))
}

let nodes = loadNodes()

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
