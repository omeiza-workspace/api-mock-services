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

test('square-terminal creates a checkout', async () => {
  const service = MOCKS['square-terminal'].create()
  await service.listen(0, '127.0.0.1')

  const checkout = await post(`${service.url}/v2/terminals/checkouts`, {
    idempotency_key: 'idem_sq_1',
    amount_money: { amount: 1000, currency: 'USD' },
  })

  assert.equal(checkout.status, 200)
  assert.ok(checkout.json.checkout.id)
  assert.equal(checkout.json.checkout.status, 'OPEN')

  await service.close()
})

test('square-terminal fails checkout when reference says failed', async () => {
  const service = MOCKS['square-terminal'].create()
  await service.listen(0, '127.0.0.1')

  const checkout = await post(`${service.url}/v2/terminals/checkouts`, {
    idempotency_key: 'failed_checkout',
  })

  assert.equal(checkout.status, 400)

  await service.close()
})

test('square-terminal cancels a checkout', async () => {
  const service = MOCKS['square-terminal'].create()
  await service.listen(0, '127.0.0.1')

  const checkout = await post(`${service.url}/v2/terminals/checkouts`, {
    idempotency_key: 'idem_sq_cancel',
  })
  const checkoutId = checkout.json.checkout.id

  const cancel = await post(`${service.url}/v2/terminals/checkouts/${checkoutId}/cancel`, {})
  assert.equal(cancel.status, 200)
  assert.equal(cancel.json.checkout.status, 'CANCELED')

  await service.close()
})

test('clover creates an order', async () => {
  const service = MOCKS.clover.create()
  await service.listen(0, '127.0.0.1')

  // Get token first
  const token = await post(`${service.url}/oauth/token`, {})
  assert.equal(token.status, 200)

  const order = await post(`${service.url}/v3/merchants/1/orders`, {
    total: 10000,
    currency: 'USD',
  })

  assert.equal(order.status, 201)
  assert.ok(order.json.id)
  assert.equal(order.json.total, 10000)

  await service.close()
})

test('clover fails order when reference says failed', async () => {
  const service = MOCKS.clover.create()
  await service.listen(0, '127.0.0.1')

  const order = await post(`${service.url}/v3/merchants/1/orders`, {
    total: 10000,
    id: 'failed_order',
  })

  assert.equal(order.status, 400)

  await service.close()
})

test('clover creates a payment', async () => {
  const service = MOCKS.clover.create()
  await service.listen(0, '127.0.0.1')

  // Create order first
  const order = await post(`${service.url}/v3/merchants/1/orders`, { total: 10000 })
  const orderId = order.json.id

  const payment = await post(`${service.url}/v3/merchants/1/orders/${orderId}/payments`, {
    amount: 10000,
  })

  assert.equal(payment.status, 201)
  assert.ok(payment.json.id)
  assert.equal(payment.json.status, 'paid')

  await service.close()
})

test('clover creates an item', async () => {
  const service = MOCKS.clover.create()
  await service.listen(0, '127.0.0.1')

  const item = await post(`${service.url}/v3/merchants/1/items`, {
    name: 'Test Item',
    price: 10000,
  })

  assert.equal(item.status, 201)
  assert.ok(item.json.id)
  assert.equal(item.json.name, 'Test Item')

  await service.close()
})

test('toast creates an order', async () => {
  const service = MOCKS.toast.create()
  await service.listen(0, '127.0.0.1')

  // Get token first
  const token = await post(`${service.url}/authentication/v1/authentication/login`, {})
  assert.equal(token.status, 200)

  const order = await post(`${service.url}/orders/v2/orders`, {
    selections: [{ itemGuid: 'item_1', quantity: 1, price: 10000 }],
  })

  assert.equal(order.status, 201)
  assert.ok(order.json.guid)
  assert.equal(order.json.status, 'OPEN')

  await service.close()
})

test('toast fails order when reference says failed', async () => {
  const service = MOCKS.toast.create()
  await service.listen(0, '127.0.0.1')

  const order = await post(`${service.url}/orders/v2/orders`, {
    id: 'failed_order',
  })

  assert.equal(order.status, 400)

  await service.close()
})

