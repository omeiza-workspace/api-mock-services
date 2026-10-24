import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MOCKS } from '../src/index.js'

const post = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, json: await res.json() }
}

const get = async (url) => {
  const res = await fetch(url)
  return { status: res.status, json: await res.json() }
}

const del = async (url, body) => {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, json: await res.json() }
}

test('sendgrid sends an email', async () => {
  const service = MOCKS.sendgrid.create()
  await service.listen(0, '127.0.0.1')

  const res = await fetch(`${service.url}/v3/mail/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      from: { email: 'from@example.com', name: 'Sender' },
      personalizations: [{ to: [{ email: 'to@example.com', name: 'Recipient' }] }],
      subject: 'Test Subject',
      content: [{ type: 'text/plain', value: 'Test content' }],
    }),
  })

  assert.equal(res.status, 202)
  assert.ok(res.headers.get('x-message-id'))

  await service.close()
})

test('sendgrid fails email when reference says failed', async () => {
  const service = MOCKS.sendgrid.create()
  await service.listen(0, '127.0.0.1')

  const email = await post(`${service.url}/v3/mail/send`, {
    from: { email: 'failed@example.com' },
    personalizations: [{ to: [{ email: 'to@example.com' }] }],
    subject: 'Failed',
  })

  assert.equal(email.status, 400)
  assert.ok(email.json.errors)

  await service.close()
})

test('sendgrid adds contacts', async () => {
  const service = MOCKS.sendgrid.create()
  await service.listen(0, '127.0.0.1')

  const contacts = await post(`${service.url}/v3/marketing/contacts`, {
    contacts: [{ email: 'contact1@example.com', first_name: 'John', last_name: 'Doe' }],
  })

  assert.equal(contacts.status, 201)
  assert.ok(contacts.json.job_id)
  assert.ok(contacts.json.added.length === 1)

  await service.close()
})

test('sendgrid manages suppression lists', async () => {
  const service = MOCKS.sendgrid.create()
  await service.listen(0, '127.0.0.1')

  const add = await post(`${service.url}/v3/suppression/bounces`, {
    emails: ['bounce@example.com'],
  })

  assert.equal(add.status, 201)
  assert.equal(add.json.deleted, 1)

  const getResult = await get(`${service.url}/v3/suppression/bounces`)
  assert.equal(getResult.status, 200)
  assert.ok(getResult.json.some((s) => s.email === 'bounce@example.com'))

  const remove = await del(`${service.url}/v3/suppression/bounces`, {
    emails: ['bounce@example.com'],
  })

  assert.equal(remove.status, 200)
  assert.equal(remove.json.deleted, 1)

  await service.close()
})
