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

test('segment tracks an event', async () => {
  const service = MOCKS.segment.create()
  await service.listen(0, '127.0.0.1')

  const track = await post(`${service.url}/v1/track`, {
    userId: 'user_123',
    event: 'Button Clicked',
    properties: { button: 'submit' },
  })

  assert.equal(track.status, 200)
  assert.ok(track.json.messageId)
  assert.equal(track.json.success, true)

  await service.close()
})

test('segment fails track when event says failed', async () => {
  const service = MOCKS.segment.create()
  await service.listen(0, '127.0.0.1')

  const track = await post(`${service.url}/v1/track`, {
    userId: 'user_123',
    event: 'failed_event',
  })

  assert.equal(track.status, 400)

  await service.close()
})

test('segment identifies a user', async () => {
  const service = MOCKS.segment.create()
  await service.listen(0, '127.0.0.1')

  const identify = await post(`${service.url}/v1/identify`, {
    userId: 'user_123',
    traits: { name: 'John Doe', email: 'john@example.com' },
  })

  assert.equal(identify.status, 200)
  assert.equal(identify.json.success, true)

  await service.close()
})

test('segment groups a user', async () => {
  const service = MOCKS.segment.create()
  await service.listen(0, '127.0.0.1')

  const group = await post(`${service.url}/v1/group`, {
    userId: 'user_123',
    groupId: 'group_456',
    traits: { name: 'Acme Inc' },
  })

  assert.equal(group.status, 200)
  assert.equal(group.json.success, true)

  await service.close()
})

test('segment aliases a user', async () => {
  const service = MOCKS.segment.create()
  await service.listen(0, '127.0.0.1')

  const alias = await post(`${service.url}/v1/alias`, {
    userId: 'user_123',
    previousId: 'anon_789',
  })

  assert.equal(alias.status, 200)
  assert.equal(alias.json.success, true)

  await service.close()
})

test('segment tracks a page', async () => {
  const service = MOCKS.segment.create()
  await service.listen(0, '127.0.0.1')

  const page = await post(`${service.url}/v1/page`, {
    userId: 'user_123',
    name: 'Home Page',
  })

  assert.equal(page.status, 200)
  assert.equal(page.json.success, true)

  await service.close()
})

test('segment batch endpoint', async () => {
  const service = MOCKS.segment.create()
  await service.listen(0, '127.0.0.1')

  const batch = await post(`${service.url}/v1/batch`, [
    { type: 'track', userId: 'user_1', event: 'Event 1' },
    { type: 'track', userId: 'user_2', event: 'Event 2' },
  ])

  assert.equal(batch.status, 200)
  assert.equal(batch.json.length, 2)
  assert.ok(batch.json.every((r) => r.success))

  await service.close()
})

test('mixpanel tracks an event', async () => {
  const service = MOCKS.mixpanel.create()
  await service.listen(0, '127.0.0.1')

  const track = await post(`${service.url}/track`, {
    event: 'Button Clicked',
    properties: { distinct_id: 'user_123', button: 'submit' },
  })

  assert.equal(track.status, 200)
  assert.equal(track.json, 1)

  await service.close()
})

test('mixpanel fails track when event says failed', async () => {
  const service = MOCKS.mixpanel.create()
  await service.listen(0, '127.0.0.1')

  const track = await post(`${service.url}/track`, {
    event: 'failed_event',
    properties: { distinct_id: 'user_123' },
  })

  assert.equal(track.status, 400)

  await service.close()
})

test('mixpanel engages a user', async () => {
  const service = MOCKS.mixpanel.create()
  await service.listen(0, '127.0.0.1')

  const engage = await post(`${service.url}/engage`, {
    $distinct_id: 'user_123',
    $set: { name: 'John Doe', email: 'john@example.com' },
  })

  assert.equal(engage.status, 200)
  assert.equal(engage.json.status, 1)

  await service.close()
})

test('mixpanel imports events', async () => {
  const service = MOCKS.mixpanel.create()
  await service.listen(0, '127.0.0.1')

  const importRes = await post(`${service.url}/import`, [
    { event: 'Event 1', properties: { distinct_id: 'user_1', time: Math.floor(Date.now() / 1000) } },
    { event: 'Event 2', properties: { distinct_id: 'user_2', time: Math.floor(Date.now() / 1000) } },
  ])

  assert.equal(importRes.status, 200)
  assert.ok(importRes.json.import_id)

  await service.close()
})

test('mixpanel exports events', async () => {
  const service = MOCKS.mixpanel.create()
  await service.listen(0, '127.0.0.1')

  // First track an event
  await post(`${service.url}/track`, { event: 'Test', properties: { distinct_id: 'user_1' } })

  const exportRes = await get(`${service.url}/export?from_date=2024-01-01&to_date=2024-12-31`)
  assert.equal(exportRes.status, 200)
  assert.ok(Array.isArray(exportRes.json))

  await service.close()
})

