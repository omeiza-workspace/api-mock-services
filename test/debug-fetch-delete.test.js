import { test } from 'node:test'
import assert from 'node:assert/strict'

test('fetch DELETE with body works', async () => {
  const res = await fetch('http://httpbin.org/delete', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ test: 'value' }),
  })
  const json = await res.json()
  console.log('status:', res.status)
  console.log('json:', json)
  assert.equal(res.status, 200)
})
