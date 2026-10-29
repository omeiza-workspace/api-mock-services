import { createServer } from 'node:http'
import { trackServer, untrackServer } from './shutdown.js'

/**
 * The harness every mock is built on.
 *
 * A mock service answers like the real one and remembers what it was asked,
 * so a test can say "the refund went to Stripe with the right payment
 * intent" rather than only "it did not throw".
 *
 * There is no framework here and no dependencies: the same file runs in a
 * test, in a container, and on a laptop.
 *
 * Three things every mock gets:
 *
 * - **The requests are recorded**, so a test can look at what really
 *   happened.
 * - **The next call can be made to fail** — a 500, a timeout, a dropped
 *   socket — because the failure paths are the ones worth testing.
 * - **The outcome can be chosen** — a card payment that succeeds, fails or
 *   is cancelled — so both sides of the flow can be walked.
 */

/** A request, as the mock's handlers see it. */
export class MockRequest {
  constructor(init) {
    this.method = init.method
    this.path = init.path
    this.query = init.query
    this.headers = init.headers
    this.body = init.body
    this.raw = init.raw
    this.json = init.json
    this.params = init.params ?? {}
  }
}

/**
 * Put the bracketed keys back where they belong.
 *
 * Stripe sends nested things as flat keys: `metadata[saleId]=4`. A form
 * that is read as a flat object loses them, so they are put back into the
 * object they belong to.
 */
export function expandBrackets(form) {
  const out = {}

  for (const [key, value] of Object.entries(form)) {
    const match = key.match(/^([^\[]+)\[([^\]]+)\]$/)

    if (match) {
      const [, group, name] = match

      out[group] = out[group] ?? {}
      out[group][name] = value
    } else {
      out[key] = value
    }
  }

  return out
}

/** Read the body, and parse it the way the caller sent it. */
export async function readBody(req) {
  const chunks = []

  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk))
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  const contentType = String(req.headers['content-type'] ?? '')

  // A form — Stripe and Xero's token endpoint post one.
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = {}

    for (const [key, value] of new URLSearchParams(raw)) {
      form[key] = value
    }

    return { raw, json: expandBrackets(form) }
  }

  try {
    return { raw, json: raw ? JSON.parse(raw) : null }
  } catch {
    return { raw, json: null }
  }
}

/**
 * Read a form body, as a plain object.
 *
 * The panel's buttons send a form; the command line sends JSON. Both end up
 * in the same place.
 */
export function readControlForm(body) {
  const values = {}

  for (const [key, value] of new URLSearchParams(body)) {
    values[key] = value
  }

  return values
}

/**
 * Turn a path into something a request can be matched against.
 *
 * A path with `:name` in it matches one segment and remembers it.
 */
export function toMatcher(path) {
  if (path instanceof RegExp) return path

  if (path.includes(':')) {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = escaped.replace(/:(\w+)/g, '(?<$1>[^/]+)')

    return new RegExp(`^${pattern}$`)
  }

  return path
}

