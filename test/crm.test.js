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

const patch = async (url, body) => {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, json: await res.json() }
}

test('hubspot creates a contact', async () => {
  const service = MOCKS.hubspot.create()
  await service.listen(0, '127.0.0.1')

  const contact = await post(`${service.url}/crm/v3/objects/contacts`, {
    properties: { email: 'test@example.com', firstname: 'John', lastname: 'Doe' },
  })

  assert.equal(contact.status, 201)
  assert.ok(contact.json.id)
  assert.equal(contact.json.properties.email, 'test@example.com')

  await service.close()
})

test('hubspot fails contact when email says failed', async () => {
  const service = MOCKS.hubspot.create()
  await service.listen(0, '127.0.0.1')

  const contact = await post(`${service.url}/crm/v3/objects/contacts`, {
    properties: { email: 'failed@example.com' },
  })

  assert.equal(contact.status, 400)

  await service.close()
})

test('hubspot creates a company', async () => {
  const service = MOCKS.hubspot.create()
  await service.listen(0, '127.0.0.1')

  const company = await post(`${service.url}/crm/v3/objects/companies`, {
    properties: { name: 'Test Company', domain: 'test.com' },
  })

  assert.equal(company.status, 201)
  assert.ok(company.json.id)
  assert.equal(company.json.properties.name, 'Test Company')

  await service.close()
})

test('hubspot creates a deal', async () => {
  const service = MOCKS.hubspot.create()
  await service.listen(0, '127.0.0.1')

  const deal = await post(`${service.url}/crm/v3/objects/deals`, {
    properties: { dealname: 'Test Deal', amount: '1000', dealstage: 'appointmentscheduled' },
  })

  assert.equal(deal.status, 201)
  assert.ok(deal.json.id)
  assert.equal(deal.json.properties.dealname, 'Test Deal')

  await service.close()
})

test('salesforce creates a record', async () => {
  const service = MOCKS.salesforce.create()
  await service.listen(0, '127.0.0.1')

  const record = await post(`${service.url}/services/data/v58.0/sobjects/Account`, {
    Name: 'Test Account',
  })

  assert.equal(record.status, 201)
  assert.ok(record.json.id)
  assert.equal(record.json.success, true)

  await service.close()
})

test('salesforce fails record when reference says failed', async () => {
  const service = MOCKS.salesforce.create()
  await service.listen(0, '127.0.0.1')

  const record = await post(`${service.url}/services/data/v58.0/sobjects/Account`, {
    Name: 'failed_account',
  })

  assert.equal(record.status, 400)
  assert.equal(record.json.success, false)

  await service.close()
})

test('salesforce queries records', async () => {
  const service = MOCKS.salesforce.create()
  await service.listen(0, '127.0.0.1')

  const query = await get(`${service.url}/services/data/v58.0/query?q=SELECT+Id,Name+FROM+Account`)
  assert.equal(query.status, 200)
  assert.ok(query.json.totalSize >= 0)
  assert.ok(Array.isArray(query.json.records))

  await service.close()
})

test('salesforce composite batch', async () => {
  const service = MOCKS.salesforce.create()
  await service.listen(0, '127.0.0.1')

  const batch = await post(`${service.url}/services/data/v58.0/composite`, {
    compositeRequest: [
      { method: 'POST', url: '/services/data/v58.0/sobjects/Account', referenceId: 'ref1', body: { Name: 'Account 1' } },
      { method: 'POST', url: '/services/data/v58.0/sobjects/Contact', referenceId: 'ref2', body: { LastName: 'Contact 1' } },
    ],
  })

  assert.equal(batch.status, 200)
  assert.ok(batch.json.compositeResponse.length === 2)

  await service.close()
})

test('pipedrive creates a person', async () => {
  const service = MOCKS.pipedrive.create()
  await service.listen(0, '127.0.0.1')

  const person = await post(`${service.url}/v1/persons`, {
    name: 'John Doe',
    email: [{ value: 'john@example.com', primary: true }],
  })

  assert.equal(person.status, 201)
  assert.ok(person.json.data.id)
  assert.equal(person.json.data.name, 'John Doe')

  await service.close()
})

test('pipedrive fails person when name says failed', async () => {
  const service = MOCKS.pipedrive.create()
  await service.listen(0, '127.0.0.1')

  const person = await post(`${service.url}/v1/persons`, {
    name: 'failed_person',
  })

  assert.equal(person.status, 400)
  assert.equal(person.json.success, false)

  await service.close()
})

test('pipedrive creates an organization', async () => {
  const service = MOCKS.pipedrive.create()
  await service.listen(0, '127.0.0.1')

  const org = await post(`${service.url}/v1/organizations`, {
    name: 'Test Org',
  })

  assert.equal(org.status, 201)
  assert.ok(org.json.data.id)
  assert.equal(org.json.data.name, 'Test Org')

  await service.close()
})

test('pipedrive creates a deal', async () => {
  const service = MOCKS.pipedrive.create()
  await service.listen(0, '127.0.0.1')

  const deal = await post(`${service.url}/v1/deals`, {
    title: 'Test Deal',
    value: 1000,
    currency: 'USD',
  })

  assert.equal(deal.status, 201)
  assert.ok(deal.json.data.id)
  assert.equal(deal.json.data.title, 'Test Deal')

  await service.close()
})

test('attio creates an object', async () => {
  const service = MOCKS.attio.create()
  await service.listen(0, '127.0.0.1')

  const object = await post(`${service.url}/v2/objects`, {
    api_slug: 'custom_object',
    name: 'Custom Object',
  })

  assert.equal(object.status, 201)
  assert.ok(object.json.data.api_slug)
  assert.equal(object.json.data.name, 'Custom Object')

  await service.close()
})

test('attio fails object when reference says failed', async () => {
  const service = MOCKS.attio.create()
  await service.listen(0, '127.0.0.1')

  const object = await post(`${service.url}/v2/objects`, {
    api_slug: 'failed_object',
  })

  assert.equal(object.status, 400)

  await service.close()
})

test('attio creates a record', async () => {
  const service = MOCKS.attio.create()
  await service.listen(0, '127.0.0.1')

  // First create an object
  await post(`${service.url}/v2/objects`, { api_slug: 'company', name: 'Company' })

  const record = await post(`${service.url}/v2/objects/company/records`, {
    values: { name: 'Test Company' },
  })

  assert.equal(record.status, 201)
  assert.ok(record.json.data.id)

  await service.close()
})

test('attio creates a list', async () => {
  const service = MOCKS.attio.create()
  await service.listen(0, '127.0.0.1')

  const list = await post(`${service.url}/v2/lists`, {
    name: 'Test List',
    object: 'company',
  })

  assert.equal(list.status, 201)
  assert.ok(list.json.data.id)
  assert.equal(list.json.data.name, 'Test List')

  await service.close()
})

test('every new CRM mock answers /_mock', async () => {
  for (const name of ['hubspot', 'salesforce', 'pipedrive', 'attio']) {
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

test('every new CRM mock answers /_openapi', async () => {
  for (const name of ['hubspot', 'salesforce', 'pipedrive', 'attio']) {
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
