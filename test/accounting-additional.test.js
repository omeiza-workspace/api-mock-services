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

test('quickbooks creates a customer', async () => {
  const service = MOCKS.quickbooks.create()
  await service.listen(0, '127.0.0.1')

  const customer = await post(`${service.url}/v3/company/123/customer`, {
    DisplayName: 'Test Customer',
    PrimaryEmailAddr: { Address: 'test@example.com' },
  })

  assert.equal(customer.status, 200)
  assert.ok(customer.json.Customer.Id)
  assert.equal(customer.json.Customer.DisplayName, 'Test Customer')

  await service.close()
})

test('quickbooks fails customer when name says failed', async () => {
  const service = MOCKS.quickbooks.create()
  await service.listen(0, '127.0.0.1')

  const customer = await post(`${service.url}/v3/company/123/customer`, {
    DisplayName: 'failed_customer',
  })

  assert.equal(customer.status, 400)

  await service.close()
})

test('quickbooks creates an invoice', async () => {
  const service = MOCKS.quickbooks.create()
  await service.listen(0, '127.0.0.1')

  // First create a customer
  const customer = await post(`${service.url}/v3/company/123/customer`, {
    DisplayName: 'Invoice Customer',
  })
  const customerId = customer.json.Customer.Id

  const invoice = await post(`${service.url}/v3/company/123/invoice`, {
    CustomerRef: { value: customerId },
    TotalAmt: '150.00',
  })

  assert.equal(invoice.status, 200)
  assert.ok(invoice.json.Invoice.Id)
  assert.equal(invoice.json.Invoice.TotalAmt, '150.00')

  await service.close()
})

test('quickbooks creates a payment', async () => {
  const service = MOCKS.quickbooks.create()
  await service.listen(0, '127.0.0.1')

  const customer = await post(`${service.url}/v3/company/123/customer`, {
    DisplayName: 'Payment Customer',
  })
  const customerId = customer.json.Customer.Id

  const payment = await post(`${service.url}/v3/company/123/payment`, {
    CustomerRef: { value: customerId },
    TotalAmt: '100.00',
  })

  assert.equal(payment.status, 200)
  assert.ok(payment.json.Payment.Id)
  assert.equal(payment.json.Payment.TotalAmt, '100.00')

  await service.close()
})

test('quickbooks creates an account', async () => {
  const service = MOCKS.quickbooks.create()
  await service.listen(0, '127.0.0.1')

  const account = await post(`${service.url}/v3/company/123/account`, {
    Name: 'Test Account',
    AccountType: 'Bank',
    AccountSubType: 'Checking',
  })

  assert.equal(account.status, 200)
  assert.ok(account.json.Account.Id)
  assert.equal(account.json.Account.Name, 'Test Account')

  await service.close()
})

test('netsuite creates a customer', async () => {
  const service = MOCKS.netsuite.create()
  await service.listen(0, '127.0.0.1')

  const customer = await post(`${service.url}/services/rest/record/v1/customer`, {
    entityId: 'CUST-001',
    companyName: 'Test Company',
    email: 'test@example.com',
  })

  assert.equal(customer.status, 201)
  assert.ok(customer.json.id)
  assert.equal(customer.json.entityId, 'CUST-001')

  await service.close()
})

test('netsuite fails customer when entityId says failed', async () => {
  const service = MOCKS.netsuite.create()
  await service.listen(0, '127.0.0.1')

  const customer = await post(`${service.url}/services/rest/record/v1/customer`, {
    entityId: 'failed_customer',
  })

  assert.equal(customer.status, 400)

  await service.close()
})

test('netsuite creates a sales order', async () => {
  const service = MOCKS.netsuite.create()
  await service.listen(0, '127.0.0.1')

  // First create a customer
  const customer = await post(`${service.url}/services/rest/record/v1/customer`, {
    entityId: 'CUST-002',
    companyName: 'Order Company',
  })
  const customerId = customer.json.id

  const salesOrder = await post(`${service.url}/services/rest/record/v1/salesOrder`, {
    entityId: 'SO-001',
    entity: { id: customerId },
    total: '200.00',
  })

  assert.equal(salesOrder.status, 201)
  assert.ok(salesOrder.json.id)
  assert.equal(salesOrder.json.tranId, 'SO-001')

  await service.close()
})

