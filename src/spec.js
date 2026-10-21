import { MockService, json } from './harness.js'

/**
 * The mock you write as a file, not as code.
 *
 * Most providers are worth a hand-written mock, because their flows have
 * state — a payment that is created, then paid, then refunded. But a service
 * that is only read from does not: any API with a spec can be stood up from
 * a small file.
 *
 * A route file looks like this:
 *
 * ```json
 * {
 *   "name": "acme",
 *   "routes": [
 *     {
 *       "method": "GET",
 *       "path": "/v1/things",
 *       "status": 200,
 *       "body": { "things": [] }
 *     },
 *     {
 *       "method": "GET",
 *       "path": "/v1/things/:id",
 *       "status": 200,
 *       "body": { "id": "{{params.id}}", "name": "A thing" }
 *     }
 *   ]
 * }
 * ```
 *
 * The placeholders are filled in from the request: `{{params.id}}` from the
 * path, `{{query.q}}` from the query string, `{{body.email}}` from the body,
 * `{{header.authorization}}` from a header, and `{{state.anything}}` from
 * what the mock keeps.
 */

const TEMPLATES = {
  params: (request) => request.params ?? {},
  query: (request) => request.query ?? {},
  body: (request) => request.json ?? {},
  header: (request) => request.headers ?? {},
  state: (request, service) => service.state ?? {},
}

/** Fill the placeholders in. */
export function render(value, request, service) {
  if (typeof value === 'string') {
    return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
      const [group, key] = path.split('.')

      const source = TEMPLATES[group]
      if (!source) return ''

      const found = source(request, service)

      const value = found?.[key]

      return value === undefined || value === null ? '' : String(value)
    })
  }

  if (Array.isArray(value)) {
    return value.map((entry) => render(entry, request, service))
  }

  if (value && typeof value === 'object') {
    const out = {}

    for (const [key, entry] of Object.entries(value)) {
      out[key] = render(entry, request, service)
    }

    return out
  }

  return value
}

/**
 * A mock from a route file.
 */
export function createSpecMock(definition) {
  const service = new MockService(definition.name ?? 'spec')

  // The definitions own state, so a route can read it.
  Object.assign(service.state, definition.state ?? {})

  for (const route of definition.routes ?? []) {
    service.on(route.method ?? 'GET', route.path, (req, res) => {
      const status = route.status ?? 200
      const body = render(route.body ?? {}, req, service)

      if (route.raw) {
        res.statusCode = status

        for (const [key, value] of Object.entries(route.headers ?? {})) {
          res.setHeader(key, value)
        }

        res.end(body)
        return
      }

      if (route.headers) {
        for (const [key, value] of Object.entries(route.headers)) {
          res.setHeader(key, value)
        }
      }

      json(res, status, body)
    })
  }

  return service
}

/**
 * A mock from a route file on disk.
 *
 * The file can be JSON, or a module that exports the definition — so a
 * project can keep its mocks next to the code they stand in for.
 */
export async function createSpecMockFromFile(path) {
  const { readFile } = await import('node:fs/promises')
  const { pathToFileURL } = await import('node:url')

  if (path.endsWith('.json')) {
    const raw = await readFile(path, 'utf8')

    return createSpecMock(JSON.parse(raw))
  }

  const module = await import(pathToFileURL(path).href)

  return createSpecMock(module.default ?? module.definition ?? module)
}
