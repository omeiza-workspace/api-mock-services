import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MOCKS, startMock } from '../src/index.js'

/**
 * The mocks themselves.
 *
 * Every mock is started and asked something, so a broken one is caught here
 * rather than in a project that depends on it.
 */

const run = async (name, fn) => {
  const service = await startMock(name)

  try {
    await fn(service)
  } finally {
    await service.close()
  }
}

test('the mocks there are', () => {
  assert.ok(Object.keys(MOCKS).length >= 9)
})

test('a mock that is not there says so', async () => {
  await assert.rejects(() => startMock('nope'), /no mock called/i)
})

test('stripe creates an intent and reads it back', async () => {
  await run('stripe', async (service) => {
    const created = await fetch(`${service.url}/v1/payment_intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ amount: '1250', currency: 'gbp' }).toString(),
    }).then((res) => res.json())

    assert.match(created.id, /^pi_test_/)
    assert.equal(created.amount, 1250)

    const fetched = await fetch(`${service.url}/v1/payment_intents/${created.id}`).then((res) =>
      res.json(),
    )
    assert.equal(fetched.id, created.id)

    // The service remembers what it was asked.
    assert.equal(service.last().path, `/v1/payment_intents/${created.id}`)
  })
})

test('stripe refuses an intent that is not there', async () => {
  await run('stripe', async (service) => {
    const res = await fetch(`${service.url}/v1/payment_intents/pi_missing`)
    assert.equal(res.status, 404)
  })
})

test('resend lists the domains and sends the email', async () => {
  await run('resend', async (service) => {
    const domain = await fetch(`${service.url}/domains`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'shop.example' }),
    }).then((res) => res.json())

    assert.equal(domain.name, 'shop.example')
    assert.ok(domain.records.length > 0)

    const domains = await fetch(`${service.url}/domains`).then((res) => res.json())
    assert.equal(domains.data.length, 1)

    const sent = await fetch(`${service.url}/emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'a@example.com', subject: 'Hello' }),
    }).then((res) => res.json())

    assert.match(sent.id, /^em_/)
    assert.equal(service.state.sent.length, 1)
    assert.equal(service.state.sent[0].to, 'a@example.com')
  })
})

test('xero hands out a token and answers the connections with an array', async () => {
  await run('xero', async (service) => {
    const token = await fetch(`${service.url}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: 'id',
        client_secret: 'secret',
        grant_type: 'client_credentials',
      }).toString(),
    }).then((res) => res.json())

    assert.match(token.access_token, /^at_/)

    const connections = await fetch(`${service.url}/connections`).then((res) => res.json())
    assert.ok(Array.isArray(connections))
    assert.equal(connections[0].tenantName, 'Test Shop')
  })
})

test('xero refuses a client it does not know', async () => {
  await run('xero', async (service) => {
    const res = await fetch(`${service.url}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
    })

    assert.equal(res.status, 400)
  })
})

test('cloudflare creates a record once and leaves it alone after', async () => {
  await run('cloudflare', async (service) => {
    const zone = await fetch(`${service.url}/zones?name=shop.example`).then((res) => res.json())
    assert.equal(zone.result[0].id, 'zone_1')

    const body = JSON.stringify({
      type: 'MX',
      name: 'send',
      content: 'feedback-smtp.us-east-1.amazonses.com',
      priority: 10,
    })

    await fetch(`${service.url}/zones/zone_1/dns_records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    const records = await fetch(
      `${service.url}/zones/zone_1/dns_records?type=MX&name=send`,
    ).then((res) => res.json())

    assert.equal(records.result.length, 1)
    assert.equal(records.result[0].content, 'feedback-smtp.us-east-1.amazonses.com')
  })
})

test('paystack initialises and verifies a transaction', async () => {
  await run('paystack', async (service) => {
    const init = await fetch(`${service.url}/transaction/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com', amount: 5000, reference: 'ref_success' }),
    }).then((res) => res.json())

    assert.equal(init.status, true)

    const verified = await fetch(
      `${service.url}/transaction/verify/${init.data.reference}`,
    ).then((res) => res.json())

    // The reference says how it went.
    assert.equal(verified.data.status, 'success')
  })
})