test('amplitude tracks events', async () => {
  const service = MOCKS.amplitude.create()
  await service.listen(0, '127.0.0.1')

  const track = await post(`${service.url}/2/httpapi`, {
    events: [
      { event_type: 'Button Clicked', user_id: 'user_123', event_properties: { button: 'submit' } },
    ],
  })

  assert.equal(track.status, 200)
  assert.equal(track.json.code, 200)
  assert.ok(track.json.events[0].status === 200)

  await service.close()
})

test('amplitude fails track when event says failed', async () => {
  const service = MOCKS.amplitude.create()
  await service.listen(0, '127.0.0.1')

  const track = await post(`${service.url}/2/httpapi`, {
    events: [{ event_type: 'failed_event', user_id: 'user_123' }],
  })

  assert.equal(track.status, 200)
  assert.equal(track.json.code, 400)

  await service.close()
})

test('amplitude identifies a user', async () => {
  const service = MOCKS.amplitude.create()
  await service.listen(0, '127.0.0.1')

  const identify = await post(`${service.url}/identify`, {
    identifications: [{ user_id: 'user_123', user_properties: { name: 'John Doe' } }],
  })

  assert.equal(identify.status, 200)
  assert.equal(identify.json.code, 200)

  await service.close()
})

test('amplitude batch upload', async () => {
  const service = MOCKS.amplitude.create()
  await service.listen(0, '127.0.0.1')

  const batch = await post(`${service.url}/batch`, {
    uploads: [
      { events: [{ event_type: 'Event 1', user_id: 'user_1' }] },
      { events: [{ event_type: 'Event 2', user_id: 'user_2' }] },
    ],
  })

  assert.equal(batch.status, 200)
  assert.equal(batch.json.code, 200)

  await service.close()
})

test('rudderstack tracks an event', async () => {
  const service = MOCKS.rudderstack.create()
  await service.listen(0, '127.0.0.1')

  const track = await post(`${service.url}/v1/track`, {
    userId: 'user_123',
    event: 'Button Clicked',
    properties: { button: 'submit' },
  })

  assert.equal(track.status, 200)
  assert.ok(track.json.messageId)
  assert.equal(track.json.success, true)

  await service.close()
})

test('rudderstack fails track when event says failed', async () => {
  const service = MOCKS.rudderstack.create()
  await service.listen(0, '127.0.0.1')

  const track = await post(`${service.url}/v1/track`, {
    userId: 'user_123',
    event: 'failed_event',
  })

  assert.equal(track.status, 400)

  await service.close()
})

test('rudderstack identifies a user', async () => {
  const service = MOCKS.rudderstack.create()
  await service.listen(0, '127.0.0.1')

  const identify = await post(`${service.url}/v1/identify`, {
    userId: 'user_123',
    traits: { name: 'John Doe', email: 'john@example.com' },
  })

  assert.equal(identify.status, 200)
  assert.equal(identify.json.success, true)

  await service.close()
})

test('rudderstack groups a user', async () => {
  const service = MOCKS.rudderstack.create()
  await service.listen(0, '127.0.0.1')

  const group = await post(`${service.url}/v1/group`, {
    userId: 'user_123',
    groupId: 'group_456',
    traits: { name: 'Acme Inc' },
  })

  assert.equal(group.status, 200)
  assert.equal(group.json.success, true)

  await service.close()
})

test('rudderstack aliases a user', async () => {
  const service = MOCKS.rudderstack.create()
  await service.listen(0, '127.0.0.1')

  const alias = await post(`${service.url}/v1/alias`, {
    userId: 'user_123',
    previousId: 'anon_789',
  })

  assert.equal(alias.status, 200)
  assert.equal(alias.json.success, true)

  await service.close()
})

test('rudderstack tracks a page', async () => {
  const service = MOCKS.rudderstack.create()
  await service.listen(0, '127.0.0.1')

  const page = await post(`${service.url}/v1/page`, {
    userId: 'user_123',
    name: 'Home Page',
  })

  assert.equal(page.status, 200)
  assert.equal(page.json.success, true)

  await service.close()
})

test('rudderstack batch endpoint', async () => {
  const service = MOCKS.rudderstack.create()
  await service.listen(0, '127.0.0.1')

  const batch = await post(`${service.url}/v1/batch`, [
    { type: 'track', userId: 'user_1', event: 'Event 1' },
    { type: 'track', userId: 'user_2', event: 'Event 2' },
  ])

  assert.equal(batch.status, 200)
  assert.equal(batch.json.length, 2)
  assert.ok(batch.json.every((r) => r.success))

  await service.close()
})

test('every new analytics mock answers /_mock', async () => {
  for (const name of ['segment', 'mixpanel', 'amplitude', 'rudderstack']) {
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

test('every new analytics mock answers /_openapi', async () => {
  for (const name of ['segment', 'mixpanel', 'amplitude', 'rudderstack']) {
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
