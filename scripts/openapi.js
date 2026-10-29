#!/usr/bin/env node
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MOCKS, CATEGORIES } from '../src/index.js'

/**
 * Generate OpenAPI 3.1 specs from the mock routes.
 *
 * Each mock gets its own spec at `specs/openapi/<name>.json`
 * A combined spec is written to `specs/openapi/combined.json`
 *
 *   node scripts/openapi.js           # print combined spec
 *   node scripts/openapi.js --write   # write specs to specs/openapi/
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT_DIR = join(ROOT, 'specs/openapi')

/** Convert a mock route path to an OpenAPI path with {param} placeholders. */
function openApiPath(path) {
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

/** Infer JSON schema from a sample object. */
function inferSchema(obj, name = 'Object') {
  if (obj === null || obj === undefined) {
    return { type: 'null' }
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return { type: 'array', items: {} }
    return { type: 'array', items: inferSchema(obj[0]) }
  }
  if (typeof obj === 'object') {
    const properties = {}
    const required = []
    for (const [key, value] of Object.entries(obj)) {
      properties[key] = inferSchema(value)
      if (value !== null && value !== undefined) required.push(key)
    }
    return { type: 'object', properties, required }
  }
  if (typeof obj === 'string') return { type: 'string' }
  if (typeof obj === 'number') return { type: 'number' }
  if (typeof obj === 'boolean') return { type: 'boolean' }
  return { type: 'object' }
}

/** Build request/response examples from a mock's state. */
function buildExamples(service, route) {
  const examples = {}

  // Get path as string (handle both string and RegExp)
  const pathStr = String(route.path)
  const path = openApiPath(route.path)
  const method = route.method === '*' ? 'get' : route.method.toLowerCase()

  // Generate request body example for POST/PUT/PATCH
  if (['post', 'put', 'patch'].includes(method)) {
    if (pathStr.includes('/payment_intents') || pathStr.includes('/payments')) {
      examples.request = {
        'application/json': {
          summary: 'Create payment',
          value: { amount: 10000, currency: 'usd', payment_method: 'pm_card_visa' }
        }
      }
    } else if (pathStr.includes('/customers') || pathStr.includes('/contacts')) {
      examples.request = {
        'application/json': {
          summary: 'Create customer',
          value: { email: 'customer@example.com', name: 'John Doe' }
        }
      }
    } else if (pathStr.includes('/orders') || pathStr.includes('/checkout')) {
      examples.request = {
        'application/json': {
          summary: 'Create order',
          value: { amount: 10000, currency: 'USD', customer: 'cus_123' }
        }
      }
    } else if (pathStr.includes('/track') || pathStr.includes('/events')) {
      examples.request = {
        'application/json': {
          summary: 'Track event',
          value: { event: 'Button Clicked', userId: 'user_123', properties: { button: 'submit' } }
        }
      }
    } else if (pathStr.includes('/identify')) {
      examples.request = {
        'application/json': {
          summary: 'Identify user',
          value: { userId: 'user_123', traits: { name: 'John Doe', email: 'john@example.com' } }
        }
      }
    }
  }

  // Generate response example
  if (pathStr.includes('/health')) {
    examples.response = {
      '200': { 'application/json': { summary: 'Health check', value: { status: 'healthy', service: 'mock' } } }
    }
  } else if (pathStr.includes('/_mock')) {
    examples.response = {
      '200': { 'application/json': { summary: 'Mock identity', value: { kind: 'mock', service: 'mock', real_service: false } } }
    }
  } else if (pathStr.includes('/_openapi')) {
    examples.response = {
      '200': { 'application/json': { summary: 'OpenAPI spec', value: { openapi: '3.1.0', info: { title: 'Mock API' } } } }
    }
  } else if (method === 'post' || method === 'put') {
    examples.response = {
      '200': { 'application/json': { summary: 'Created/Updated', value: { id: 'obj_123', status: 'success' } } },
      '201': { 'application/json': { summary: 'Created', value: { id: 'obj_123', status: 'created' } } },
      '400': { 'application/json': { summary: 'Bad request', value: { error: { message: 'Invalid request' } } } }
    }
  } else if (method === 'get') {
    examples.response = {
      '200': { 'application/json': { summary: 'Success', value: { data: '...' } } },
      '404': { 'application/json': { summary: 'Not found', value: { error: { message: 'Not found' } } } }
    }
  } else if (method === 'delete') {
    examples.response = {
      '200': { 'application/json': { summary: 'Deleted', value: { deleted: true } } },
      '204': { description: 'No content' },
      '404': { 'application/json': { summary: 'Not found', value: { error: { message: 'Not found' } } } }
    }
  }

  return examples
}

/** Build the spec for one mock. */
const buildSpec = (name, service) => {
  const routes = service.routes
  const paths = {}

  for (const route of routes) {
    const method = route.method === '*' ? 'get' : route.method.toLowerCase()
    const path = openApiPath(route.path)

    if (!paths[path]) paths[path] = {}

    const examples = buildExamples(service, route)

    paths[path][method] = {
      summary: `${method.toUpperCase()} ${path}`,
      tags: [name],
      operationId: `${method}${path.replace(/[\/{}]/g, '_').replace(/-/g, '_')}`,
      responses: {
        '200': {
          description: 'Successful response',
          content: examples.response?.['200'] ? { 'application/json': examples.response['200']['application/json'] } : { 'application/json': {} }
        },
        '201': {
          description: 'Created',
          content: examples.response?.['201'] ? { 'application/json': examples.response['201']['application/json'] } : { 'application/json': {} }
        },
        '400': {
          description: 'Bad request',
          content: examples.response?.['400'] ? { 'application/json': examples.response['400']['application/json'] } : { 'application/json': {} }
        },
        '404': {
          description: 'Not found',
          content: examples.response?.['404'] ? { 'application/json': examples.response['404']['application/json'] } : { 'application/json': {} }
        },
        '500': {
          description: 'Internal error',
          content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'object', properties: { message: { type: 'string' } } } } } } }
        },
      },
      ...(examples.request && { requestBody: { content: examples.request, required: true } }),
      'x-mock-route': true,
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: `${name} Mock API`,
      version: '1.0.0',
      description: `Mock for ${name} — generated from the mock's actual routes. Every endpoint is verified against the provider's published specification where available.`,
      'x-mock-service': name,
      contact: { name: 'API Mock Services', url: 'https://github.com/omeiza-workspace/api-mock-services' },
      license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
    },
    servers: [
      { url: 'http://localhost:4000', description: 'Local mock server (port varies per mock)' },
      { url: '{baseUrl}', description: 'Custom base URL', variables: { baseUrl: { default: 'http://localhost:4000' } } }
    ],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', description: 'Bearer token (any value accepted by mock)' },
        apiKey: { type: 'apiKey', in: 'header', name: 'Authorization', description: 'API key (any value accepted by mock)' },
      },
      schemas: {
        Error: { type: 'object', properties: { error: { type: 'object', properties: { message: { type: 'string' }, code: { type: 'string' } } } } },
        HealthCheck: { type: 'object', properties: { status: { type: 'string', enum: ['healthy'] }, service: { type: 'string' } } },
        MockIdentity: { type: 'object', properties: { kind: { type: 'string', enum: ['mock'] }, service: { type: 'string' }, real_service: { type: 'boolean', enum: [false] }, notice: { type: 'string' } } },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [{ name: name, description: `${name} mock endpoints` }],
  }
}

