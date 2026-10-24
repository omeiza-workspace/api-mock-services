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

test('avalara calculates tax', async () => {
  const service = MOCKS.avalara.create()
  await service.listen(0, '127.0.0.1')

  const transaction = await post(`${service.url}/api/v2/transactions/create`, {
    code: 'AVALARA-TXN-001',
    type: 'SalesInvoice',
    lines: [
      { number: '1', quantity: 1, amount: 100, taxCode: 'P0000000', description: 'Test Product' },
    ],
  })

  assert.equal(transaction.status, 200)
  assert.ok(transaction.json.id)
  assert.equal(transaction.json.code, 'AVALARA-TXN-001')
  assert.ok(transaction.json.totalTax > 0)

  await service.close()
})

test('avalara fails tax when reference says failed', async () => {
  const service = MOCKS.avalara.create()
  await service.listen(0, '127.0.0.1')

  const transaction = await post(`${service.url}/api/v2/transactions/create`, {
    code: 'failed_txn',
  })

  assert.equal(transaction.status, 400)

  await service.close()
})

test('avalara calculates tax (calculate endpoint)', async () => {
  const service = MOCKS.avalara.create()
  await service.listen(0, '127.0.0.1')

  const calc = await post(`${service.url}/api/v2/transactions/calculate`, {
    code: 'CALC-001',
    lines: [{ number: '1', quantity: 1, amount: 200, taxCode: 'P0000000' }],
  })

  assert.equal(calc.status, 200)
  assert.ok(calc.json.totalTax > 0)

  await service.close()
})

test('avalara validates address', async () => {
  const service = MOCKS.avalara.create()
  await service.listen(0, '127.0.0.1')

  const address = await post(`${service.url}/api/v2/addresses/resolve`, {
    line1: '123 Main St',
    city: 'San Francisco',
    region: 'CA',
    postalCode: '94105',
    country: 'US',
  })

  assert.equal(address.status, 200)
  assert.ok(address.json.id)
  assert.equal(address.json.resolutionQuality, 'Intersection')

  await service.close()
})

test('avalara gets tax codes', async () => {
  const service = MOCKS.avalara.create()
  await service.listen(0, '127.0.0.1')

  const codes = await get(`${service.url}/api/v2/definitions/taxcodes`)
  assert.equal(codes.status, 200)
  assert.ok(Array.isArray(codes.json.value))
  assert.ok(codes.json.value.some((c) => c.taxCode === 'P0000000'))

  await service.close()
})

test('taxjar calculates tax', async () => {
  const service = MOCKS.taxjar.create()
  await service.listen(0, '127.0.0.1')

  const tax = await post(`${service.url}/v2/taxes`, {
    from_country: 'US',
    from_zip: '94105',
    from_state: 'CA',
    to_country: 'US',
    to_zip: '94105',
    to_state: 'CA',
    amount: 100,
  })

  assert.equal(tax.status, 200)
  assert.ok(tax.json.tax.amount_to_collect > 0)
  assert.equal(tax.json.tax.has_nexus, true)

  await service.close()
})

test('taxjar fails tax when zip says failed', async () => {
  const service = MOCKS.taxjar.create()
  await service.listen(0, '127.0.0.1')

  const tax = await post(`${service.url}/v2/taxes`, {
    from_zip: 'failed_zip',
    to_zip: '94105',
  })

  assert.equal(tax.status, 422)

  await service.close()
})

test('taxjar gets rate for zip', async () => {
  const service = MOCKS.taxjar.create()
  await service.listen(0, '127.0.0.1')

  const rate = await get(`${service.url}/v2/rates/94105`)
  assert.equal(rate.status, 200)
  assert.equal(rate.json.rate.zip, '94105')
  assert.ok(rate.json.rate.combined_rate > 0)

  await service.close()
})

test('taxjar gets categories', async () => {
  const service = MOCKS.taxjar.create()
  await service.listen(0, '127.0.0.1')

  const categories = await get(`${service.url}/v2/categories`)
  assert.equal(categories.status, 200)
  assert.ok(Array.isArray(categories.json.categories))
  assert.ok(categories.json.categories.some((c) => c.name === 'Clothing'))

  await service.close()
})

test('taxjar gets nexus', async () => {
  const service = MOCKS.taxjar.create()
  await service.listen(0, '127.0.0.1')

  const nexus = await get(`${service.url}/v2/nexus`)
  assert.equal(nexus.status, 200)
  assert.ok(Array.isArray(nexus.json.nexus))
  assert.ok(nexus.json.nexus.some((n) => n.state === 'CA' && n.has_nexus))

  await service.close()
})

test('vertex calculates tax', async () => {
  const service = MOCKS.vertex.create()
  await service.listen(0, '127.0.0.1')

  const transaction = await post(`${service.url}/api/v1/calculatetax`, {
    invoice: {
      number: 'VERTEX-INV-001',
      lines: [
        { lineNumber: '1', quantity: 1, unitPrice: 100, taxCode: 'P0000000', description: 'Test Product' },
      ],
    },
  })

  assert.equal(transaction.status, 200)
  assert.ok(transaction.json.invoice.totalTax > 0)
  assert.equal(transaction.json.invoice.status, 'Success')

  await service.close()
})

test('vertex fails tax when reference says failed', async () => {
  const service = MOCKS.vertex.create()
  await service.listen(0, '127.0.0.1')

  const transaction = await post(`${service.url}/api/v1/calculatetax`, {
    invoice: { number: 'failed_invoice' },
  })

  assert.equal(transaction.status, 400)

  await service.close()
})

test('vertex cleanses address', async () => {
  const service = MOCKS.vertex.create()
  await service.listen(0, '127.0.0.1')

  const address = await post(`${service.url}/api/v1/cleanseaddress`, {
    address: { line1: '123 Main St', city: 'San Francisco', region: 'CA', postalCode: '94105', country: 'US' },
  })

  assert.equal(address.status, 200)
  assert.ok(address.json.address.id)
  assert.equal(address.json.address.status, 'Valid')

  await service.close()
})

test('vertex gets tax codes', async () => {
  const service = MOCKS.vertex.create()
  await service.listen(0, '127.0.0.1')

  const codes = await get(`${service.url}/api/v1/taxcodes`)
  assert.equal(codes.status, 200)
  assert.ok(Array.isArray(codes.json.taxCodes))
  assert.ok(codes.json.taxCodes.some((c) => c.code === 'P0000000'))

  await service.close()
})

test('every new tax mock answers /_mock', async () => {
  for (const name of ['avalara', 'taxjar', 'vertex']) {
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

test('every new tax mock answers /_openapi', async () => {
  for (const name of ['avalara', 'taxjar', 'vertex']) {
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
