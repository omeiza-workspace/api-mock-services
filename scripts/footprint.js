#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

/**
 * The footprint.
 *
 * The promise in the README is that the mocks are light: one process, about
 * 50MB, and nothing at all at rest. A promise nobody checks is a promise
 * that erodes — so the numbers are measured here, and a regression fails.
 *
 *   node scripts/footprint.js
 *
 * The budgets are deliberately loose. They catch a regression that adds a
 * runtime, not a difference between two machines.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const MAX_MEMORY_MB = Number(process.env.MAX_MEMORY_MB ?? 100)
const MAX_STARTUP_MS = Number(process.env.MAX_STARTUP_MS ?? 5000)
const MAX_IDLE_CPU = Number(process.env.MAX_IDLE_CPU ?? 2)

/**
 * How long to watch the process while it does nothing.
 *
 * This was three seconds, and that was too short to be a measurement. The
 * process uses a trickle of CPU — around half a percent — and over a
 * three-second window that trickle lands anywhere between 0% and 2% depending
 * on what the operating system happened to schedule. The gate then failed
 * two runs in three, which is the worst possible behaviour for a gate: a
 * build that fails sometimes teaches people to retry it instead of reading
 * it.
 *
 * Ten seconds takes the same reading and puts the noise floor an order of
 * magnitude lower. The budget then sits four times above the measured value
 * and four times below the regression it exists to catch.
 */
const IDLE_WINDOW_MS = Number(process.env.IDLE_WINDOW_MS ?? 10000)

/**
 * The port the run starts on.
 *
 * The mocks' own ports are left alone, so a footprint run never takes a
 * port that a mock somebody else is using already has.
 */
const FIRST_PORT = Number(process.env.FOOTPRINT_PORT ?? 4500)

/** The mocks that are started to measure them. */
const MOCKS = [
  'stripe',
  'resend',
  'xero',
  'cloudflare',
  'paystack',
  'interswitch',
  'youverify',
  'onesignal',
  'twilio',
  'flutterwave',
  'monnify',
  'termii',
  'smileid',
  'identitypass',
  'whatsapp',
  'fcm',
  'openai',
  's3',
]

/**
 * The resident set of a process, in kilobytes.
 *
 * Zero when the process is gone — the caller decides whether that is a
 * problem.
 */
function memoryKb(pid) {
  try {
    const out = execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' })

    return Number(out.trim())
  } catch {
    return 0
  }
}

/** The time a process has used, as [[dd-]hh:]mm:ss. */
function cpuSeconds(pid) {
  try {
    const out = execFileSync('ps', ['-o', 'time=', '-p', String(pid)], { encoding: 'utf8' }).trim()

    const parts = out.split(':').map(Number)

    return parts.reduce((total, part) => total * 60 + part, 0)
  } catch {
    return 0
  }
}

const child = spawn(
  process.execPath,
  [join(ROOT, 'bin/api-mock-services.js'), 'start', ...MOCKS, '--port', String(FIRST_PORT)],
  {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'pipe'],
    // The run brings its own port, so an inherited PORT would fight it.
    env: { ...process.env, PORT: undefined, HOST: undefined },
  },
)

let complaint = ''

child.stderr?.on('data', (chunk) => {
  complaint += chunk.toString()
})

const stop = () => {
  child.kill('SIGTERM')
}

process.on('exit', stop)

// Wait for the first mock to answer, and time it.
const started = Date.now()
let startupMs = null

while (Date.now() - started < MAX_STARTUP_MS * 2) {
  if (child.exitCode !== null) {
    console.error('[footprint] the mocks stopped before they came up')
    console.error(complaint.trim() || 'the command exited with no message')

    process.exit(1)
  }

  try {
    const res = await fetch(`http://127.0.0.1:${FIRST_PORT}/health`)

    if (res.ok) {
      startupMs = Date.now() - started
      break
    }
  } catch {
    // Not up yet.
  }

  await new Promise((resolve) => setTimeout(resolve, 50))
}

if (startupMs === null) {
  console.error('[footprint] the mocks did not come up')
  process.exit(1)
}

// How much memory, and how much CPU while nothing is happening.
const memoryMb = Math.round(memoryKb(child.pid) / 1024)

const cpuBefore = cpuSeconds(child.pid)

await new Promise((resolve) => setTimeout(resolve, IDLE_WINDOW_MS))

const idleCpu = Number(
  (((cpuSeconds(child.pid) - cpuBefore) / (IDLE_WINDOW_MS / 1000)) * 100).toFixed(2),
)

stop()

console.log('')
console.log(`  mocks       ${MOCKS.length} in one process`)
console.log(`  memory      ${memoryMb} MB`)
console.log(`  idle CPU    ${idleCpu}%  (over a ${IDLE_WINDOW_MS / 1000}s window)`)
console.log(`  startup     ${startupMs} ms`)
console.log('')
console.log(
  `  budgets: memory <= ${MAX_MEMORY_MB} MB, startup <= ${MAX_STARTUP_MS} ms, idle CPU <= ${MAX_IDLE_CPU}%`,
)
console.log('')

const failures = []

if (memoryMb > MAX_MEMORY_MB) {
  failures.push(`the mocks use ${memoryMb} MB, over the ${MAX_MEMORY_MB} MB budget`)
}

if (startupMs > MAX_STARTUP_MS) {
  failures.push(`the mocks took ${startupMs} ms to answer, over the ${MAX_STARTUP_MS} ms budget`)
}

if (idleCpu > MAX_IDLE_CPU) {
  failures.push(`the mocks used ${idleCpu}% CPU while idle, over the ${MAX_IDLE_CPU}% budget`)
}

if (failures.length) {
  for (const failure of failures) {
    console.error(`[footprint] FAIL: ${failure}`)
  }

  process.exit(1)
}

console.log('[footprint] OK: the mocks are within their budget')
