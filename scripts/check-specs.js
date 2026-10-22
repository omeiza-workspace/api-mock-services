#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MOCKS } from '../src/index.js'

/**
 * Check the mocks against the providers' own specifications.
 *
 * A mock that answers a path the provider does not serve is a mock that
 * has drifted — and a drifted mock is worse than no mock, because the test
 * passes and the code is wrong.
 *
 * So every route a mock serves is compared with the routes in the
 * provider's published specification. A route the provider does not have is
 * a failure.
 *
 *   node scripts/check-specs.js
 *
 * The last line it prints is `specs: clean` or `specs: drifted`.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const MANIFEST = join(ROOT, 'specs/sources.json')

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'))
const sources = manifest.specs ?? {}

/**
 * The shape of a path, with every parameter the same.
 *
 * `/Accounts/:accountSid/Messages.json` and `/Accounts/{AccountSid}/Messages.json`
 * are the same path; this makes them compare equal.
 */
const shape = (path) => String(path).replace(/\{[^}]+\}|:[A-Za-z_]\w*/g, '*')

/** The paths in a specification, whether it is YAML or JSON. */
function specPaths(source) {
  const trimmed = source.trimStart()

  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(source)

    return Object.keys(parsed.paths ?? {})
  }

  // A YAML specification: the paths are the keys two spaces in, under
  // `paths:`.
  const paths = []
  let inPaths = false

  for (const line of source.split('\n')) {
    if (/^paths:\s*$/.test(line)) {
      inPaths = true
      continue
    }

    if (!inPaths) continue

    const match = line.match(/^ {2}(\/\S*?):\s*$/)

    if (match) {
      paths.push(match[1])
      continue
    }

    // Anything at the top level again ends the section.
    if (/^\S/.test(line)) inPaths = false
  }

  return paths
}

/** The routes a mock serves, as paths. */
function mockPaths(name) {
  const entry = MOCKS[name]

  if (!entry) return []

  const service = entry.create()

  return service.routes
    .filter((route) => typeof route.path === 'string')
    .map((route) => route.path)
}

let drifted = 0
let checked = 0

for (const [name, source] of Object.entries(sources)) {
  if (!source.check || !source.mock) continue

  const file = source.cache
    ? join(ROOT, 'specs/.cache', basename(source.path))
    : join(ROOT, source.path)

  let contents = null

  if (existsSync(file)) {
    contents = await readFile(file, 'utf8')
  } else {
    console.log(`fetching ${name} — ${source.url}`)

    const res = await fetch(source.url)

    if (!res.ok) {
      console.error(`  [specs] ${name}: the fetch failed (${res.status} ${res.statusText})`)
      process.exitCode = 1
      continue
    }

    contents = await res.text()

    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, contents)
  }

  const published = new Set(specPaths(contents).map(shape))
  const ours = mockPaths(source.mock)

  console.log(`${name} — ${published.size} paths published, ${ours.length} served by the mock`)

  for (const route of ours) {
    checked += 1

    if (!published.has(shape(route))) {
      drifted += 1
      console.error(`  [specs] ${source.mock}: ${route} is not in the ${name} specification`)
    }
  }

  const missing = [...published].filter((path) => !ours.some((route) => shape(route) === path))

  if (missing.length) {
    console.log(`  ${missing.length} published path(s) the mock does not serve — that is fine`)
  }
}

console.log('')
console.log(`specs: ${drifted === 0 ? 'clean' : 'drifted'} (${checked} route(s) checked)`)

if (drifted > 0) process.exitCode = 1
