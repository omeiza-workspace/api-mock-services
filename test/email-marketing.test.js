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

const put = async (url, body) => {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

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

  try {
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
  } catch (e) {
    console.error('TEST FAILED:', e.message)
    console.error(e.stack)
    throw e
  } finally {
    await service.close()
  }
})

test('mailchimp creates a list', async () => {
  const service = MOCKS.mailchimp.create()
  await service.listen(0, '127.0.0.1')

  // Get token first
  const token = await post(`${service.url}/oauth2/token`, {})
  assert.equal(token.status, 200)

  const list = await post(`${service.url}/3.0/lists`, {
    name: 'Test List',
    contact: { company: 'Test', address1: '123 Main St', city: 'SF', state: 'CA', zip: '94105', country: 'US' },
    permission_reminder: 'You signed up',
    campaign_defaults: { from_name: 'Test', from_email: 'from@example.com', subject: 'Test', language: 'en' },
  })

  assert.equal(list.status, 201)
  assert.ok(list.json.id)
  assert.equal(list.json.name, 'Test List')

  await service.close()
})

test('mailchimp adds a member', async () => {
  const service = MOCKS.mailchimp.create()
  await service.listen(0, '127.0.0.1')

  const list = await post(`${service.url}/3.0/lists`, { name: 'Test List' })
  assert.equal(list.status, 201)

  const member = await post(`${service.url}/3.0/lists/${list.json.id}/members`, {
    email_address: 'member@example.com',
    status: 'subscribed',
    merge_fields: { FNAME: 'John', LNAME: 'Doe' },
  })

  assert.equal(member.status, 201)
  assert.equal(member.json.email_address, 'member@example.com')
  assert.equal(member.json.status, 'subscribed')

  await service.close()
})

test('mailchimp fails member when email says failed', async () => {
  const service = MOCKS.mailchimp.create()
  await service.listen(0, '127.0.0.1')

  const list = await post(`${service.url}/3.0/lists`, { name: 'Test List' })
  assert.equal(list.status, 201)

  const member = await post(`${service.url}/3.0/lists/${list.json.id}/members`, {
    email_address: 'failed@example.com',
  })

  assert.equal(member.status, 400)

  await service.close()
})

test('mailchimp creates a campaign', async () => {
  const service = MOCKS.mailchimp.create()
  await service.listen(0, '127.0.0.1')

  const campaign = await post(`${service.url}/3.0/campaigns`, {
    type: 'regular',
    recipients: { list_id: '1' },
    settings: { subject_line: 'Test Campaign', from_name: 'Test', reply_to: 'reply@example.com' },
  })

  assert.equal(campaign.status, 201)
  assert.ok(campaign.json.id)
  assert.equal(campaign.json.settings.subject_line, 'Test Campaign')

  await service.close()
})

test('klaviyo creates a profile', async () => {
  const service = MOCKS.klaviyo.create()
  await service.listen(0, '127.0.0.1')

  const profile = await post(`${service.url}/api/profiles`, {
    data: { type: 'profile', attributes: { email: 'profile@example.com', first_name: 'John', last_name: 'Doe' } },
  })

  assert.equal(profile.status, 201)
  assert.ok(profile.json.data.id)
  assert.equal(profile.json.data.attributes.email, 'profile@example.com')

  await service.close()
})

test('klaviyo fails profile when email says failed', async () => {
  const service = MOCKS.klaviyo.create()
  await service.listen(0, '127.0.0.1')

  const profile = await post(`${service.url}/api/profiles`, {
    data: { type: 'profile', attributes: { email: 'failed@example.com' } },
  })

  assert.equal(profile.status, 400)

  await service.close()
})

test('klaviyo creates a list', async () => {
  const service = MOCKS.klaviyo.create()
  await service.listen(0, '127.0.0.1')

  const list = await post(`${service.url}/api/lists`, {
    data: { type: 'list', attributes: { name: 'Test List' } },
  })

  assert.equal(list.status, 201)
  assert.ok(list.json.data.id)
  assert.equal(list.json.data.attributes.name, 'Test List')

  await service.close()
})

