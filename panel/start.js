import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))

function run(name, cmd, args, color, cwd) {
  const proc = spawn(cmd, args, {
    cwd: cwd || __dir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: { ...process.env }
  })
  const pre = `\x1b[${color}m[${name}]\x1b[0m `
  proc.stdout.on('data', d => process.stdout.write(pre + d))
  proc.stderr.on('data', d => process.stderr.write(pre + d))
  proc.on('exit', code => {
    if (code !== 0 && code !== null) {
      console.error(pre + `завершился с кодом ${code}`)
    }
  })
  return proc
}

run('proxy', 'node', ['server/index.js'], '36')

setTimeout(() => {
  run('vite', 'node', ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', '5000'], '35')
}, 300)

// Start Telegram bot (won't crash app if bot not configured)
setTimeout(() => {
  const botDir = join(__dir, '../bot')
  run('bot', 'node', ['bot.js'], '33', botDir)
}, 2000)
