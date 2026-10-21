#!/usr/bin/env node
import { MOCKS, CATEGORIES, startMock, createSpecMockFromFile } from '../src/index.js'

/**
 * The command line.
 *
 *   api-mock-services start stripe resend
 *   api-mock-services start stripe --port 4100
 *   api-mock-services file ./mocks/acme.json
 *   api-mock-services list
 *
 * Once the mocks are running, they can be driven from another terminal:
 *
 *   api-mock-services pay stripe failed
 *   api-mock-services error stripe server
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
  flutterwave: 'FLUTTERWAVE_API_URL={url}/v3',
  monnify: 'MONNIFY_API_URL={url}',
  termii: 'TERMII_API_URL={url}',
  smileid: 'SMILEID_API_URL={url}',
  identitypass: 'IDENTITYPASS_API_URL={url}',
  whatsapp: 'WHATSAPP_API_URL={url}',
  fcm: 'FCM_API_URL={url}',
  openai: 'OPENAI_API_BASE={url}/v1',
  s3: 'S3_ENDPOINT={url}',
}

/** Where a running mock is, so the control commands can find it. */
const REGISTRY = new URL('../.mocks.json', import.meta.url)

/**
 * Where the money goes.
 *
 * Printed once, when the mocks start — the moment a developer is happiest
 * with the tool.
 */
const SUPPORT = [
  '',
  'Enjoying the mocks? The maintenance is paid for by sponsorship:',
  '  GitHub Sponsors  https://github.com/sponsors/omeiza-workspace',
  '  Buy Me a Coffee  https://buymeacoffee.com/omeiza-workspace',
  '',
]

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
  const options = { port: undefined, names: [], file: undefined }

  // The container sets the port through the environment.
  const fromEnv = process.env.PORT ? Number(process.env.PORT) : undefined

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]

    if (argument === '--port' || argument === '-p') {
      options.port = Number(args[index + 1])
      index += 1
    } else if (argument.startsWith('--port=')) {
      options.port = Number(argument.split('=')[1])
    } else if (argument === '--file' || argument === '-f') {
      options.file = args[index + 1]
      index += 1
    } else if (argument.startsWith('--file=')) {
      options.file = argument.split('=')[1]
    } else {
      options.names.push(argument)
    }
  }

  if (options.port === undefined) options.port = fromEnv

  return options
}

/** Say where a mock is, and how to point an app at it. */
function announce(name, service, pointer) {
  console.log(`${name} — ${service.url}`)
  console.log(`  ${pointer ?? service.url}`)
  console.log(`  ${service.url}/_panel`)
}

async function start() {
  const options = parseOptions(rest)

  const started = []

  // The address to listen on. It is loopback by default, so a mock on a
  // laptop is not on the network. A container sets HOST, because a published
  // port has to be reachable from outside the container.
  const host = process.env.HOST ?? '127.0.0.1'

  // A mock written as a route file, rather than as code.
  const file = options.file ?? (command === 'file' ? rest[0] : undefined)

  if (file) {
    const service = await createSpecMockFromFile(file)

    await service.listen(options.port ?? 0, host)

    const name = service.name

    announce(name, service, POINTERS[name])
    await remember(name, service.url)

    started.push(service)
    wait(started)

    return
  }

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
    const service = await startMock(name, { port, host })

    base = port + 1

    announce(name, service, POINTERS[name]?.replace('{url}', service.url))

    await remember(name, service.url)

    started.push(service)
  }

  wait(started)
}

/** Stay up until the mocks are stopped. */
function wait(services = []) {
  console.log(SUPPORT.join('\n'))

  const stop = async () => {
    console.log('\nStopping the mocks.')

    // The ports are freed properly, so nothing is left behind.
    for (const service of services) {
      await service.close().catch(() => {})
    }

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

/**
 * The environment for the whole stack.
 *
 * One line, and the application points at every mock:
 *
 *   eval $(api-mock-services env)
 */
function env() {
  for (const [name, pointer] of Object.entries(POINTERS)) {
    const port = MOCKS[name]?.port

    if (!port) continue

    console.log(`export ${pointer.replace('{url}', `http://127.0.0.1:${port}`)}`)
  }
}

function list() {
  console.log('The mocks there are:\n')

  const grouped = {}

  for (const [name, entry] of Object.entries(MOCKS)) {
    const category = entry.category ?? 'other'

    grouped[category] = grouped[category] ?? []
    grouped[category].push([name, entry])
  }

  for (const [category, entries] of Object.entries(grouped)) {
    const title = CATEGORIES[category]?.title ?? category

    console.log(`  ${title}`)

    for (const [name, entry] of entries) {
      console.log(`    ${name.padEnd(14)} ${entry.description} (port ${entry.port})`)
    }

    console.log('')
  }

  console.log('Start one:       api-mock-services start <name>')
  console.log('Start several:   api-mock-services start <name> <name>')
  console.log('From a file:     api-mock-services file ./mocks/acme.json')
  console.log('\nWhile it runs:')
  console.log('  api-mock-services pay <name> success|failed|cancelled')
  console.log('  api-mock-services error <name> server|unauthorised|unavailable|timeout|network')
  console.log('  api-mock-services webhook <name> resend')
  console.log('  api-mock-services reset <name>')
  console.log('  api-mock-services logs <name>')
}

if (command === 'start') {
  await start()
} else if (command === 'file') {
  await start()
} else if (command === 'list') {
  list()
} else if (command === 'env') {
  env()
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