test('paystack says so when the transaction is not there', async () => {
  await run('paystack', async (service) => {
    const res = await fetch(`${service.url}/transaction/verify/ref_missing`)
    assert.equal(res.status, 404)
  })
})

test('interswitch takes a card and says how it went', async () => {
  await run('interswitch', async (service) => {
    const init = await fetch(`${service.url}/paydirect/api/v1/payment/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 5000 }),
    }).then((res) => res.json())

    assert.equal(init.status, '00')

    const paid = await fetch(
      `${service.url}/paydirect/api/v1/payment/pay/${init.data.payment_id}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_number: '4084084084084081' }),
      },
    ).then((res) => res.json())

    assert.equal(paid.status, '00')
    assert.equal(paid.data.status, 'SUCCESS')

    const failed = await fetch(
      `${service.url}/paydirect/api/v1/payment/pay/${init.data.payment_id}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_number: '6000000000000000' }),
      },
    ).then((res) => res.json())

    assert.equal(failed.status, '05')
  })
})

test('interswitch verifies a paid transaction the way the application asks', async () => {
  await run('interswitch', async (service) => {
    const init = await fetch(`${service.url}/paydirect/api/v1/payment/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 5000 }),
    }).then((res) => res.json())

    const paid = await fetch(
      `${service.url}/paydirect/api/v1/payment/pay/${init.data.payment_id}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_number: '4084084084084081' }),
      },
    ).then((res) => res.json())

    assert.equal(paid.data.status, 'SUCCESS')

    const verified = await fetch(
      `${service.url}/collections/api/v1/gettransaction.json?merchantcode=X&transactionreference=${init.data.transaction_ref}`,
    ).then((res) => res.json())

    // The shape the application reads: resp, txnref, amount (minor units), retRef.
    assert.equal(verified.resp, '00')
    assert.equal(verified.txnref, init.data.transaction_ref)
    assert.equal(verified.amount, 500000)
    assert.ok(verified.retRef)

    // An unknown reference is reported, not crashed.
    const missing = await fetch(
      `${service.url}/collections/api/v1/gettransaction.json?merchantcode=X&transactionreference=NOPE`,
    ).then((res) => res.json())

    assert.notEqual(missing.resp, '00')
  })
})

test('youverify starts a verification', async () => {
  await run('youverify', async (service) => {
    const res = await fetch(`${service.url}/v2/api/identity/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity_type: 'NIN', identity_number: '12345678901' }),
    }).then((res) => res.json())

    assert.equal(res.status, 'pending')
    assert.ok(res.data.id)
  })
})

test('onesignal keeps the notification', async () => {
  await run('onesignal', async (service) => {
    const res = await fetch(`${service.url}/api/v1/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: 'app',
        included_segments: ['All'],
        headings: { en: 'Hello' },
        contents: { en: 'Something happened' },
      }),
    }).then((res) => res.json())

    assert.ok(res.id)
    assert.equal(service.state.notifications.length, 1)
    assert.equal(service.state.notifications[0].title, 'Hello')
  })
})

test('onesignal refuses a notification with no message', async () => {
  await run('onesignal', async (service) => {
    const res = await fetch(`${service.url}/api/v1/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: 'app' }),
    })

    assert.equal(res.status, 400)
  })
})

test('twilio sends a message and reads it back', async () => {
  await run('twilio', async (service) => {
    const sent = await fetch(
      `${service.url}/2010-04-01/Accounts/AC123/Messages.json`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ To: '+2348000000000', Body: 'Your order is ready' }),
      },
    ).then((res) => res.json())

    assert.match(sent.sid, /^SM_/)

    const fetched = await fetch(
      `${service.url}/2010-04-01/Accounts/AC123/Messages/${sent.sid}.json`,
    ).then((res) => res.json())

    assert.equal(fetched.body, 'Your order is ready')
  })
})
