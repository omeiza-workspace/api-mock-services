import { MockService, json, counter } from '../harness.js'

/**
 * Square Terminal.
 *
 * The Square Terminal API: checkout, payments, and refunds on the terminal.
 * The shapes match Square's Terminal API.
 *
 * The reference decides: a checkout with `success` succeeds, `failed` fails.
 */
export function createSquareTerminalMock() {
  const service = new MockService('square-terminal')

  service.state.checkouts = new Map()
  service.state.payments = new Map()
  service.state.refunds = new Map()

  let checkoutId = 1000
  let paymentId = 2000
  let refundId = 3000

  const nextCheckoutId = () => `checkout_${checkoutId++}`
  const nextPaymentId = () => `payment_${paymentId++}`
  const nextRefundId = () => `refund_${refundId++}`

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'square-terminal-mock' })
  })

  // OAuth token endpoint
  service.on('POST', '/oauth2/token', (req, res) => {
    json(res, 200, {
      access_token: 'mock_square_terminal_token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'mock_refresh_token',
    })
  })

  // Checkouts
  service.on('POST', '/v2/terminals/checkouts', (req, res) => {
    const body = req.json ?? {}
    const idempotencyKey = body.idempotency_key ?? `idem_${nextCheckoutId()}`

    const isFailed = failed(idempotencyKey)
    const id = nextCheckoutId()

    const checkout = {
      id,
      idempotency_key: idempotencyKey,
      amount_money: body.amount_money ?? { amount: 1000, currency: 'USD' },
      status: isFailed ? 'FAILED' : 'OPEN',
      reference_id: body.reference_id ?? `ref_${id}`,
      note: body.note ?? '',
      payment_type: body.payment_type ?? 'CREDIT_CARD',
      device_options: body.device_options ?? { device_id: 'device_1', skip_receipt_screen: false, tip_settings: { tip_percentages: [10, 15, 20], show_custom_tip_field: true, show_no_tip_field: true } },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    service.state.checkouts.set(id, checkout)

    if (isFailed) {
      json(res, 400, { errors: [{ category: 'INVALID_REQUEST_ERROR', code: 'CHECKOUT_FAILED', detail: 'Failed to create checkout' }] })
      return
    }

    json(res, 200, { checkout })
  })

  service.on('GET', '/v2/terminals/checkouts/:id', (req, res) => {
    const id = String(req.params.id)
    const checkout = service.state.checkouts.get(id)

    if (!checkout) {
      json(res, 404, { errors: [{ category: 'NOT_FOUND', code: 'CHECKOUT_NOT_FOUND', detail: 'Checkout not found' }] })
      return
    }

    json(res, 200, { checkout })
  })

  service.on('POST', '/v2/terminals/checkouts/:id/cancel', (req, res) => {
    const id = String(req.params.id)
    const checkout = service.state.checkouts.get(id)

    if (!checkout) {
      json(res, 404, { errors: [{ category: 'NOT_FOUND', code: 'CHECKOUT_NOT_FOUND', detail: 'Checkout not found' }] })
      return
    }

    checkout.status = 'CANCELED'
    checkout.updated_at = new Date().toISOString()
    service.state.checkouts.set(id, checkout)

    json(res, 200, { checkout })
  })

  // Payments
  service.on('POST', '/v2/terminals/checkouts/:id/process-payment', (req, res) => {
    const id = String(req.params.id)
    const checkout = service.state.checkouts.get(id)

    if (!checkout) {
      json(res, 404, { errors: [{ category: 'NOT_FOUND', code: 'CHECKOUT_NOT_FOUND', detail: 'Checkout not found' }] })
      return
    }

    const isFailed = failed(checkout.id)
    const paymentId = nextPaymentId()

    const payment = {
      id: paymentId,
      checkout_id: id,
      status: isFailed ? 'FAILED' : 'COMPLETED',
      amount_money: checkout.amount_money,
      card_details: {
        status: isFailed ? 'DECLINED' : 'AUTHORIZED',
        card: { card_brand: 'VISA', last_4: '1111', exp_month: 12, exp_year: 2028 },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    checkout.status = isFailed ? 'FAILED' : 'COMPLETED'
    checkout.updated_at = new Date().toISOString()
    service.state.checkouts.set(id, checkout)
    service.state.payments.set(paymentId, payment)

    if (isFailed) {
      json(res, 400, { errors: [{ category: 'PAYMENT_FAILED', code: 'CARD_DECLINED', detail: 'Card was declined' }] })
      return
    }

    json(res, 200, { payment })
  })

  return service
}

/**
 * Clover.
 *
 * The Clover API: orders, payments, inventory, and merchants.
 * The shapes match Clover's REST API.
 *
 * The reference decides: an order with `success` succeeds, `failed` fails.
 */
export function createCloverMock() {
  const service = new MockService('clover')

  service.state.merchants = new Map()
  service.state.orders = new Map()
  service.state.payments = new Map()
  service.state.inventory = new Map()

  let merchantId = 1000
  let orderId = 2000
  let paymentId = 3000
  let itemId = 4000

  const nextMerchantId = () => String(merchantId++)
  const nextOrderId = () => String(orderId++)
  const nextPaymentId = () => String(paymentId++)
  const nextItemId = () => String(itemId++)

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'clover-mock' })
  })

  // OAuth token endpoint
  service.on('POST', '/oauth/token', (req, res) => {
    json(res, 200, {
      access_token: 'mock_clover_token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'mock_refresh_token',
    })
  })

  // Merchants
  service.on('GET', '/v3/merchants/:mId', (req, res) => {
    const mId = String(req.params.mId)
    let merchant = service.state.merchants.get(mId)

    if (!merchant) {
      merchant = {
        id: mId,
        name: 'Test Merchant',
        address: { address1: '123 Main St', city: 'San Francisco', state: 'CA', zip: '94105', country: 'US' },
        currency: 'USD',
        timezone: 'America/Los_Angeles',
        created_time: Date.now(),
      }
      service.state.merchants.set(mId, merchant)
    }

    json(res, 200, merchant)
  })

  // Orders
  service.on('POST', '/v3/merchants/:mId/orders', (req, res) => {
    const mId = String(req.params.mId)
    const body = req.json ?? {}
    const isFailed = failed(body.id ?? body.total ?? '')

    const id = nextOrderId()
    const order = {
      id,
      merchant_id: mId,
      total: body.total ?? 10000,
      currency: body.currency ?? 'USD',
      status: isFailed ? 'failed' : 'open',
      line_items: body.line_items ?? [
        { id: nextItemId(), name: 'Test Item', price: 10000, quantity: 1 },
      ],
      created_time: Date.now(),
      modified_time: Date.now(),
    }

    service.state.orders.set(id, order)

    if (isFailed) {
      json(res, 400, { message: 'Failed to create order', code: 'ORDER_FAILED' })
      return
    }

    json(res, 201, order)
  })

  service.on('GET', '/v3/merchants/:mId/orders', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const orders = [...service.state.orders.values()].slice(0, limit)
    json(res, 200, { elements: orders, total: orders.length })
  })

  // Payments
  service.on('POST', '/v3/merchants/:mId/orders/:orderId/payments', (req, res) => {
    const orderId = String(req.params.orderId)
    const body = req.json ?? {}
    const isFailed = failed(orderId)

    const id = nextPaymentId()
    const payment = {
      id,
      order_id: orderId,
      amount: body.amount ?? 10000,
      currency: body.currency ?? 'USD',
      status: isFailed ? 'failed' : 'paid',
      source: body.source ?? 'clover',
      created_time: Date.now(),
    }

    service.state.payments.set(id, payment)

    if (isFailed) {
      json(res, 400, { message: 'Payment failed', code: 'PAYMENT_FAILED' })
      return
    }

    json(res, 201, payment)
  })

  // Inventory
  service.on('POST', '/v3/merchants/:mId/items', (req, res) => {
    const mId = String(req.params.mId)
    const body = req.json ?? {}
    const name = body.name ?? `Item ${nextItemId()}`

    const isFailed = failed(name)
    const id = nextItemId()

    const item = {
      id,
      merchant_id: mId,
      name,
      price: body.price ?? 10000,
      cost: body.cost ?? 5000,
      sku: body.sku ?? `SKU-${id}`,
      quantity: body.quantity ?? 100,
      hidden: isFailed,
      categories: body.categories ?? [],
      created_time: Date.now(),
    }

    service.state.inventory.set(id, item)

    if (isFailed) {
      json(res, 400, { message: 'Failed to create item', code: 'ITEM_FAILED' })
      return
    }

    json(res, 201, item)
  })

  service.on('GET', '/v3/merchants/:mId/items', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const items = [...service.state.inventory.values()].slice(0, limit)
    json(res, 200, { elements: items, total: items.length })
  })

  return service
}

