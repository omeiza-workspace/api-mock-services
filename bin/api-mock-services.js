#!/usr/bin/env node
import { MOCKS, startMock } from '../src/index.js'

/**
 * The command line.
 *
 *   api-mock-services start stripe resend
 *   api-mock-services start stripe --port 4100
 *   api-mock-services list
 *
 * Once the mocks are running, they can be driven from another terminal:
 *
 *   api-mock-services pay stripe failed
 *   api-mock-services error stripe 500
 *   api-mock-services webhook stripe resend
 *   api-mock-services logs stripe
 */

const [, , command = 'list', ...rest] = process.argv

/** Which environment variable points an app at each mock. */
const POINTERS = {
  stripe: 'NUXT_STRIPE_API_BASE={url}/v1',
  resend: 'NUXT_RESEND_API_BASE={url}',
  xero: 'NUXT_XERO_API_BASE={url}/api.xro/2.0',
  cloudflare: 'NUXT_CLOUDFLARE_API_BASE={url}/client/v4',
  paystack: 'PAYSTACK_API_URL={url}',
  interswitch: 'INTERSWITCH_API_URL={url}',
  youverify: 'YOUVERIFY_API_URL={url}',
  onesignal: 'ONESIGNAL_API_URL={url}',
  twilio: 'TWILIO_API_URL={url}',
}

/** Where a running mock is, so the control commands can find it. */
const REGISTRY = new URL('../.mocks.json', import.meta.url)

async function remember(name, url) {
  const { readFile, writeFile } = await import('node:fs/promises')

  let registry = {}

  try {
    registry = JSON.parse(await readFile(REGISTRY, 'utf8'))
  } catch {
    registry = {}
  }

  registry[name] = url

  await writeFile(REGISTRY, JSON.stringify(registry, null, 2))
}

async function find(name) {
  const { readFile } = await import('node:fs/promises')

  let registry = {}

  try {
    registry = JSON.parse(await readFile(REGISTRY, 'utf8'))
  } catch {
    registry = {}
  }

  return registry[name] ?? null
}

function parseOptions(args) {
  const options = { port: undefined, names: [] }

  // The container sets the port through the environment.
  const fromEnv = process.env.PORT ? Number(process.env.PORT) : undefined

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]

    if (argument === '--port' || argument === '-p') {
      options.port = Number(args[index + 1])
      index += 1
    } else if (argument.startsWith('--port=')) {
      options.port = Number(argument.split('=')[1])
    } else {
      options.names.push(argument)
    }
  }

  if (options.port === undefined) options.port = fromEnv

  return options
}

async function start() {
  const options = parseOptions(rest)

  if (!options.names.length) {
    console.error('Which mocks? Try one of:', Object.keys(MOCKS).join(', '))
    process.exit(1)
  }

  let base = options.port ?? 0

  for (const name of options.names) {
    if (!MOCKS[name]) {
      console.error(
        `There is no mock called "${name}". The ones there are: ${Object.keys(MOCKS).join(', ')}.`,
      )
      process.exit(1)
    }

    const port = options.port ?? MOCKS[name].port ?? base
    const service = await startMock(name, { port })

    base = port + 1

    const pointer = POINTERS[name]?.replace('{url}', service.url) ?? service.url

    console.log(`${name} — ${service.url}`)
    console.log(`  ${pointer}`)

    await remember(name, service.url)
  }

  const stop = () => {
    console.log('\nStopping the mocks.')
    process.exit(0)
  }

  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

/** Ask a running mock to do something. */
async function control(path, body) {
  const name = rest[0]
  const url = await find(name)

  if (!url) {
    console.error(`The "${name}" mock is not running. Start it first.`)
    process.exit(1)
  }

  const res = await fetch(`${url}/_control/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()

  console.log(JSON.stringify(data, null, 2))
}

async function logs() {
  const name = rest[0]
  const url = await find(name)

  if (!url) {
    console.error(`The "${name}" mock is not running. Start it first.`)
    process.exit(1)
  }

  const res = await fetch(`${url}/_control/logs`)

  console.log('Watching the requests. Ctrl-C to stop.')

  for await (const chunk of res.body) {
    process.stdout.write(chunk)
  }
}

function list() {
  console.log('The mocks there are:\n')

  for (const [name, entry] of Object.entries(MOCKS)) {
    console.log(`  ${name.padEnd(14)} ${entry.description} (port ${entry.port})`)
  }

  console.log('\nStart one:       api-mock-services start <name>')
  console.log('Start several:   api-mock-services start <name> <name>')
  console.log('\nWhile it runs:')
  console.log('  api-mock-services pay <name> success|failed|cancelled')
  console.log('  api-mock-services error <name> server|unauthorised|unavailable|timeout|network')
  console.log('  api-mock-services webhook <name> resend')
  console.log('  api-mock-services logs <name>')
}

if (command === 'start') {
  await start()
} else if (command === 'list') {
  list()
} else if (command === 'pay') {
  await control('outcome', { outcome: rest[1] ?? 'success' })
} else if (command === 'error') {
  await control('fail', { kind: rest[1] ?? 'server', times: Number(rest[2] ?? 1) })
} else if (command === 'webhook') {
  await control('webhook', { send: true })
} else if (command === 'reset') {
  await control('reset')
} else if (command === 'logs') {
  await logs()
} else {
  console.error('Unknown command. Try "list" or "start".')
  process.exit(1)
}
