#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Refresh the specifications.
 *
 * The mocks are written by hand, but the shapes they answer with are the
 * providers'. This keeps the specifications those shapes are checked
 * against in step with the providers' own repositories — so a provider that
 * changes its API does not leave the mocks quietly out of date.
 *
 *   node scripts/update-specs.js
 *
 * The last line it prints is `specs: changed` or `specs: unchanged`, so a
 * workflow knows whether there is anything to commit.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const MANIFEST = join(ROOT, 'specs/sources.json')

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'))
const sources = manifest.specs ?? {}

let changed = 0

for (const [name, source] of Object.entries(sources)) {
  const target = join(ROOT, source.path)

  console.log(`fetching ${name} — ${source.url}`)

  const res = await fetch(source.url)

  if (!res.ok) {
    console.error(`  [specs] ${name}: the fetch failed (${res.status} ${res.statusText})`)
    process.exitCode = 1
    continue
  }

  const body = await res.text()
  let existing = null

  try {
    existing = await readFile(target, 'utf8')
  } catch {
    existing = null
  }

  if (existing === body) {
    console.log(`  unchanged — ${relative(ROOT, target)}`)
    continue
  }

  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, body)

  const lines = body.split('\n').length

  console.log(`  changed — ${relative(ROOT, target)} (${lines} lines)`)

  changed += 1
}

console.log('')
console.log(`specs: ${changed === 0 ? 'unchanged' : 'changed'}`)