/**
 * Toast.
 *
 * The Toast API: orders, payments, menu, and employees.
 * The shapes match Toast's REST API.
 *
 * The reference decides: an order with `success` succeeds, `failed` fails.
 */
export function createToastMock() {
  const service = new MockService('toast')

  service.state.orders = new Map()
  service.state.payments = new Map()
  service.state.menuItems = new Map()
  service.state.employees = new Map()

  let orderId = 1000
  let paymentId = 2000
  let itemId = 3000
  let employeeId = 4000

  const nextOrderId = () => `order_${orderId++}`
  const nextPaymentId = () => `payment_${paymentId++}`
  const nextItemId = () => `item_${itemId++}`
  const nextEmployeeId = () => `emp_${employeeId++}`

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'toast-mock' })
  })

  // Authentication
  service.on('POST', '/authentication/v1/authentication/login', (req, res) => {
    json(res, 200, {
      token: 'mock_toast_token',
      token_type: 'Bearer',
      expires_in: 3600,
    })
  })

  // Orders
  service.on('POST', '/orders/v2/orders', (req, res) => {
    const body = req.json ?? {}
    const isFailed = failed(JSON.stringify(body))

    const id = nextOrderId()
    const order = {
      guid: id,
      entityType: 'Order',
      displayId: `ORD-${nextOrderId().split('_')[1]}`,
      status: isFailed ? 'VOIDED' : 'OPEN',
      checkNumber: 1,
      taxAmount: 875,
      tipAmount: 0,
      totalAmount: 10875,
      createdDate: new Date().toISOString(),
      modifiedDate: new Date().toISOString(),
      selections: body.selections ?? [
        {
          itemGuid: body.itemGuid ?? 'item_1',
          quantity: 1,
          price: 10000,
        },
      ],
      payments: [],
    }

    service.state.orders.set(id, order)

    if (isFailed) {
      json(res, 400, { message: 'Failed to create order', code: 'ORDER_FAILED' })
      return
    }

    json(res, 201, order)
  })

  service.on('GET', '/orders/v2/orders/:id', (req, res) => {
    const id = String(req.params.id)
    const order = service.state.orders.get(id)

    if (!order) {
      json(res, 404, { message: 'Order not found', code: 'NOT_FOUND' })
      return
    }

    json(res, 200, order)
  })

  service.on('POST', '/orders/v2/orders/:id/void', (req, res) => {
    const id = String(req.params.id)
    const order = service.state.orders.get(id)

    if (!order) {
      json(res, 404, { message: 'Order not found', code: 'NOT_FOUND' })
      return
    }

    order.status = 'VOIDED'
    order.modifiedDate = new Date().toISOString()
    service.state.orders.set(id, order)

    json(res, 200, order)
  })

  // Payments
  service.on('POST', '/orders/v2/orders/:id/payments', (req, res) => {
    const orderId = String(req.params.id)
    const order = service.state.orders.get(orderId)

    if (!order) {
      json(res, 404, { message: 'Order not found', code: 'NOT_FOUND' })
      return
    }

    const body = req.json ?? {}
    const isFailed = failed(orderId)
    const id = nextPaymentId()

    const payment = {
      guid: id,
      orderGuid: orderId,
      amount: body.amount ?? 10875,
      tipAmount: body.tipAmount ?? 0,
      type: body.type ?? 'CREDIT_CARD',
      status: isFailed ? 'FAILED' : 'AUTHORIZED',
      cardDetails: {
        cardType: 'VISA',
        last4: '1111',
        entryMode: 'EMV',
      },
      createdDate: new Date().toISOString(),
    }

    service.state.payments.set(id, payment)

    if (isFailed) {
      json(res, 400, { message: 'Payment failed', code: 'PAYMENT_FAILED' })
      return
    }

    json(res, 201, payment)
  })

  // Menu
  service.on('POST', '/menu/v2/menuItems', (req, res) => {
    const body = req.json ?? {}
    const name = body.name ?? `Item ${nextItemId()}`

    const isFailed = failed(name)
    const id = nextItemId()

    const item = {
      guid: id,
      entityType: 'MenuItem',
      name,
      description: body.description ?? '',
      price: body.price ?? 10000,
      taxRates: body.taxRates ?? [],
      categoryGuid: body.categoryGuid ?? null,
      isActive: !isFailed,
      createdDate: new Date().toISOString(),
      modifiedDate: new Date().toISOString(),
    }

    service.state.menuItems.set(id, item)

    if (isFailed) {
      json(res, 400, { message: 'Failed to create item', code: 'ITEM_FAILED' })
      return
    }

    json(res, 201, item)
  })

  service.on('GET', '/menu/v2/menuItems', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const items = [...service.state.menuItems.values()].slice(0, limit)
    json(res, 200, { data: items, page: 1, limit, total: items.length })
  })

  // Employees
  service.on('POST', '/labor/v2/employees', (req, res) => {
    const body = req.json ?? {}
    const firstName = body.firstName ?? 'John'
    const lastName = body.lastName ?? 'Doe'

    const isFailed = failed(`${firstName} ${lastName}`)
    const id = nextEmployeeId()

    const employee = {
      guid: id,
      firstName,
      lastName,
      email: body.email ?? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      phoneNumber: body.phoneNumber ?? '555-1234',
      roles: body.roles ?? ['SERVER'],
      isActive: !isFailed,
      createdDate: new Date().toISOString(),
      modifiedDate: new Date().toISOString(),
    }

    service.state.employees.set(id, employee)

    if (isFailed) {
      json(res, 400, { message: 'Failed to create employee', code: 'EMPLOYEE_FAILED' })
      return
    }

    json(res, 201, employee)
  })

  service.on('GET', '/labor/v2/employees', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const employees = [...service.state.employees.values()].slice(0, limit)
    json(res, 200, { data: employees, page: 1, limit, total: employees.length })
  })

  return service
}