test('toast voids an order', async () => {
  const service = MOCKS.toast.create()
  await service.listen(0, '127.0.0.1')

  const order = await post(`${service.url}/orders/v2/orders`, {
    selections: [{ itemGuid: 'item_1', quantity: 1, price: 10000 }],
  })
  const orderId = order.json.guid

  const voided = await post(`${service.url}/orders/v2/orders/${orderId}/void`, {})
  assert.equal(voided.status, 200)
  assert.equal(voided.json.status, 'VOIDED')

  await service.close()
})

test('toast creates a payment', async () => {
  const service = MOCKS.toast.create()
  await service.listen(0, '127.0.0.1')

  const order = await post(`${service.url}/orders/v2/orders`, {
    selections: [{ itemGuid: 'item_1', quantity: 1, price: 10000 }],
  })
  const orderId = order.json.guid

  const payment = await post(`${service.url}/orders/v2/orders/${orderId}/payments`, {
    amount: 10875,
  })

  assert.equal(payment.status, 201)
  assert.ok(payment.json.guid)
  assert.equal(payment.json.status, 'AUTHORIZED')

  await service.close()
})

test('toast creates a menu item', async () => {
  const service = MOCKS.toast.create()
  await service.listen(0, '127.0.0.1')

  const item = await post(`${service.url}/menu/v2/menuItems`, {
    name: 'Test Item',
    price: 10000,
  })

  assert.equal(item.status, 201)
  assert.ok(item.json.guid)
  assert.equal(item.json.name, 'Test Item')

  await service.close()
})

test('lightspeed creates a sale', async () => {
  const service = MOCKS.lightspeed.create()
  await service.listen(0, '127.0.0.1')

  // Get token first
  const token = await post(`${service.url}/oauth/access_token.php`, {})
  assert.equal(token.status, 200)

  const sale = await post(`${service.url}/api/v1/sales.json`, {
    registerID: '1',
    employeeID: '1',
    total: 10000,
    taxTotal: 875,
    subtotal: 9125,
    SaleLines: { SaleLine: [{ itemID: '1', quantity: 1, unitPrice: 10000, total: 10000 }] },
    Payments: { Payment: [{ amount: 10000, paymentTypeID: '1' }] },
  })

  assert.equal(sale.status, 201)
  assert.ok(sale.json.sale.saleID)
  assert.equal(sale.json.sale.status, 'completed')

  await service.close()
})

test('lightspeed fails sale when reference says failed', async () => {
  const service = MOCKS.lightspeed.create()
  await service.listen(0, '127.0.0.1')

  const sale = await post(`${service.url}/api/v1/sales.json`, {
    id: 'failed_sale',
    total: 10000,
  })

  assert.equal(sale.status, 400)

  await service.close()
})

test('lightspeed creates a customer', async () => {
  const service = MOCKS.lightspeed.create()
  await service.listen(0, '127.0.0.1')

  const customer = await post(`${service.url}/api/v1/customers.json`, {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
  })

  assert.equal(customer.status, 201)
  assert.ok(customer.json.customer.customerID)
  assert.equal(customer.json.customer.firstName, 'John')

  await service.close()
})

test('lightspeed creates an item', async () => {
  const service = MOCKS.lightspeed.create()
  await service.listen(0, '127.0.0.1')

  const item = await post(`${service.url}/api/v1/items.json`, {
    sku: 'LS-001',
    description: 'Test Item',
    price: 10000,
  })

  assert.equal(item.status, 201)
  assert.ok(item.json.item.itemID)
  assert.equal(item.json.item.sku, 'LS-001')

  await service.close()
})

test('lightspeed gets registers', async () => {
  const service = MOCKS.lightspeed.create()
  await service.listen(0, '127.0.0.1')

  const registers = await get(`${service.url}/api/v1/registers.json`)
  assert.equal(registers.status, 200)
  assert.ok(Array.isArray(registers.json.registers.Register))

  await service.close()
})

test('every new POS mock answers /_mock', async () => {
  for (const name of ['square-terminal', 'clover', 'toast', 'lightspeed']) {
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

test('every new POS mock answers /_openapi', async () => {
  for (const name of ['square-terminal', 'clover', 'toast', 'lightspeed']) {
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
