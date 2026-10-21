import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startMock } from '../src/index.js'

/**
 * The control panel.
 *
 * A person uses it to see what the mock was asked and to decide how the
 * next call goes. The buttons are real forms, so the page works even when
 * the script does not load.
 */

const run = async (name, fn) => {
  const service = await startMock(name)

  try {
    await fn(service)
  } finally {
    await service.close()
  }
}

test('the panel is on every mock', async () => {
  await run('stripe', async (service) => {
    const page = await fetch(`${service.url}/_panel`).then((res) => res.text())

    assert.match(page, /<html/)
    assert.match(page, /stripe/)
    assert.match(page, /the next payment/)
    assert.match(page, /the next call/)
  })
})

test('the panel has no framework in it', async () => {
  await run('stripe', async (service) => {
    const page = await fetch(`${service.url}/_panel`).then((res) => res.text())

    // The script is the only thing that comes from outside.
    const scripts = [...page.matchAll(/<script[^>]*src="([^"]+)"/g)].map((match) => match[1])

    assert.equal(scripts.length, 1)
    assert.match(scripts[0], /htmx/)
  })
})

test('the buttons change the state', async () => {
  await run('stripe', async (service) => {
    await fetch(`${service.url}/_control/outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'outcome=failed',
    })

    assert.equal(service.state.outcome, 'failed')

    await fetch(`${service.url}/_control/fail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'kind=server&times=3',
    })

    assert.equal(service.state.failure, 'server')
    assert.equal(service.state.failureCount, 3)
  })
})

test('the panel shows the requests as they come in', async () => {
  await run('stripe', async (service) => {
    await fetch(`${service.url}/v1/payment_intents/pi_missing`)

    const rows = await fetch(`${service.url}/_panel/requests`).then((res) => res.text())

    assert.match(rows, /payment_intents/)
    assert.match(rows, /GET/)
  })
})
