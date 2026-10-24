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

test('cin7 creates a product', async () => {
  const service = MOCKS.cin7.create()
  await service.listen(0, '127.0.0.1')

  const product = await post(`${service.url}/api/v1/products`, {
    SKU: 'CIN7-001',
    Name: 'Test Product',
    UnitPrice: '100.00',
  })

  assert.equal(product.status, 201)
  assert.ok(product.json.Id)
  assert.equal(product.json.SKU, 'CIN7-001')

  await service.close()
})

test('cin7 fails product when sku says failed', async () => {
  const service = MOCKS.cin7.create()
  await service.listen(0, '127.0.0.1')

  const product = await post(`${service.url}/api/v1/products`, {
    SKU: 'failed_sku',
  })

  assert.equal(product.status, 400)

  await service.close()
})

test('cin7 creates an order', async () => {
  const service = MOCKS.cin7.create()
  await service.listen(0, '127.0.0.1')

  const order = await post(`${service.url}/api/v1/orders`, {
    OrderNumber: 'CIN7-ORD-001',
    CustomerName: 'Test Customer',
  })

  assert.equal(order.status, 201)
  assert.ok(order.json.Id)
  assert.equal(order.json.OrderNumber, 'CIN7-ORD-001')

  await service.close()
})

test('cin7 creates a supplier', async () => {
  const service = MOCKS.cin7.create()
  await service.listen(0, '127.0.0.1')

  const supplier = await post(`${service.url}/api/v1/suppliers`, {
    Name: 'Test Supplier',
    Email: 'supplier@example.com',
  })

  assert.equal(supplier.status, 201)
  assert.ok(supplier.json.Id)
  assert.equal(supplier.json.Name, 'Test Supplier')

  await service.close()
})

test('cin7 gets stock', async () => {
  const service = MOCKS.cin7.create()
  await service.listen(0, '127.0.0.1')

  const stock = await get(`${service.url}/api/v1/stock`)
  assert.equal(stock.status, 200)
  assert.ok(Array.isArray(stock.json.Stock))

  await service.close()
})

test('dear creates a product', async () => {
  const service = MOCKS.dear.create()
  await service.listen(0, '127.0.0.1')

  const product = await post(`${service.url}/api/v2/Product`, {
    SKU: 'DEAR-001',
    Name: 'Test Product',
    UnitPrice: '100.00',
  })

  assert.equal(product.status, 201)
  assert.ok(product.json.ID)
  assert.equal(product.json.SKU, 'DEAR-001')

  await service.close()
})

test('dear fails product when sku says failed', async () => {
  const service = MOCKS.dear.create()
  await service.listen(0, '127.0.0.1')

  const product = await post(`${service.url}/api/v2/Product`, {
    SKU: 'failed_sku',
  })

  assert.equal(product.status, 400)

  await service.close()
})

test('dear creates a purchase order', async () => {
  const service = MOCKS.dear.create()
  await service.listen(0, '127.0.0.1')

  const po = await post(`${service.url}/api/v2/PurchaseOrder`, {
    OrderNumber: 'PO-001',
    Supplier: 'Test Supplier',
  })

  assert.equal(po.status, 201)
  assert.ok(po.json.ID)
  assert.equal(po.json.OrderNumber, 'PO-001')

  await service.close()
})

test('dear creates a sale order', async () => {
  const service = MOCKS.dear.create()
  await service.listen(0, '127.0.0.1')

  const so = await post(`${service.url}/api/v2/SaleOrder`, {
    OrderNumber: 'SO-001',
    Customer: 'Test Customer',
  })

  assert.equal(so.status, 201)
  assert.ok(so.json.ID)
  assert.equal(so.json.OrderNumber, 'SO-001')

  await service.close()
})

test('tradegecko creates a product', async () => {
  const service = MOCKS.tradegecko.create()
  await service.listen(0, '127.0.0.1')

  const product = await post(`${service.url}/products`, {
    sku: 'TG-001',
    name: 'Test Product',
  })

  assert.equal(product.status, 201)
  assert.ok(product.json.product.id)
  assert.equal(product.json.product.sku, 'TG-001')

  await service.close()
})

test('tradegecko fails product when sku says failed', async () => {
  const service = MOCKS.tradegecko.create()
  await service.listen(0, '127.0.0.1')

  const product = await post(`${service.url}/products`, {
    sku: 'failed_sku',
  })

  assert.equal(product.status, 400)

  await service.close()
})

