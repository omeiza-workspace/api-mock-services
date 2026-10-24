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

test('amazon-sp-api creates an order', async () => {
  const service = MOCKS['amazon-sp-api'].create()
  await service.listen(0, '127.0.0.1')

  const order = await post(`${service.url}/orders/v0/orders`, {
    OrderId: 'amz_test_1',
    OrderItems: [{ SellerSKU: 'SKU123', ASIN: 'B000000001', Title: 'Test Product', QuantityOrdered: 1 }],
  })

  assert.equal(order.status, 201)
  assert.ok(order.json.payload.OrderId)
  assert.equal(order.json.payload.OrderStatus, 'Unshipped')

  await service.close()
})

test('amazon-sp-api fails order when reference says failed', async () => {
  const service = MOCKS['amazon-sp-api'].create()
  await service.listen(0, '127.0.0.1')

  const order = await post(`${service.url}/orders/v0/orders`, {
    OrderId: 'failed_amz_1',
  })

  assert.equal(order.status, 201)
  assert.equal(order.json.payload.OrderStatus, 'Canceled')

  await service.close()
})

test('amazon-sp-api gets orders', async () => {
  const service = MOCKS['amazon-sp-api'].create()
  await service.listen(0, '127.0.0.1')

  await post(`${service.url}/orders/v0/orders`, { OrderId: 'amz_list_1' })

  const orders = await get(`${service.url}/orders/v0/orders`)
  assert.equal(orders.status, 200)
  assert.ok(orders.json.payload.Orders.length >= 1)

  await service.close()
})

test('amazon-sp-api gets catalog item', async () => {
  const service = MOCKS['amazon-sp-api'].create()
  await service.listen(0, '127.0.0.1')

  const item = await get(`${service.url}/catalog/v0/items/B000000001`)
  assert.equal(item.status, 200)
  assert.equal(item.json.payload.ASIN, 'B000000001')

  await service.close()
})

test('amazon-sp-api creates a feed', async () => {
  const service = MOCKS['amazon-sp-api'].create()
  await service.listen(0, '127.0.0.1')

  const feed = await post(`${service.url}/feeds/v2021-06-30/feeds`, {
    feedType: 'POST_PRODUCT_DATA',
    marketplaceIds: ['ATVPDKIKX0DER'],
  })

  assert.equal(feed.status, 202)
  assert.ok(feed.json.feedId)
  assert.equal(feed.json.processingStatus, 'IN_PROGRESS')

  await service.close()
})

test('shopify creates a product', async () => {
  const service = MOCKS.shopify.create()
  await service.listen(0, '127.0.0.1')

  const product = await post(`${service.url}/admin/api/2024-01/products.json`, {
    product: { title: 'Test Product', body_html: '<strong>Great!</strong>', vendor: 'Test Vendor' },
  })

  assert.equal(product.status, 201)
  assert.ok(product.json.product.id)
  assert.equal(product.json.product.title, 'Test Product')
  assert.equal(product.json.product.status, 'active')

  await service.close()
})

test('shopify fails product when reference says failed', async () => {
  const service = MOCKS.shopify.create()
  await service.listen(0, '127.0.0.1')

  const product = await post(`${service.url}/admin/api/2024-01/products.json`, {
    product: { id: 'failed_product', title: 'Failed Product' },
  })

  assert.equal(product.status, 201)
  assert.equal(product.json.product.status, 'draft')

  await service.close()
})

test('shopify creates an order', async () => {
  const service = MOCKS.shopify.create()
  await service.listen(0, '127.0.0.1')

  const order = await post(`${service.url}/admin/api/2024-01/orders.json`, {
    order: { email: 'customer@example.com', total_price: '100.00' },
  })

  assert.equal(order.status, 201)
  assert.ok(order.json.order.id)
  assert.equal(order.json.order.financial_status, 'paid')

  await service.close()
})

test('shopify fails order when reference says failed', async () => {
  const service = MOCKS.shopify.create()
  await service.listen(0, '127.0.0.1')

  const order = await post(`${service.url}/admin/api/2024-01/orders.json`, {
    order: { id: 'failed_order', email: 'customer@example.com' },
  })

  assert.equal(order.status, 201)
  assert.equal(order.json.order.financial_status, 'refunded')

  await service.close()
})

test('shopify creates a customer', async () => {
  const service = MOCKS.shopify.create()
  await service.listen(0, '127.0.0.1')

  const customer = await post(`${service.url}/admin/api/2024-01/customers.json`, {
    customer: { email: 'customer@example.com', first_name: 'John', last_name: 'Doe' },
  })

  assert.equal(customer.status, 201)
  assert.ok(customer.json.customer.id)
  assert.equal(customer.json.customer.email, 'customer@example.com')

  await service.close()
})

