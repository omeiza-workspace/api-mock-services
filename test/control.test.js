import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { startMock, createSpecMockFromFile } from '../src/index.js'
import { createSpecMock } from '../src/spec.js'

/**
 * What every mock can do.
 *
 * The failure paths and the outcomes are the ones worth testing, so they are
 * tested here rather than in every project that uses a mock.
 */

const run = async (name, fn) => {
  const service = await startMock(name)

  try {
    await fn(service)
  } finally {
    await service.close()
  }
}

test('the next call can be made to fail', async () => {
  await run('stripe', async (service) => {
    service.failNext('server')

    const failed = await fetch(`${service.url}/v1/payment_intents/pi_missing`)
    assert.equal(failed.status, 500)

    // And only the next one.
    const after = await fetch(`${service.url}/v1/payment_intents/pi_missing`)
    assert.equal(after.status, 404)
  })
})

test('the next call can be refused for want of a key', async () => {
  await run('stripe', async (service) => {
    service.failNext('unauthorised')

    const res = await fetch(`${service.url}/v1/payment_intents`)
    assert.equal(res.status, 401)
  })
})

test('the connection can go, with nothing on it', async () => {
  await run('stripe', async (service) => {
    service.failNext('network')

    await assert.rejects(() => fetch(`${service.url}/v1/payment_intents`))
  })
})

test('the outcome decides how the payment goes', async () => {
  await run('stripe', async (service) => {
    service.setOutcome('failed')

    const intent = await fetch(`${service.url}/v1/payment_intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ amount: '1250', currency: 'gbp' }).toString(),
    }).then((res) => res.json())

    assert.equal(intent.status, 'requires_payment_method')
  })
})

test('the checkout can be opened and paid', async () => {
  await run('paystack', async (service) => {
    const init = await fetch(`${service.url}/transaction/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com', amount: 5000 }),
    }).then((res) => res.json())

    const reference = init.data.reference

    // The page a person would open.
    const page = await fetch(`${service.url}/checkout/${reference}`)
    assert.equal(page.status, 200)

    const html = await page.text()
    assert.match(html, /Paystack \(mock\)/)
    assert.match(html, new RegExp(reference))

    // They pay.
    const done = await fetch(`${service.url}/checkout/${reference}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome: 'success' }),
    }).then((res) => res.json())

    assert.equal(done.outcome, 'success')

    // And the shop is told it was paid.
    const verified = await fetch(`${service.url}/transaction/verify/${reference}`).then((res) =>
      res.json(),
    )
    assert.equal(verified.data.status, 'success')
  })
})

test('the checkout can be failed from the browser', async () => {
  await run('paystack', async (service) => {
    const init = await fetch(`${service.url}/transaction/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com', amount: 5000 }),
    }).then((res) => res.json())

    const reference = init.data.reference

    await fetch(`${service.url}/checkout/${reference}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome: 'failed' }),
    })

    const verified = await fetch(`${service.url}/transaction/verify/${reference}`).then((res) =>
      res.json(),
    )
    assert.equal(verified.data.status, 'failed')
  })
})

test('the mock can be driven over the control surface', async () => {
  await run('stripe', async (service) => {
    const outcome = await fetch(`${service.url}/_control/outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome: 'failed' }),
    }).then((res) => res.json())

    assert.equal(outcome.outcome, 'failed')

    const failure = await fetch(`${service.url}/_control/fail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'server', times: 2 }),
    }).then((res) => res.json())

    assert.equal(failure.failure, 'server')
    assert.equal(failure.times, 2)

    const state = await fetch(`${service.url}/_control`).then((res) => res.json())
    assert.equal(state.service, 'stripe')
  })
})

test('the mock can be reset', async () => {
  await run('stripe', async (service) => {
    await fetch(`${service.url}/v1/payment_intents/pi_missing`)

    assert.equal(service.requests.length, 1)

    await fetch(`${service.url}/_control/reset`, { method: 'POST' })

    assert.equal(service.requests.length, 0)
  })
})

test('the webhook can be sent, signed and late', async () => {
  await run('stripe', async (service) => {
    // Somewhere for the webhook to arrive.
    const received = []
    const receiver = await import('node:http').then(({ createServer }) =>
      createServer((req, res) => {
        const chunks = []

        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', () => {
          received.push({
            body: Buffer.concat(chunks).toString('utf8'),
            signature: req.headers['stripe-signature'],
          })
          res.writeHead(200)
          res.end('ok')
        })
      }),
    )

    await new Promise((resolve) => receiver.listen(0, '127.0.0.1', resolve))
    const port = receiver.address().port

    const intent = await fetch(`${service.url}/v1/payment_intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ amount: '1250', currency: 'gbp' }).toString(),
    }).then((res) => res.json())

    await fetch(`${service.url}/_control/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `http://127.0.0.1:${port}/webhook`,
        secret: 'whsec_test',
        signatureHeader: 'Stripe-Signature',
      }),
    })

    await service.sendWebhook(service.state.webhookEvent(intent.id))

    assert.equal(received.length, 1)

    // The signature is the one the app would check.
    const timestamp = received[0].signature.split(',').find((part) => part.startsWith('t=')).slice(2)
    const signature = received[0].signature
      .split(',')
      .find((part) => part.startsWith('v1='))
      .slice(3)

    const expected = createHmac('sha256', 'whsec_test')
      .update(`${timestamp}.${received[0].body}`)
      .digest('hex')

    assert.equal(signature, expected)

    await new Promise((resolve) => receiver.close(resolve))
  })
})

test('a mock can be written as a file, not as code', async () => {
  const service = createSpecMock({
    name: 'acme',
    state: { greeting: 'hello' },
    routes: [
      { method: 'GET', path: '/v1/things', body: { things: [] } },
      {
        method: 'GET',
        path: '/v1/things/:id',
        body: { id: '{{params.id}}', greeting: '{{state.greeting}}' },
      },
      {
        method: 'POST',
        path: '/v1/echo',
        body: { email: '{{body.email}}', token: '{{header.authorization}}' },
      },
    ],
  })

  await service.listen(0)

  try {
    const thing = await fetch(`${service.url}/v1/things/42`).then((res) => res.json())
    assert.equal(thing.id, '42')
    assert.equal(thing.greeting, 'hello')

    const echoed = await fetch(`${service.url}/v1/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: 'Bearer abc' },
      body: JSON.stringify({ email: 'a@example.com' }),
    }).then((res) => res.json())

    assert.equal(echoed.email, 'a@example.com')
    assert.equal(echoed.token, 'Bearer abc')
  } finally {
    await service.close()
  }
})

test('a contributed mock file starts and answers', async () => {
  const path = fileURLToPath(new URL('../contrib/mpesa.json', import.meta.url))
  const service = await createSpecMockFromFile(path)

  await service.listen(0)

  try {
    const res = await fetch(`${service.url}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ BusinessShortCode: '174379', TransactionDesc: 'A test payment' }),
    })

    assert.equal(res.status, 200)

    const body = await res.json()

    assert.equal(body.ResponseCode, '0')
    assert.equal(body.MerchantCode, '174379')
    assert.equal(body.TransactionDesc, 'A test payment')
  } finally {
    await service.close()
  }
})