test('tradegecko creates a variant', async () => {
  const service = MOCKS.tradegecko.create()
  await service.listen(0, '127.0.0.1')

  // First create a product
  const product = await post(`${service.url}/products`, { sku: 'TG-002', name: 'Test Product' })
  const productId = product.json.product.id

  const variant = await post(`${service.url}/variants`, {
    product_id: productId,
    sku: 'TG-VAR-001',
    retail_price: '100.00',
  })

  assert.equal(variant.status, 201)
  assert.ok(variant.json.variant.id)
  assert.equal(variant.json.variant.sku, 'TG-VAR-001')

  await service.close()
})

test('tradegecko creates an order', async () => {
  const service = MOCKS.tradegecko.create()
  await service.listen(0, '127.0.0.1')

  const order = await post(`${service.url}/orders`, {
    order_number: 'TG-ORD-001',
    customer: { id: '1', name: 'Test Customer', email: 'customer@example.com' },
  })

  assert.equal(order.status, 201)
  assert.ok(order.json.order.id)
  assert.equal(order.json.order.order_number, 'TG-ORD-001')

  await service.close()
})

test('tradegecko gets stock levels', async () => {
  const service = MOCKS.tradegecko.create()
  await service.listen(0, '127.0.0.1')

  const stock = await get(`${service.url}/stock_levels`)
  assert.equal(stock.status, 200)
  assert.ok(Array.isArray(stock.json.stock_levels))

  await service.close()
})

test('katana creates a product', async () => {
  const service = MOCKS.katana.create()
  await service.listen(0, '127.0.0.1')

  const product = await post(`${service.url}/api/v1/products`, {
    sku: 'KTN-001',
    name: 'Test Product',
    sales_price: '100.00',
  })

  assert.equal(product.status, 201)
  assert.ok(product.json.product.id)
  assert.equal(product.json.product.sku, 'KTN-001')

  await service.close()
})

test('katana fails product when sku says failed', async () => {
  const service = MOCKS.katana.create()
  await service.listen(0, '127.0.0.1')

  const product = await post(`${service.url}/api/v1/products`, {
    sku: 'failed_sku',
  })

  assert.equal(product.status, 400)

  await service.close()
})

test('katana creates a variant', async () => {
  const service = MOCKS.katana.create()
  await service.listen(0, '127.0.0.1')

  // First create a product
  const product = await post(`${service.url}/api/v1/products`, { sku: 'KTN-002', name: 'Test Product' })
  const productId = product.json.product.id

  const variant = await post(`${service.url}/api/v1/variants`, {
    product_id: productId,
    sku: 'KTN-VAR-001',
    sales_price: '100.00',
  })

  assert.equal(variant.status, 201)
  assert.ok(variant.json.variant.id)
  assert.equal(variant.json.variant.sku, 'KTN-VAR-001')

  await service.close()
})

test('katana creates a sales order', async () => {
  const service = MOCKS.katana.create()
  await service.listen(0, '127.0.0.1')

  const so = await post(`${service.url}/api/v1/sales_orders`, {
    order_number: 'KTN-SO-001',
    customer_name: 'Test Customer',
  })

  assert.equal(so.status, 201)
  assert.ok(so.json.sales_order.id)
  assert.equal(so.json.sales_order.order_number, 'KTN-SO-001')

  await service.close()
})

test('katana creates a manufacturing order', async () => {
  const service = MOCKS.katana.create()
  await service.listen(0, '127.0.0.1')

  const mo = await post(`${service.url}/api/v1/manufacturing_orders`, {
    mo_number: 'KTN-MO-001',
    product_variant_id: '1',
    quantity: 10,
  })

  assert.equal(mo.status, 201)
  assert.ok(mo.json.manufacturing_order.id)
  assert.equal(mo.json.manufacturing_order.mo_number, 'KTN-MO-001')

  await service.close()
})

test('katana gets inventory', async () => {
  const service = MOCKS.katana.create()
  await service.listen(0, '127.0.0.1')

  const inventory = await get(`${service.url}/api/v1/inventory`)
  assert.equal(inventory.status, 200)
  assert.ok(Array.isArray(inventory.json.inventory))

  await service.close()
})

test('every new ERP mock answers /_mock', async () => {
  for (const name of ['cin7', 'dear', 'tradegecko', 'katana']) {
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

test('every new ERP mock answers /_openapi', async () => {
  for (const name of ['cin7', 'dear', 'tradegecko', 'katana']) {
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
