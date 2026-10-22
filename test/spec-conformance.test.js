import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { MOCKS } from '../src/index.js'

/**
 * The mocks are in step with the providers.
 *
 * A mock that serves a path the provider does not have is a mock that has
 * drifted, and a drifted mock is worse than no mock: the test passes, and
 * the code is wrong.
 *
 * So the routes are compared with the providers' own published
 * specifications. This is the check that makes the claim true rather than
 * likely.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))

test('every route a mock serves is in the provider specification', () => {
  let output = ''
  let failed = false

  try {
    output = execFileSync(process.execPath, [join(ROOT, 'scripts/check-specs.js')], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    failed = true
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`
  }

  assert.equal(failed, false, `the routes have drifted:\n${output}`)
  assert.match(output, /specs: clean/)
})

test('the route inventory matches the code', async () => {
  const written = await readFile(join(ROOT, 'docs/ROUTES.md'), 'utf8')

  for (const [name, entry] of Object.entries(MOCKS)) {
    const service = entry.create()

    for (const route of service.routes) {
      if (typeof route.path !== 'string') continue

      assert.ok(
        written.includes(route.path),
        `${name} serves ${route.path}, which is not in docs/ROUTES.md — run npm run routes --write`,
      )
    }
  }
})
