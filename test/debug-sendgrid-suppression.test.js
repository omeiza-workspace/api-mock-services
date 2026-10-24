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

test('sendgrid manages suppression lists - debug', async () => {
  const service = MOCKS.sendgrid.create()
  await service.listen(0, '127.0.0.1')

  try {
    const add = await post(`${service.url}/v3/suppression/bounces`, {
      emails: ['bounce@example.com'],
    })
    console.log('add:', add.status, add.json)
    assert.equal(add.status, 201)
    assert.equal(add.json.deleted, 1)

    const getResult = await get(`${service.url}/v3/suppression/bounces`)
    console.log('get:', getResult.status, getResult.json)
    assert.equal(getResult.status, 200)
    assert.ok(getResult.json.some((s) => s.email === 'bounce@example.com'))

    const remove = await del(`${service.url}/v3/suppression/bounces`, {
      emails: ['bounce@example.com'],
    })
    console.log('remove:', remove.status, remove.json)
    assert.equal(remove.status, 200)
    assert.equal(remove.json.deleted, 1)

    console.log('All assertions passed!')
  } catch (e) {
    console.error('Test failed:', e.message)
    console.error(e.stack)
    throw e
  } finally {
    await service.close()
  }
})
