import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MOCKS } from '../src/index.js'

/**
 * The mocks never bridge to the service they stand in for.
 *
 * A mock is a local answer. It is not a proxy, and it does not hold
 * credentials, and it does not send a single request to the provider it
 * imitates. That is what keeps the project on the right side of every
 * provider's terms — and it is worth checking rather than promising.
 *
 * The rule this file enforces: no provider's API host appears anywhere in
 * the engine or the command line. Not in a request — there are none — not
 * in a link, and not in a string that could turn into one.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** The hosts the providers answer on. */
const PROVIDER_HOSTS = [
  // Meta
  'graph.facebook.com',
  'api.facebook.com',
  'graph.instagram.com',
  'www.facebook.com',
  'www.instagram.com',
  'instagram.com',
  'facebook.com',
  // X
  'api.x.com',
  'api.twitter.com',
  'twitter.com',
  'x.com',
  // TikTok
  'api.tiktok.com',
  'open.tiktokapis.com',
  'tiktok.com',
  // Google / YouTube
  'googleapis.com',
  'youtube.googleapis.com',
  'youtube.com',
  'youtu.be',
  // LinkedIn
  'api.linkedin.com',
  'linkedin.com',
  // Telegram
  'api.telegram.org',
  'telegram.org',
  // Reddit
  'oauth.reddit.com',
  'api.reddit.com',
  'reddit.com',
  // Bluesky
  'api.bsky.app',
  'public.api.bsky.app',
  'bsky.app',
  // The payments, the messaging and the rest
  'api.paystack.co',
  'api.flutterwave.com',
  'api.monnify.com',
  'api.interswitch.com',
  'api.resend.com',
  'api.xero.com',
  'api.cloudflare.com',
  'onesignal.com',
  'api.twilio.com',
  'api.termii.com',
  'api.openai.com',
  'api.anthropic.com',
  's3.amazonaws.com',
]

/** The files that are checked. */
async function collect(directory) {
  const found = []

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue

    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      found.push(...(await collect(path)))
      continue
    }

    if (entry.name.endsWith('.js')) found.push(path)
  }

  return found
}

test('the engine never names a provider host', async () => {
  const files = [
    ...(await collect(join(ROOT, 'src'))),
    ...(await collect(join(ROOT, 'bin'))),
  ]

  const offenders = []

  for (const path of files) {
    const source = await readFile(path, 'utf8')

    // An XML namespace is an identifier, not an address — nothing ever
    // fetches it. It is left alone.
    const withoutNamespaces = source.replace(/xmlns(:\w+)?="[^"]*"/g, '')

    for (const host of PROVIDER_HOSTS) {
      if (withoutNamespaces.includes(host)) {
        offenders.push(`${relative(ROOT, path)} mentions ${host}`)
      }
    }
  }

  assert.deepEqual(offenders, [], 'a provider host should not appear in the engine')
})

test('the engine makes no request to a fixed host', async () => {
  const files = [...(await collect(join(ROOT, 'src')))]

  const offenders = []

  for (const path of files) {
    const source = await readFile(path, 'utf8')

    // Every fetch() in the engine takes its address from the caller: a
    // webhook the user configured, a notification server the user named.
    // None of them may be a hardcoded address.
    for (const match of source.matchAll(/fetch\(\s*([^,\n)]+)/g)) {
      const argument = match[1].trim()

      const interpolated = argument.startsWith('`') && argument.includes('${')

      if (/^['"]/.test(argument) || (argument.startsWith('`') && !interpolated)) {
        offenders.push(`${relative(ROOT, path)} fetches a fixed address: ${argument}`)
      }
    }
  }

  assert.deepEqual(offenders, [], 'a fetch() in the engine must take its address from the caller')
})

test('every mock has a notice, and the notices say the right things', async () => {
  const notices = await readFile(join(ROOT, 'THIRD-PARTY-NOTICES.md'), 'utf8')

  // Every mock that ships has a notice, so nothing slips in unnamed.
  const unmentioned = Object.keys(MOCKS).filter((name) => !notices.includes(name))

  assert.deepEqual(unmentioned, [], 'these mocks have no entry in the notices')

  assert.match(notices, /not affiliated/i)
  assert.match(notices, /no request/i)
  assert.match(notices, /trademark/i)
})
