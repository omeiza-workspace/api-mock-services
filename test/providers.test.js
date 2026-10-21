import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MOCKS, startMock } from '../src/index.js'

/**
 * The mocks added since the first release.
 *
 * Each one is started and asked something, so a broken one is caught here
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

const post = (url, body) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

test('flutterwave starts a payment and verifies it', async () => {
  await run('flutterwave', async (service) => {
    const started = await post(`${service.url}/v3/payments`, {
      tx_ref: 'FLW-success-1',
      amount: 5000,
      currency: 'NGN',
      customer: { email: 'a@example.com', name: 'Ada' },
    }).then((res) => res.json())

    assert.equal(started.status, 'success')
    assert.equal(started.data.tx_ref, 'FLW-success-1')

    const verified = await fetch(`${service.url}/v3/transactions/FLW-success-1/verify`).then((res) =>
      res.json(),
    )

    assert.equal(verified.data.status, 'successful')
    assert.equal(verified.data.amount, 5000)
  })
})

test('flutterwave fails the payment when the reference says so', async () => {
  await run('flutterwave', async (service) => {
    await post(`${service.url}/v3/payments`, { tx_ref: 'FLW-failed-1', amount: 5000 })

    const verified = await fetch(`${service.url}/v3/transactions/FLW-failed-1/verify`).then((res) =>
      res.json(),
    )

    assert.equal(verified.data.status, 'failed')
  })
})

test('monnify reserves an account and takes a transaction', async () => {
  await run('monnify', async (service) => {
    const reserved = await post(`${service.url}/api/v1/accounts`, {
      accountName: 'Ada Nwosu',
      accountReference: 'ref_ada',
      currency: 'NGN',
    }).then((res) => res.json())

    assert.equal(reserved.response_code, 'SUCCESS')
    assert.ok(reserved.data.reserved_account.account_number)

    const fetched = await fetch(`${service.url}/api/v1/accounts/ref_ada`).then((res) => res.json())
    assert.equal(fetched.data.reserved_account.account_name, 'Ada Nwosu')

    await post(`${service.url}/api/v1/transactions`, {
      reference: 'trx_success_1',
      amount: 2500,
      accountReference: 'ref_ada',
    })

    const transaction = await fetch(`${service.url}/api/v1/transactions/trx_success_1`).then((res) =>
      res.json(),
    )

    assert.equal(transaction.data.status, 'SUCCESS')
  })
})

test('smile id verifies a bvn', async () => {
  await run('smileid', async (service) => {
    const verified = await post(`${service.url}/v2/verification`, {
      partner_id: 'partner_1',
      template_id: 'template_1',
      checks: { bvn: { value: '12345678901', first_name: 'Ada', last_name: 'Nwosu' } },
    }).then((res) => res.json())

    assert.equal(verified.status_code, '01')
    assert.equal(verified.checks.bvn.status, 'Successful')
  })
})

test('identity pass verifies a person and a business', async () => {
  await run('identitypass', async (service) => {
    const person = await post(`${service.url}/v1/verification`, {
      identity_type: 'BVN',
      identity_number: '12345678901',
      first_name: 'Ada',
      last_name: 'Nwosu',
    }).then((res) => res.json())

    assert.equal(person.status, 'success')
    assert.equal(person.data.first_name, 'Ada')

    const business = await post(`${service.url}/v1/business`, {
      business_name: 'The Shop',
      registration_number: 'RC 1234567',
    }).then((res) => res.json())

    assert.equal(business.data.company_status, 'ACTIVE')
  })
})

test('termii sends a message and keeps it', async () => {
  await run('termii', async (service) => {
    const sent = await post(`${service.url}/api/v1/send`, {
      to: '+2348012345678',
      message: 'Your code is 1234',
      sender: 'The Shop',
    }).then((res) => res.json())

    assert.equal(sent.status, 'success')

    const message = await fetch(`${service.url}/api/v1/messages/${sent.data.message_id}`).then(
      (res) => res.json(),
    )

    assert.equal(message.data.message, 'Your code is 1234')
  })
})

test('whatsapp sends a message and answers the handshake', async () => {
  await run('whatsapp', async (service) => {
    const sent = await post(`${service.url}/v1/messages`, {
      messaging_product: 'whatsapp',
      to: '+2348012345678',
      type: 'text',
      text: { body: 'Your code is 1234' },
    }).then((res) => res.json())

    assert.equal(sent.messages[0].message_status, 'accepted')
    assert.match(sent.messages[0].id, /^wamid\./)

    // The handshake a webhook setup does.
    const handshake = await fetch(
      `${service.url}/webhook?hub.mode=subscribe&hub.verify_token=mock-verify-token&hub.challenge=42`,
    )

    assert.equal(handshake.status, 200)
    assert.equal(await handshake.text(), '42')
  })
})

test('firebase sends a notification', async () => {
  await run('fcm', async (service) => {
    const sent = await post(`${service.url}/v1/projects/shop/messages:send`, {
      message: {
        token: 'device-token',
        notification: { title: 'The Shop', body: 'Your order is on its way' },
        data: { order: '123' },
      },
    }).then((res) => res.json())

    assert.equal(sent.successCount, 1)
    assert.equal(sent.failureCount, 0)
    assert.match(sent.name, /^projects\/shop\/messages\//)
  })
})

test('the model mock answers a chat completion', async () => {
  await run('openai', async (service) => {
    const answered = await post(`${service.url}/v1/chat/completions`, {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hello there' }],
    }).then((res) => res.json())

    assert.equal(answered.object, 'chat.completion')
    assert.equal(answered.choices[0].message.role, 'assistant')
    assert.match(answered.choices[0].message.content, /Hello there/)
    assert.ok(answered.usage.total_tokens > 0)
  })
})

test('the model mock streams when it is asked to', async () => {
  await run('openai', async (service) => {
    const res = await post(`${service.url}/v1/chat/completions`, {
      model: 'gpt-4o-mini',
      stream: true,
      messages: [{ role: 'user', content: 'Hello there' }],
    })

    assert.match(res.headers.get('content-type'), /text\/event-stream/)

    const body = await res.text()

    assert.match(body, /data: /)
    assert.match(body, /data: \[DONE\]/)
  })
})

test('the storage mock keeps an object', async () => {
  await run('s3', async (service) => {
    await fetch(`${service.url}/photos`, { method: 'PUT' })

    const put = await fetch(`${service.url}/photos/2024/hello.txt`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: 'hello world',
    })

    assert.equal(put.status, 200)

    const got = await fetch(`${service.url}/photos/2024/hello.txt`)

    assert.equal(got.status, 200)
    assert.equal(await got.text(), 'hello world')

    // The listing has it in it.
    const listing = await fetch(`${service.url}/photos`).then((res) => res.text())
    assert.match(listing, /2024\/hello\.txt/)
  })
})

test('every mock answers the health check', async () => {
  for (const name of Object.keys(MOCKS)) {
    await run(name, async (service) => {
      const res = await fetch(`${service.url}/health`)

      assert.equal(res.status, 200, `${name} should answer /health`)
    })
  }
})