/**
 * Lightspeed.
 *
 * The Lightspeed Retail API: sales, customers, items, and registers.
 * The shapes match Lightspeed's REST API.
 *
 * The reference decides: a sale with `success` succeeds, `failed` fails.
 */
export function createLightspeedMock() {
  const service = new MockService('lightspeed')

  service.state.sales = new Map()
  service.state.customers = new Map()
  service.state.items = new Map()
  service.state.registers = new Map()

  let saleId = 1000
  let customerId = 2000
  let itemId = 3000
  let registerId = 4000

  const nextSaleId = () => String(saleId++)
  const nextCustomerId = () => String(customerId++)
  const nextItemId = () => String(itemId++)
  const nextRegisterId = () => String(registerId++)

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'lightspeed-mock' })
  })

  // OAuth token endpoint
  service.on('POST', '/oauth/access_token.php', (req, res) => {
    json(res, 200, {
      access_token: 'mock_lightspeed_token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'mock_refresh_token',
    })
  })

  // Sales
  service.on('POST', '/api/v1/sales.json', (req, res) => {
    const body = req.json ?? {}
    const isFailed = failed(JSON.stringify(body))

    const id = nextSaleId()
    const sale = {
      saleID: id,
      registerID: body.registerID ?? '1',
      employeeID: body.employeeID ?? '1',
      customerID: body.customerID ?? null,
      status: isFailed ? 'voided' : 'completed',
      total: body.total ?? 10000,
      taxTotal: body.taxTotal ?? 875,
      subtotal: body.subtotal ?? 9125,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      SaleLines: {
        SaleLine: body.SaleLines?.SaleLine ?? [
          {
            itemID: body.SaleLines?.SaleLine?.[0]?.itemID ?? '1',
            quantity: body.SaleLines?.SaleLine?.[0]?.quantity ?? 1,
            unitPrice: body.SaleLines?.SaleLine?.[0]?.unitPrice ?? 10000,
            total: body.SaleLines?.SaleLine?.[0]?.total ?? 10000,
          },
        ],
      },
      Payments: {
        Payment: body.Payments?.Payment ?? [
          {
            amount: 10000,
            paymentTypeID: '1',
          },
        ],
      },
    }

    service.state.sales.set(id, sale)

    if (isFailed) {
      json(res, 400, { error: { code: 'SALE_FAILED', message: 'Failed to create sale' } })
      return
    }

    json(res, 201, { sale })
  })

  service.on('GET', '/api/v1/sales.json', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const sales = [...service.state.sales.values()].slice(0, limit)
    json(res, 200, { sales: { Sale: sales }, meta: { total: sales.length, limit } })
  })

  service.on('GET', '/api/v1/sales/:id.json', (req, res) => {
    const id = String(req.params.id)
    const sale = service.state.sales.get(id)

    if (!sale) {
      json(res, 404, { error: { code: 'NOT_FOUND', message: 'Sale not found' } })
      return
    }

    json(res, 200, { sale })
  })

  // Customers
  service.on('POST', '/api/v1/customers.json', (req, res) => {
    const body = req.json ?? {}
    const firstName = body.firstName ?? 'John'
    const lastName = body.lastName ?? 'Doe'

    const isFailed = failed(`${firstName} ${lastName}`)
    const id = nextCustomerId()

    const customer = {
      customerID: id,
      firstName,
      lastName,
      email: body.email ?? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      phone: body.phone ?? '555-1234',
      address1: body.address1 ?? '123 Main St',
      city: body.city ?? 'San Francisco',
      state: body.state ?? 'CA',
      zip: body.zip ?? '94105',
      country: body.country ?? 'US',
      customerType: isFailed ? 'inactive' : 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    service.state.customers.set(id, customer)

    if (isFailed) {
      json(res, 400, { error: { code: 'CUSTOMER_FAILED', message: 'Failed to create customer' } })
      return
    }

    json(res, 201, { customer })
  })

  service.on('GET', '/api/v1/customers.json', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const customers = [...service.state.customers.values()].slice(0, limit)
    json(res, 200, { customers: { Customer: customers }, meta: { total: customers.length, limit } })
  })

  // Items
  service.on('POST', '/api/v1/items.json', (req, res) => {
    const body = req.json ?? {}
    const sku = body.sku ?? `SKU-${nextItemId()}`

    const isFailed = failed(sku)
    const id = nextItemId()

    const item = {
      itemID: id,
      sku,
      description: body.description ?? `Item ${sku}`,
      price: body.price ?? 10000,
      cost: body.cost ?? 5000,
      qtyOnHand: body.qtyOnHand ?? 100,
      manufacturer: body.manufacturer ?? '',
      vendor: body.vendor ?? '',
      categoryID: body.categoryID ?? '1',
      isActive: !isFailed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    service.state.items.set(id, item)

    if (isFailed) {
      json(res, 400, { error: { code: 'ITEM_FAILED', message: 'Failed to create item' } })
      return
    }

    json(res, 201, { item })
  })

  service.on('GET', '/api/v1/items.json', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const items = [...service.state.items.values()].slice(0, limit)
    json(res, 200, { items: { Item: items }, meta: { total: items.length, limit } })
  })

  // Registers
  service.on('GET', '/api/v1/registers.json', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const registers = [
      { registerID: '1', name: 'Register 1', status: 'open', shopID: '1' },
      { registerID: '2', name: 'Register 2', status: 'closed', shopID: '1' },
    ]
    json(res, 200, { registers: { Register: registers.slice(0, limit) }, meta: { total: registers.length } })
  })

  return service
}
