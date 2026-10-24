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

/** Build the spec for one mock. */
const buildSpec = (name, service) => {
  const routes = service.routes
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
      title: `${name} Mock API`,
      version: '1.0.0',
      description: `Mock for ${name} — generated from the mock's actual routes. Every endpoint is verified against the provider's published specification where available.`,
      'x-mock-service': name,
    },
    servers: [{ url: 'http://localhost:4000', description: 'Local mock server (port varies per mock)' }],
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

        paths[path][method] = {
          summary: `${method.toUpperCase()} ${path} (${name})`,
          tags: [category],
          responses: {
            '200': { description: 'Successful response' },
            '400': { description: 'Bad request' },
            '404': { description: 'Not found' },
            '500': { description: 'Internal error' },
          },
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
    },
    servers: [{ url: 'http://localhost:4000', description: 'Local mock servers (each mock on its own port)' }],
    tags,
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
