import { spawn } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'

// Own the single Vite process directly, avoiding Windows shell process-tree teardown.
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', 'localhost', '--port', '5173', '--strictPort'],
  { stdio: 'pipe', windowsHide: true },
)
let serverOutput = ''
server.stdout.on('data', (chunk) => (serverOutput += String(chunk)))
server.stderr.on('data', (chunk) => (serverOutput += String(chunk)))
try {
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Test server exited: ${serverOutput}`)
    if (!serverOutput.includes('ready in')) {
      await setTimeout(100)
      continue
    }
    try {
      const response = await fetch('http://localhost:5173', { signal: AbortSignal.timeout(500) })
      if (response.ok) {
        ready = true
        break
      }
    } catch {
      /* Wait for the local process. */
    }
    await setTimeout(100)
  }
  if (!ready) throw new Error(`Test server did not start: ${serverOutput}`)
  const runner = spawn(
    process.execPath,
    ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)],
    { stdio: 'inherit', windowsHide: true },
  )
  const code = await new Promise<number>((resolve, reject) => {
    runner.once('error', reject)
    runner.once('exit', (code) => resolve(code ?? 1))
  })
  process.exitCode = code
} finally {
  server.kill()
  server.stdout.destroy()
  server.stderr.destroy()
  server.unref()
}