test('klaviyo creates a campaign', async () => {
  const service = MOCKS.klaviyo.create()
  await service.listen(0, '127.0.0.1')

  const campaign = await post(`${service.url}/api/campaigns`, {
    data: { type: 'campaign', attributes: { name: 'Test Campaign', subject: 'Test Subject', from_email: 'from@example.com', from_name: 'Test' } },
  })

  assert.equal(campaign.status, 201)
  assert.ok(campaign.json.data.id)
  assert.equal(campaign.json.data.attributes.name, 'Test Campaign')

  await service.close()
})

test('postmark sends an email', async () => {
  const service = MOCKS.postmark.create()
  await service.listen(0, '127.0.0.1')

  const email = await post(`${service.url}/email`, {
    From: 'from@example.com',
    To: 'to@example.com',
    Subject: 'Test Subject',
    HtmlBody: '<html><body>Test</body></html>',
    TextBody: 'Test',
  })

  assert.equal(email.status, 200)
  assert.ok(email.json.MessageID)
  assert.equal(email.json.ErrorCode, 0)

  await service.close()
})

test('postmark fails email when reference says failed', async () => {
  const service = MOCKS.postmark.create()
  await service.listen(0, '127.0.0.1')

  const email = await post(`${service.url}/email`, {
    From: 'failed@example.com',
    To: 'to@example.com',
    Subject: 'Failed',
  })

  assert.equal(email.status, 422)
  assert.ok(email.json.ErrorCode !== 0)

  await service.close()
})

test('postmark sends batch emails', async () => {
  const service = MOCKS.postmark.create()
  await service.listen(0, '127.0.0.1')

  const batch = await post(`${service.url}/email/batch`, [
    { From: 'from@example.com', To: 'to1@example.com', Subject: 'Test 1' },
    { From: 'from@example.com', To: 'to2@example.com', Subject: 'Test 2' },
  ])

  assert.equal(batch.status, 200)
  assert.equal(batch.json.length, 2)
  assert.ok(batch.json.every((e) => e.ErrorCode === 0))

  await service.close()
})

test('postmark manages templates', async () => {
  const service = MOCKS.postmark.create()
  await service.listen(0, '127.0.0.1')

  const template = await post(`${service.url}/templates`, {
    Name: 'Test Template',
    Subject: 'Test Subject',
    HtmlBody: '<html><body>Test</body></html>',
    TextBody: 'Test',
  })

  assert.equal(template.status, 201)
  assert.ok(template.json.TemplateId)
  assert.equal(template.json.Name, 'Test Template')

  await service.close()
})

test('postmark gets stats', async () => {
  const service = MOCKS.postmark.create()
  await service.listen(0, '127.0.0.1')

  await post(`${service.url}/email`, { From: 'from@example.com', To: 'to@example.com', Subject: 'Test' })

  const stats = await get(`${service.url}/stats/outbound`)
  assert.equal(stats.status, 200)
  assert.ok(stats.json.Sent >= 1)

  await service.close()
})

test('every new email marketing mock answers /_mock', async () => {
  for (const name of ['sendgrid', 'mailchimp', 'klaviyo', 'postmark']) {
    const service = MOCKS[name].create()
    await service.listen(0, '127.0.0.1')

    const res = await fetch(`${service.url}/_mock`)
    const json = await res.json()

    assert.equal(json.kind, 'mock')
    assert.equal(json.service, name)
    assert.equal(json.real_service, false)

    await service.close()
  }
})

test('every new email marketing mock answers /_openapi', async () => {
  for (const name of ['sendgrid', 'mailchimp', 'klaviyo', 'postmark']) {
    const service = MOCKS[name].create()
    await service.listen(0, '127.0.0.1')

    const res = await fetch(`${service.url}/_openapi`)
    const spec = await res.json()

    assert.ok(spec.openapi)
    assert.ok(spec.info.title.includes(name))
    assert.ok(Object.keys(spec.paths).length > 0)

    await service.close()
  }
})