/** Convert a mock route path to an OpenAPI path with {param} placeholders. */
export function openApiPath(path) {
  if (typeof path === 'string') {
    return path.replace(/:([A-Za-z_]\w*)/g, '{$1}')
  }
  // Regex route — best effort
  return String(path.source)
    .replace(/^\^/, '')
    .replace(/\$$/, '')
    .replace(/\(\?<(\w+)>\[\^\/\]\+\)/g, '{$1}')
    .replace(/\[\^\/\]\+/g, '{param}')
    .replace(/\\\//g, '/')
    .replace(/\\\./g, '.')
}

/** How the next call should fail. */
export const FAILURES = {
  none: null,
  server: { status: 500, body: { error: { message: 'The service had a problem' } } },
  unauthorised: { status: 401, body: { error: { message: 'The key is not known' } } },
  unavailable: { status: 503, body: { error: { message: 'The service is not available' } } },
  timeout: { status: 504, body: { error: { message: 'The service did not answer in time' } } },
  network: { status: null, body: null },
}

export class MockService {
  constructor(name) {
    this.name = name
    this.routes = []
    this.requests = []

    /** Whatever the service keeps: the transactions, the intents, the records. */
    this.state = {}

    /** The failure the next call should meet. */
    this.state.failure = null

    /** How many calls the failure applies to. */
    this.state.failureCount = 0

    /** The outcome the next payment gets: success, failed, cancelled. */
    this.state.outcome = 'success'

    /** Whether the outcome was chosen, or is just the default. */
    this.state.outcomeSet = false

    /** The webhook settings: where to send it, and how. */
    this.state.webhook = {
      url: null,
      secret: null,
      delayMs: 0,
      retries: 0,
      retryDelayMs: 0,
      duplicate: false,
      drop: false,
    }

    /** The webhooks that were sent. */
    this.state.webhooks = []

    /**
     * The checkout, if this mock has one.
     *
     * The browser layer reads it: a title, how to find the payment being
     * made, and what to record when it is done. The engine never looks at
     * it — see `src/ui/`.
     */
    this.checkout = null

    this.server = null
    this.url = ''
    this.port = 0
    this.listeners = new Set()
  }

  /** Register a route. */
  on(method, path, handler) {
    // The path is kept as it was written, and the matcher is kept beside
    // it — so the routes of a mock can be read, listed and checked against
    // a provider's specification.
    this.routes.push({
      method: method.toUpperCase(),
      path,
      matcher: toMatcher(path),
      handler,
    })

    return this
  }

  /** Register a route that answers whatever the method is. */
  any(path, handler) {
    return this.on('*', path, handler)
  }

  /**
   * Make the next call fail.
   *
   * `server` answers 500, `unauthorised` answers 401, `unavailable` answers
   * 503, `timeout` waits and then answers 504, and `network` drops the
   * connection without answering at all — the way a gateway that is really
   * down behaves.
   */
  failNext(kind = 'server', times = 1) {
    const failure = FAILURES[kind]

    if (!failure) {
      throw new Error(
        `The mock does not know how to fail like "${kind}". It knows: ${Object.keys(FAILURES).join(', ')}.`,
      )
    }

    this.state.failure = kind
    this.state.failureCount = times

    return this
  }

  /** Choose how the next payment goes. */
  setOutcome(outcome = 'success') {
    if (!['success', 'failed', 'cancelled'].includes(outcome)) {
      throw new Error(`The outcome must be success, failed or cancelled — not "${outcome}".`)
    }

    this.state.outcome = outcome
    this.state.outcomeSet = true

    return this
  }

  /** Forget everything, so the next test starts clean. */
  reset() {
    this.requests = []
    this.state.failure = null
    this.state.failureCount = 0
    this.state.outcome = 'success'

    return this
  }

  /** The last request the service was asked. */
  last() {
    return this.requests[this.requests.length - 1]
  }

  /** Every request, for the tests that want to look through them. */
  requestsFor(method, path) {
    return this.requests.filter(
      (request) =>
        (!method || request.method === method.toUpperCase()) &&
        (!path || request.path === path),
    )
  }

  /** Start listening. Port 0 means "any free port". */
  async listen(port = 0, host = '127.0.0.1') {
    this.server = createServer((req, res) => {
      // One bad request must not take the engine down. An unhandled
      // rejection ends the process, and the process holds every mock.
      void this.handle(req, res).catch((error) => {
        console.error(`[${this.name}] ${error?.message ?? error}`)

        if (!res.headersSent) {
          json(res, 500, { error: { message: 'The mock could not answer that request' } })
        }
      })
    })

    await new Promise((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(port, host, resolve)
    })

    const address = this.server.address()

    this.port = address.port
    this.url = `http://${host}:${address.port}`

    // Track this server for graceful shutdown
    trackServer(this)

    return this.url
  }

  /** The work: find the route, run it, and record what happened. */
  async handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const { raw, json: parsed } = await readBody(req)

    const query = {}
    for (const [key, value] of url.searchParams) {
      query[key] = value
    }

    const request = new MockRequest({
      method: (req.method ?? 'GET').toUpperCase(),
      path: url.pathname,
      query,
      headers: req.headers,
      body: raw,
      raw,
      json: parsed,
    })

    this.requests.push(request)

    res.setHeader('x-mock-service', this.name)
    res.setHeader('x-mock-service-kind', 'mock')

    // The mock says what it is.
    //
    // Anything talking to it — an agent, a proxy, a test — can ask, and
    // will be told. It is a local answer, not the real service, it holds no
    // credentials, and it makes no request to the provider it stands in
    // for.
    if (request.path === '/_mock') {
      json(res, 200, {
        kind: 'mock',
        service: this.name,
        real_service: false,
        notice:
          'This is a local mock. It is not the real service, it holds no credentials for it, and it makes no request to it.',
      })
      return
    }

    // The OpenAPI spec for this mock — generated from its actual routes.
    if (request.path === '/_openapi') {
      const spec = this.buildOpenApiSpec()
      json(res, 200, spec)
      return
    }

    // The control surface — how the mock is told what to do next.
    if (request.path.startsWith('/_control')) {
      await this.control(request, res)
      return
    }

    // The failure the next call was told to meet.
    if (this.state.failure && this.state.failureCount > 0) {
      this.state.failureCount -= 1

      const failure = FAILURES[this.state.failure]

      if (this.state.failureCount === 0) this.state.failure = null

      // The socket goes, with nothing on it.
      if (!failure.status) {
        req.socket.destroy()
        return
      }

      // A timeout: the answer comes, but late.
      if (this.state.failure === 'timeout') {
        const timer = setTimeout(() => json(res, failure.status, failure.body), 15_000)
        timer.unref?.()
        return
      }

      json(res, failure.status, failure.body)
      return
    }

    const route = this.routes.find((candidate) => {
      if (candidate.method !== '*' && candidate.method !== request.method) return false

      if (typeof candidate.matcher === 'string') {
        return candidate.matcher === request.path
      }

      return candidate.matcher.test(request.path)
    })

    if (!route) {
      // Every mock says whether it is well — so a container health check
      // has something to ask.
      if (request.path === '/health') {
        json(res, 200, { status: 'healthy', service: this.name })
        return
      }

      res.statusCode = 404
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify({
          error: { message: `${this.name} does not know ${request.method} ${request.path}` },
        }),
      )

      return
    }

    // The path parameters, for the routes that have them.
    if (route.matcher instanceof RegExp) {
      const match = route.matcher.exec(request.path)

      request.params = { ...(match?.groups ?? {}) }

      // A route that does not name its groups still has them.
      if (match) {
        match.forEach((value, index) => {
          if (index > 0 && value !== undefined && request.params[index] === undefined) {
            request.params[index] = value
          }
        })
      }
    }

    try {
      await route.handler(request, res)
    } catch (error) {
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: { message: error.message } }))
      }
    }
  }

  /** Build the OpenAPI spec for this mock from its actual routes. */
  buildOpenApiSpec() {
    const routes = this.routes
    const paths = {}

    for (const route of routes) {
      const method = route.method === '*' ? 'get' : route.method.toLowerCase()
      const path = openApiPath(route.path)

      if (!paths[path]) paths[path] = {}

      paths[path][method] = {
        summary: `${method.toUpperCase()} ${path}`,
        responses: {
          '200': { description: 'Successful response' },
          '400': { description: 'Bad request' },
          '404': { description: 'Not found' },
          '500': { description: 'Internal error' },
        },
        'x-mock-route': true,
      }
    }

    return {
      openapi: '3.1.0',
      info: {
        title: `${this.name} Mock API`,
        version: '1.0.0',
        description: `Mock for ${this.name} — generated from the mock's actual routes. Every endpoint is verified against the provider's published specification where available.`,
        'x-mock-service': this.name,
      },
      servers: [{ url: this.url || `http://localhost:${this.port}`, description: 'Local mock server' }],
      paths,
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer' },
          apiKey: { type: 'apiKey', in: 'header', name: 'Authorization' },
        },
      },
      security: [{ bearerAuth: [] }],
    }
  }

  /**
   * The control surface.
   *
   * This is how the command line and a person drive the mock: choose the
   * outcome, make the next call fail, send the webhook again, or watch what
   * is being asked.
   */
  async control(request, res) {
    const action = request.path.replace('/_control/', '')

    // The panel sends a form; the command line sends JSON.
    const sent = request.json && typeof request.json === 'object' && !Array.isArray(request.json)
      ? request.json
      : readControlForm(request.raw ?? '')

    switch (action) {
      case 'outcome': {
        const outcome = sent.outcome ?? 'success'
        this.setOutcome(outcome)
        json(res, 200, { outcome: this.state.outcome })
        return
      }

      case 'fail': {
        const kind = sent.kind ?? 'server'
        const times = Number(sent.times ?? 1)
        this.failNext(kind, times)
        json(res, 200, { failure: this.state.failure, times: this.state.failureCount })
        return
      }

      case 'webhook': {
        Object.assign(this.state.webhook, sent)

        if (sent.intentId) {
          this.state.webhook.intentId = String(request.json.intentId)
        }

        if (sent.event) {
          this.state.webhook.event = request.json.event
        }

        if (sent.send) {
          await this.sendWebhook()
        }

        json(res, 200, { webhook: this.state.webhook })
        return
      }

      case 'reset': {
        this.reset()
        json(res, 200, { reset: true })
        return
      }

      case 'requests': {
        json(res, 200, { requests: this.requests })
        return
      }

      case 'logs': {
        // The requests, as they happen.
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        })

        const send = (entry) => res.write(`data: ${JSON.stringify(entry)}\n\n`)

        send({ type: 'hello', service: this.name })

        this.listeners.add(send)

        // The response is what closes when the client goes away. The
        // request is not in scope here, and reaching for it took the whole
        // engine down: the ReferenceError escaped as an unhandled rejection
        // and Node exited, so one diagnostic call stopped every mock.
        res.on('close', () => {
          this.listeners.delete(send)
        })

        return
      }

      default: {
        json(res, 200, {
          service: this.name,
          outcome: this.state.outcome,
          failure: this.state.failure,
          failureCount: this.state.failureCount,
          webhook: this.state.webhook,
          webhooks: this.state.webhooks,
          requests: this.requests.length,
        })
      }
    }
  }

  /**
   * Send the webhook.
   *
   * The settings say how: late, twice, retried, or not at all — the things a
   * real provider does and an app has to survive.
   */
  async sendWebhook(event) {
    const settings = this.state.webhook

    if (!settings.url) return { sent: false, reason: 'no url' }

    const payload =
      event ??
      this.state.webhook.event ??
      (this.state.webhookEvent
        ? this.state.webhookEvent(this.state.webhook.intentId)
        : {})

    const body = JSON.stringify(payload)

    const headers = { 'Content-Type': 'application/json' }

    // The signature, so the app can check it the way it would in production.
    if (settings.secret && settings.signatureHeader) {
      const timestamp = Math.floor(Date.now() / 1000)
      const signature = await hmacSha256(settings.secret, `${timestamp}.${body}`)

      headers['Stripe-Signature'] = `t=${timestamp},v1=${signature}`
      headers[settings.signatureHeader] = `t=${timestamp},v1=${signature}`
    }

    const send = async (attempt) => {
      if (settings.delayMs && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, settings.delayMs))
      }

      if (settings.drop && attempt === 0) {
        this.state.webhooks.push({ ...payload, dropped: true })

        return { sent: false, reason: 'dropped' }
      }

      try {
        const res = await fetch(settings.url, { method: 'POST', headers, body })
        const result = { sent: true, status: res.status, attempt }

        this.state.webhooks.push({ ...payload, ...result })

        if (res.status >= 400 && attempt < settings.retries) {
          await new Promise((resolve) => setTimeout(resolve, settings.retryDelayMs))

          return send(attempt + 1)
        }

        return result
      } catch (error) {
        this.state.webhooks.push({ ...payload, sent: false, error: error.message })

        if (attempt < settings.retries) {
          await new Promise((resolve) => setTimeout(resolve, settings.retryDelayMs))

          return send(attempt + 1)
        }

        return { sent: false, reason: error.message }
      }
    }

    const result = await send(0)

    if (settings.duplicate) {
      await send(0)
    }

    return result
  }

  /** Stop listening. */
  async close() {
    if (!this.server) return

    await new Promise((resolve) => {
      this.server.close(() => resolve())
      this.server.closeAllConnections?.()
    })

    this.server = null
    untrackServer(this)
  }

  /** Force close without waiting (for emergency shutdown). */
  async forceClose() {
    if (!this.server) return
    this.server.closeAllConnections?.()
    this.server = null
    untrackServer(this)
  }
}

/** Answer with JSON. */
export function json(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

/** Answer with text. */
export function text(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'text/plain')
  res.end(body)
}

/** The signature a webhook carries. */
export async function hmacSha256(secret, message) {
  const encoder = new TextEncoder()

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Start a mock and hand it back with its URL.
 *
 * Every provider is started the same way, so a test can start any of them.
 */
export async function startService(service, options = {}) {
  await service.listen(options.port ?? 0, options.host ?? '127.0.0.1')

  return service
}

/** A counter that never repeats, for the ids the providers hand out. */
export function counter(prefix) {
  let value = 0

  return () => {
    value += 1

    return `${prefix}_${value}`
  }
}