test('netsuite creates an item', async () => {
  const service = MOCKS.netsuite.create()
  await service.listen(0, '127.0.0.1')

  const item = await post(`${service.url}/services/rest/record/v1/inventoryItem`, {
    itemId: 'ITEM-001',
    displayName: 'Test Item',
    basePrice: '50.00',
  })

  assert.equal(item.status, 201)
  assert.ok(item.json.id)
  assert.equal(item.json.itemId, 'ITEM-001')

  await service.close()
})

test('netsuite creates an invoice', async () => {
  const service = MOCKS.netsuite.create()
  await service.listen(0, '127.0.0.1')

  const customer = await post(`${service.url}/services/rest/record/v1/customer`, {
    entityId: 'CUST-003',
  })
  const customerId = customer.json.id

  const invoice = await post(`${service.url}/services/rest/record/v1/invoice`, {
    entityId: 'INV-001',
    entity: { id: customerId },
    total: '300.00',
  })

  assert.equal(invoice.status, 201)
  assert.ok(invoice.json.id)
  assert.equal(invoice.json.tranId, 'INV-001')

  await service.close()
})

test('sage creates a customer', async () => {
  const service = MOCKS.sage.create()
  await service.listen(0, '127.0.0.1')

  const customer = await post(`${service.url}/api/v1/customers`, {
    name: 'Test Customer',
    email: 'test@example.com',
  })

  assert.equal(customer.status, 201)
  assert.ok(customer.json.id)
  assert.equal(customer.json.name, 'Test Customer')

  await service.close()
})

test('sage fails customer when name says failed', async () => {
  const service = MOCKS.sage.create()
  await service.listen(0, '127.0.0.1')

  const customer = await post(`${service.url}/api/v1/customers`, {
    name: 'failed_customer',
  })

  assert.equal(customer.status, 400)

  await service.close()
})

test('sage creates an invoice', async () => {
  const service = MOCKS.sage.create()
  await service.listen(0, '127.0.0.1')

  const customer = await post(`${service.url}/api/v1/customers`, {
    name: 'Invoice Customer',
  })
  const customerId = customer.json.id

  const invoice = await post(`${service.url}/api/v1/invoices`, {
    customer_id: customerId,
    total_amount: '250.00',
  })

  assert.equal(invoice.status, 201)
  assert.ok(invoice.json.id)
  assert.equal(invoice.json.total_amount, '250.00')

  await service.close()
})

test('sage creates a payment', async () => {
  const service = MOCKS.sage.create()
  await service.listen(0, '127.0.0.1')

  const customer = await post(`${service.url}/api/v1/customers`, {
    name: 'Payment Customer',
  })
  const customerId = customer.json.id

  const payment = await post(`${service.url}/api/v1/payments`, {
    customer_id: customerId,
    amount: '100.00',
  })

  assert.equal(payment.status, 201)
  assert.ok(payment.json.id)
  assert.equal(payment.json.amount, '100.00')

  await service.close()
})

test('sage creates a GL entry', async () => {
  const service = MOCKS.sage.create()
  await service.listen(0, '127.0.0.1')

  const glEntry = await post(`${service.url}/api/v1/gl-entries`, {
    description: 'Test GL Entry',
    lines: [
      { account_id: '1000', debit: '100.00', credit: '0.00' },
      { account_id: '2000', debit: '0.00', credit: '100.00' },
    ],
  })

  assert.equal(glEntry.status, 201)
  assert.ok(glEntry.json.id)
  assert.equal(glEntry.json.description, 'Test GL Entry')

  await service.close()
})

test('every new accounting additional mock answers /_mock', async () => {
  for (const name of ['quickbooks', 'netsuite', 'sage']) {
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

test('every new accounting additional mock answers /_openapi', async () => {
  for (const name of ['quickbooks', 'netsuite', 'sage']) {
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