/** Build the combined spec. */
const buildCombinedSpec = () => {
  const paths = {}
  const tags = []

  for (const [category, info] of Object.entries(CATEGORIES)) {
    const names = Object.entries(MOCKS).filter(([, entry]) => entry.category === category)
    if (!names.length) continue

    tags.push({ name: category, description: info.title })

    for (const [name] of names) {
      const service = MOCKS[name].create()

      for (const route of service.routes) {
        const method = route.method === '*' ? 'get' : route.method.toLowerCase()
        const path = openApiPath(route.path)

        if (!paths[path]) paths[path] = {}

        const examples = buildExamples(service, route)

        paths[path][method] = {
          summary: `${method.toUpperCase()} ${path} (${name})`,
          tags: [category],
          responses: {
            '200': { description: 'Successful response', content: examples.response?.['200'] ? { 'application/json': examples.response['200']['application/json'] } : { 'application/json': {} } },
            '201': { description: 'Created', content: examples.response?.['201'] ? { 'application/json': examples.response['201']['application/json'] } : { 'application/json': {} } },
            '400': { description: 'Bad request', content: examples.response?.['400'] ? { 'application/json': examples.response['400']['application/json'] } : { 'application/json': {} } },
            '404': { description: 'Not found', content: examples.response?.['404'] ? { 'application/json': examples.response['404']['application/json'] } : { 'application/json': {} } },
            '500': { description: 'Internal error', content: { 'application/json': {} } },
          },
          ...(examples.request && { requestBody: { content: examples.request, required: true } }),
          'x-mock-service': name,
        }
      }
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'API Mock Services — Combined OpenAPI Spec',
      version: '1.0.0',
      description: 'All mocks in one spec. Each operation is tagged with its category and carries x-mock-service.',
      contact: { name: 'API Mock Services', url: 'https://github.com/omeiza-workspace/api-mock-services' },
      license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
    },
    servers: [
      { url: 'http://localhost:4000', description: 'Local mock servers (each mock on its own port)' },
      { url: '{baseUrl}', description: 'Custom base URL', variables: { baseUrl: { default: 'http://localhost:4000' } } }
    ],
    tags,
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', description: 'Bearer token (any value accepted by mock)' },
        apiKey: { type: 'apiKey', in: 'header', name: 'Authorization', description: 'API key (any value accepted by mock)' },
      },
      schemas: {
        Error: { type: 'object', properties: { error: { type: 'object', properties: { message: { type: 'string' }, code: { type: 'string' } } } } },
        HealthCheck: { type: 'object', properties: { status: { type: 'string', enum: ['healthy'] }, service: { type: 'string' } } },
        MockIdentity: { type: 'object', properties: { kind: { type: 'string', enum: ['mock'] }, service: { type: 'string' }, real_service: { type: 'boolean', enum: [false] }, notice: { type: 'string' } } },
      },
    },
    security: [{ bearerAuth: [] }],
  }
}

const combined = buildCombinedSpec()

if (process.argv.includes('--write')) {
  await mkdir(OUT_DIR, { recursive: true })

  // Write individual specs
  for (const [name, entry] of Object.entries(MOCKS)) {
    const service = entry.create()
    const spec = buildSpec(name, service)
    await writeFile(join(OUT_DIR, `${name}.json`), JSON.stringify(spec, null, 2))
  }

  // Write combined spec
  await writeFile(join(OUT_DIR, 'combined.json'), JSON.stringify(combined, null, 2))

  console.log(`written: ${OUT_DIR}/`)
  console.log(`  ${Object.keys(MOCKS).length} individual specs`)
  console.log(`  1 combined spec`)
} else {
  console.log(JSON.stringify(combined, null, 2))
}