test('ebay creates an inventory item', async () => {
  const service = MOCKS.ebay.create()
  await service.listen(0, '127.0.0.1')

  // Get token first
  const token = await post(`${service.url}/identity/v1/oauth2/token`, {})
  assert.equal(token.status, 200)

  const put = async (url, body) => {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: res.status, json: await res.json() }
  }

  const item = await put(`${service.url}/sell/inventory/v1/inventory_item/SKU123`, {
    product: { title: 'Test Product', description: 'Test description.' },
    condition: 'NEW',
    availability: { shipToLocationAvailability: { quantity: 10 } },
  })

  assert.equal(item.status, 200)
  assert.equal(item.json.sku, 'SKU123')
  assert.equal(item.json.condition, 'NEW')

  await service.close()
})

test('ebay creates an offer', async () => {
  const service = MOCKS.ebay.create()
  await service.listen(0, '127.0.0.1')

  const offer = await post(`${service.url}/sell/inventory/v1/offer`, {
    sku: 'SKU123',
    marketplaceId: 'EBAY_US',
    format: 'FIXED_PRICE',
    availableQuantity: 10,
    categoryId: '1234',
    pricingSummary: { price: { value: '100.00', currency: 'USD' } },
  })

  assert.equal(offer.status, 201)
  assert.ok(offer.json.offerId)
  assert.equal(offer.json.status, 'PUBLISHED')

  await service.close()
})

test('ebay fails offer when reference says failed', async () => {
  const service = MOCKS.ebay.create()
  await service.listen(0, '127.0.0.1')

  const offer = await post(`${service.url}/sell/inventory/v1/offer`, {
    sku: 'failed_sku',
    marketplaceId: 'EBAY_US',
    format: 'FIXED_PRICE',
    availableQuantity: 10,
    categoryId: '1234',
    pricingSummary: { price: { value: '100.00', currency: 'USD' } },
  })

  assert.equal(offer.status, 201)
  assert.equal(offer.json.status, 'ENDED')

  await service.close()
})

test('etsy creates a listing', async () => {
  const service = MOCKS.etsy.create()
  await service.listen(0, '127.0.0.1')

  // Get token first
  const token = await post(`${service.url}/v3/oauth/token`, {})
  assert.equal(token.status, 200)

  const listing = await post(`${service.url}/v3/application/shops/12345/listings`, {
    title: 'Test Listing',
    description: 'Test description.',
    quantity: 10,
    price: { amount: '100.00', currency_code: 'USD' },
  })

  assert.equal(listing.status, 201)
  assert.ok(listing.json.listing_id)
  assert.equal(listing.json.state, 'active')

  await service.close()
})

test('etsy fails listing when reference says failed', async () => {
  const service = MOCKS.etsy.create()
  await service.listen(0, '127.0.0.1')

  const listing = await post(`${service.url}/v3/application/shops/12345/listings`, {
    title: 'failed_listing',
  })

  assert.equal(listing.status, 201)
  assert.equal(listing.json.state, 'draft')

  await service.close()
})

test('walmart creates an item', async () => {
  const service = MOCKS.walmart.create()
  await service.listen(0, '127.0.0.1')

  const item = await post(`${service.url}/v3/items`, {
    sku: 'WM123',
    productName: 'Test Product',
    price: { amount: '100.00', currency: 'USD' },
  })

  assert.equal(item.status, 201)
  assert.equal(item.json.sku, 'WM123')
  assert.equal(item.json.lifecycleStatus, 'ACTIVE')

  await service.close()
})

test('walmart fails item when reference says failed', async () => {
  const service = MOCKS.walmart.create()
  await service.listen(0, '127.0.0.1')

  const item = await post(`${service.url}/v3/items`, {
    sku: 'failed_wm',
    productName: 'Failed Product',
    price: { amount: '100.00', currency: 'USD' },
  })

  assert.equal(item.status, 201)
  assert.equal(item.json.lifecycleStatus, 'INACTIVE')

  await service.close()
})

test('walmart creates a feed', async () => {
  const service = MOCKS.walmart.create()
  await service.listen(0, '127.0.0.1')

  const feed = await post(`${service.url}/v3/feeds`, {
    feedType: 'item',
  })

  assert.equal(feed.status, 202)
  assert.ok(feed.json.feedId)
  assert.equal(feed.json.processingStatus, 'IN_PROGRESS')

  await service.close()
})

test('every new marketplace mock answers /_mock', async () => {
  for (const name of ['amazon-sp-api', 'shopify', 'ebay', 'etsy', 'walmart']) {
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

test('every new marketplace mock answers /_openapi', async () => {
  for (const name of ['amazon-sp-api', 'shopify', 'ebay', 'etsy', 'walmart']) {
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
