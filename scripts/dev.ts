import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'

const children: ChildProcess[] = []
let shutting_down = false

function start(command: string, args: string[]): ChildProcess {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
  })
  children.push(child)
  child.on('exit', (code, signal) => {
    if (shutting_down) {
      return
    }
    console.error(`[dev] child exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`)
    void shutdown(code ?? 1)
  })
  return child
}

async function shutdown(code = 0): Promise<void> {
  if (shutting_down) {
    return
  }
  shutting_down = true
  for (const child of children) {
    child.kill('SIGTERM')
  }
  await new Promise((resolve) => setTimeout(resolve, 200))
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
    }
  }
  process.exit(code)
}

const vite_bin = path.resolve('node_modules/vite/bin/vite.js')

start(process.execPath, [
  '--watch',
  '--watch-preserve-output',
  '--import',
  'tsx',
  '--env-file-if-exists=.env.development',
  'src/server/index.ts',
])

start(process.execPath, [vite_bin, '--host', '127.0.0.1'])

process.once('SIGINT', () => { void shutdown(0) })
process.once('SIGTERM', () => { void shutdown(0) })
