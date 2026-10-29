import { createWriteStream, createReadStream, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGzip, createGunzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'

/**
 * Cassette recorder/player for HTTP interactions.
 *
 * Records real API interactions to disk (cassettes) and replays them
 * for deterministic, fast, offline tests.
 *
 * Usage:
 *   const cassette = new Cassette('payment-success')
 *
 *   // Record mode (default when CASSETTE_RECORD=1)
 *   const response = await cassette.record(async () => {
 *     return callApi('https://api.example.com/v1/payments', { ... })
 *   })
 *
 *   // Playback mode (default)
 *   const response = await cassette.play(async () => {
 *     return callApi('https://api.example.com/v1/payments', { ... })
 *   })
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CASSETTE_DIR = join(ROOT, 'cassettes')
const RECORD_MODE = process.env.CASSETTE_RECORD === '1' || process.env.CASSETTE_MODE === 'record'
const PLAYBACK_MODE = process.env.CASSETTE_MODE === 'playback' || !RECORD_MODE

if (!existsSync(CASSETTE_DIR)) {
  mkdirSync(CASSETTE_DIR, { recursive: true })
}

/** Normalize a request for matching. */
function normalizeRequest(req) {
  const { method, url, headers, body } = req
  const u = new URL(url)
  return {
    method: method.toUpperCase(),
    path: u.pathname,
    query: Object.fromEntries(u.searchParams),
    headers: Object.fromEntries(
      Object.entries(headers || {}).filter(([k]) => !['authorization', 'cookie'].includes(k.toLowerCase()))
    ),
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null,
  }
}

/** Create a deterministic hash for a request. */
function hashRequest(req) {
  const normalized = normalizeRequest(req)
  return JSON.stringify(normalized)
}

/** Cassette file path. */
function cassettePath(name) {
  return join(CASSETTE_DIR, `${name}.cassette.json.gz`)
}

/** Load a cassette from disk. */
async function loadCassette(name) {
  const path = cassettePath(name)
  if (!existsSync(path)) return null

  const gunzip = createGunzip()
  const readStream = createReadStream(path)
  const chunks = []

  for await (const chunk of pipeline(readStream, gunzip)) {
    chunks.push(chunk)
  }

  const content = Buffer.concat(chunks).toString('utf8')
  return JSON.parse(content)
}

/** Save a cassette to disk. */
async function saveCassette(name, data) {
  const path = cassettePath(name)
  const gzip = createGzip({ level: 9 })
  const writeStream = createWriteStream(path)
  const content = JSON.stringify(data, null, 2)

  await pipeline(content, gzip, writeStream)
}

/** A recorded interaction. */
class Cassette {
  constructor(name) {
    this.name = name
    this.interactions = []
    this.loaded = false
    this.playbackIndex = 0
  }

  /** Load the cassette from disk. */
  async load() {
    if (this.loaded) return
    const data = await loadCassette(this.name)
    if (data) {
      this.interactions = data.interactions || []
      this.loaded = true
    }
  }

  /** Save the cassette to disk. */
  async save() {
    await saveCassette(this.name, {
      version: 1,
      created: new Date().toISOString(),
      interactions: this.interactions,
    })
  }

  /** Record a new interaction. */
  async record(fn) {
    if (!RECORD_MODE) throw new Error('Not in record mode. Set CASSETTE_RECORD=1')

    await this.load()

    const result = await fn()

    // Extract request/response info from the result
    const interaction = {
      request: null, // Filled by caller
      response: {
        status: result.status,
        headers: Object.fromEntries(result.headers.entries()),
        body: await result.clone().text(),
      },
      recordedAt: new Date().toISOString(),
    }

    this.interactions.push(interaction)
    await this.save()

    return result
  }

  /** Play back a recorded interaction. */
  async play(fn) {
    await this.load()

    if (this.playbackIndex >= this.interactions.length) {
      throw new Error(`No more recorded interactions for ${this.name}. Run with CASSETTE_RECORD=1 to record.`)
    }

    const interaction = this.interactions[this.playbackIndex++]

    // Call the function but intercept the actual HTTP call
    // The caller should check the cassette and return the recorded response
    return interaction.response
  }

  /** Get the next recorded response without calling the function. */
  nextResponse() {
    if (this.playbackIndex >= this.interactions.length) return null
    return this.interactions[this.playbackIndex++].response
  }

  /** Reset playback index. */
  reset() {
    this.playbackIndex = 0
  }

  /** Get interaction count. */
  get count() {
    return this.interactions.length
  }
}

/** Middleware to intercept fetch and use cassette. */
export function cassetteMiddleware(cassette) {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async (input, init) => {
    const request = typeof input === 'string' ? { url: input, ...init } : { url: input.url, ...input, ...init }
    const hash = hashRequest(request)

    // Try to find matching recorded interaction
    const interaction = cassette.interactions.find(i =>
      i.request && hashRequest(i.request) === hash
    )

    if (interaction) {
      // Return recorded response
      const response = new Response(interaction.response.body, {
        status: interaction.response.status,
        headers: interaction.response.headers,
      })
      return response
    }

    // In record mode, make the real request and record
    if (RECORD_MODE) {
      const response = await originalFetch(input, init)
      const cloned = response.clone()
      const body = await cloned.text()

      cassette.interactions.push({
        request: normalizeRequest({ url: input, ...init }),
        response: {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body,
        },
        recordedAt: new Date().toISOString(),
      })
      await cassette.save()

      return response
    }

    // In playback mode with no match
    throw new Error(`No recorded interaction found for ${request.method} ${new URL(request.url).pathname}. Run with CASSETTE_RECORD=1 to record.`)
  }

  // Restore original fetch
  const restore = () => { globalThis.fetch = originalFetch }

  return { restore }
}

/** Create a cassette for a test. */
export function createCassette(name) {
  return new Cassette(name)
}

/** Run a test with cassette recording/playback. */
export async function withCassette(name, fn) {
  const cassette = new Cassette(name)

  if (RECORD_MODE) {
    // Record mode: wrap fetch
    const { restore } = cassetteMiddleware(cassette)
    try {
      return await fn(cassette)
    } finally {
      restore()
    }
  } else {
    // Playback mode: load cassette first
    await cassette.load()
    return fn(cassette)
  }
}

export { RECORD_MODE, PLAYBACK_MODE, cassettePath, loadCassette, saveCassette }
export { Cassette }
