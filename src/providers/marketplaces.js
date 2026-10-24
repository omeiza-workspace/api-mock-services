import { MockService, json, counter } from '../harness.js'

/**
 * Amazon SP-API.
 *
 * The Selling Partner API: orders, catalog items, feeds, and reports.
 * This is a simplified mock covering the key endpoints.
 *
 * The reference decides: an order with `success` gets a result, `failed` fails.
 */
export function createAmazonSpApiMock() {
  const service = new MockService('amazon-sp-api')

  service.state.orders = new Map()
  service.state.items = new Map()
  service.state.feeds = new Map()
  service.state.reports = new Map()

  const nextOrder = counter('amz')
  const nextFeed = counter('feed')
  const nextReport = counter('report')

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'amazon-sp-api-mock' })
  })

  // OAuth token endpoint (LWA)
  service.on('POST', '/auth/o2/token', (req, res) => {
    json(res, 200, {
      access_token: 'mock_amazon_token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'mock_refresh_token',
    })
  })

  // Orders API
  service.on('GET', '/orders/v0/orders', (req, res) => {
    const createdAfter = req.query.CreatedAfter
    const statuses = (req.query.OrderStatuses ?? 'Unshipped,PartiallyShipped,Shipped').split(',')

    const orders = [...service.state.orders.values()].filter((order) => {
      if (createdAfter && new Date(order.OrderDate) < new Date(createdAfter)) return false
      if (!statuses.includes(order.OrderStatus)) return false
      return true
    })

    json(res, 200, {
      payload: {
        Orders: orders,
        NextToken: null,
      },
    })
  })

  service.on('GET', '/orders/v0/orders/:orderId', (req, res) => {
    const orderId = String(req.params.orderId)
    const order = service.state.orders.get(orderId)

    if (!order) {
      json(res, 404, { errors: [{ code: 'NotFound', message: 'Order not found' }] })
      return
    }

    json(res, 200, { payload: order })
  })

  service.on('GET', '/orders/v0/orders/:orderId/orderItems', (req, res) => {
    const orderId = String(req.params.orderId)
    const order = service.state.orders.get(orderId)

    if (!order) {
      json(res, 404, { errors: [{ code: 'NotFound', message: 'Order not found' }] })
      return
    }

    json(res, 200, {
      payload: {
        OrderItems: order.OrderItems ?? [],
        NextToken: null,
      },
    })
  })

  service.on('POST', '/orders/v0/orders', (req, res) => {
    const body = req.json ?? {}
    const orderId = body.OrderId ?? nextOrder()

    const isFailed = failed(orderId)

    const order = {
      OrderId: orderId,
      OrderStatus: isFailed ? 'Canceled' : 'Unshipped',
      OrderDate: new Date().toISOString(),
      LastUpdateDate: new Date().toISOString(),
      OrderTotal: { CurrencyCode: 'USD', Amount: '100.00' },
      OrderItems: body.OrderItems ?? [
        {
          OrderItemId: `item_${nextOrder()}`,
          SellerSKU: 'SKU123',
          ASIN: 'B000000001',
          Title: 'Test Product',
          QuantityOrdered: 1,
          ItemPrice: { CurrencyCode: 'USD', Amount: '100.00' },
          ShippingPrice: { CurrencyCode: 'USD', Amount: '5.00' },
        },
      ],
    }

    service.state.orders.set(orderId, order)
    json(res, 201, { payload: order })
  })

  // Catalog Items API
  service.on('GET', '/catalog/v0/items/:asin', (req, res) => {
    const asin = String(req.params.asin)
    const isFailed = failed(asin)

    if (isFailed) {
      json(res, 404, { errors: [{ code: 'NotFound', message: 'ASIN not found' }] })
      return
    }

    const item = {
      ASIN: asin,
      Identifiers: { MarketplaceASIN: { MarketplaceId: 'ATVPDKIKX0DER', ASIN: asin } },
      Summaries: [
        {
          ItemName: `Product ${asin}`,
          Brand: 'Test Brand',
          Manufacturer: 'Test Manufacturer',
        },
      ],
    }

    json(res, 200, { payload: item })
  })

  // Feeds API
  service.on('POST', '/feeds/v2021-06-30/feeds', (req, res) => {
    const body = req.json ?? {}
    const feedId = nextFeed()

    const feed = {
      feedId,
      feedType: body.feedType ?? 'POST_PRODUCT_DATA',
      marketplaceIds: body.marketplaceIds ?? ['ATVPDKIKX0DER'],
      createdTimestamp: new Date().toISOString(),
      processingStatus: 'IN_PROGRESS',
      resultFeedDocumentId: null,
    }

    service.state.feeds.set(feedId, feed)
    json(res, 202, feed)
  })

  service.on('GET', '/feeds/v2021-06-30/feeds/:feedId', (req, res) => {
    const feedId = String(req.params.feedId)
    const feed = service.state.feeds.get(feedId)

    if (!feed) {
      json(res, 404, { errors: [{ code: 'NotFound', message: 'Feed not found' }] })
      return
    }

    json(res, 200, feed)
  })

  // Reports API
  service.on('POST', '/reports/v2021-06-30/reports', (req, res) => {
    const body = req.json ?? {}
    const reportId = nextReport()

    const report = {
      reportId,
      reportType: body.reportType ?? 'GET_FLAT_FILE_OPEN_LISTINGS_DATA',
      marketplaceIds: body.marketplaceIds ?? ['ATVPDKIKX0DER'],
      createdTimestamp: new Date().toISOString(),
      processingStatus: 'IN_PROGRESS',
      reportDocumentId: null,
    }

    service.state.reports.set(reportId, report)
    json(res, 202, report)
  })

  service.on('GET', '/reports/v2021-06-30/reports/:reportId', (req, res) => {
    const reportId = String(req.params.reportId)
    const report = service.state.reports.get(reportId)

    if (!report) {
      json(res, 404, { errors: [{ code: 'NotFound', message: 'Report not found' }] })
      return
    }

    json(res, 200, report)
  })

  return service
}

/**
 * Shopify.
 *
 * The Admin REST API: products, orders, customers, and webhooks.
 * The shapes match Shopify's API.
 *
 * The reference decides: a product/order with `success` succeeds, `failed` fails.
 */
export function createShopifyMock() {
  const service = new MockService('shopify')

  service.state.products = new Map()
  service.state.orders = new Map()
  service.state.customers = new Map()
  service.state.webhooks = []

  let productId = 1000
  let orderId = 2000
  let customerId = 3000

  const nextProductId = () => productId++
  const nextOrderId = () => orderId++
  const nextCustomerId = () => customerId++

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'shopify-mock' })
  })

  // Products
  service.on('GET', '/admin/api/2024-01/products.json', (req, res) => {
    const limit = Number(req.query.limit ?? 50)
    const products = [...service.state.products.values()].slice(0, limit)

    json(res, 200, { products })
  })

  service.on('GET', '/admin/api/2024-01/products/:id.json', (req, res) => {
    const id = String(req.params.id)
    const product = service.state.products.get(id)

    if (!product) {
      json(res, 404, { errors: 'Not Found' })
      return
    }

    json(res, 200, { product })
  })

  service.on('POST', '/admin/api/2024-01/products.json', (req, res) => {
    const body = req.json ?? {}
    const productData = body.product ?? {}
    const id = String(productData.id ?? nextProductId())

    const isFailed = failed(id)

    const product = {
      id: Number(id),
      title: productData.title ?? 'Test Product',
      body_html: productData.body_html ?? '<strong>Great product!</strong>',
      vendor: productData.vendor ?? 'Test Vendor',
      product_type: productData.product_type ?? 'Test Type',
      created_at: new Date().toISOString(),
      handle: productData.handle ?? `test-product-${id}`,
      updated_at: new Date().toISOString(),
      published_at: productData.published_at ?? new Date().toISOString(),
      template_suffix: null,
      status: isFailed ? 'draft' : 'active',
      published_scope: 'global',
      tags: productData.tags ?? '',
      admin_graphql_api_id: `gid://shopify/Product/${id}`,
      variants: productData.variants ?? [
        {
          id: nextProductId(),
          product_id: Number(id),
          title: 'Default Title',
          price: '100.00',
          sku: productData.sku ?? `SKU${id}`,
          position: 1,
          inventory_policy: 'deny',
          compare_at_price: null,
          fulfillment_service: 'manual',
          inventory_management: 'shopify',
          option1: 'Default Title',
          option2: null,
          option3: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          taxable: true,
          barcode: null,
          grams: 0,
          inventory_quantity: productData.inventory_quantity ?? 100,
          weight: 0.0,
          weight_unit: 'kg',
          inventory_item_id: nextProductId(),
          admin_graphql_api_id: `gid://shopify/ProductVariant/${nextProductId()}`,
        },
      ],
      options: [
        { id: nextProductId(), product_id: Number(id), name: 'Title', position: 1, values: ['Default Title'] },
      ],
      images: productData.images ?? [],
      image: null,
    }

    service.state.products.set(id, product)
    json(res, 201, { product })
  })

  service.on('PUT', '/admin/api/2024-01/products/:id.json', (req, res) => {
    const id = String(req.params.id)
    const body = req.json ?? {}
    const productData = body.product ?? {}
    const product = service.state.products.get(id)

    if (!product) {
      json(res, 404, { errors: 'Not Found' })
      return
    }

    Object.assign(product, productData, { updated_at: new Date().toISOString() })
    service.state.products.set(id, product)
    json(res, 200, { product })
  })

  service.on('DELETE', '/admin/api/2024-01/products/:id.json', (req, res) => {
    const id = String(req.params.id)

    if (!service.state.products.has(id)) {
      json(res, 404, { errors: 'Not Found' })
      return
    }

    service.state.products.delete(id)
    res.statusCode = 204
    res.end()
  })

  // Orders
  service.on('GET', '/admin/api/2024-01/orders.json', (req, res) => {
    const limit = Number(req.query.limit ?? 50)
    const status = req.query.status ?? 'any'
    let orders = [...service.state.orders.values()].slice(0, limit)

    if (status !== 'any') {
      orders = orders.filter((o) => o.financial_status === status || o.fulfillment_status === status)
    }

    json(res, 200, { orders })
  })

  service.on('GET', '/admin/api/2024-01/orders/:id.json', (req, res) => {
    const id = String(req.params.id)
    const order = service.state.orders.get(id)

    if (!order) {
      json(res, 404, { errors: 'Not Found' })
      return
    }

    json(res, 200, { order })
  })

  service.on('POST', '/admin/api/2024-01/orders.json', (req, res) => {
    const body = req.json ?? {}
    const orderData = body.order ?? {}
    const id = String(orderData.id ?? nextOrderId())

    const isFailed = failed(id)

    const order = {
      id: Number(id),
      email: orderData.email ?? 'customer@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      number: nextOrderId(),
      note: orderData.note ?? null,
      token: `token_${id}`,
      gateway: orderData.gateway ?? 'manual',
      test: true,
      total_price: orderData.total_price ?? '100.00',
      subtotal_price: orderData.subtotal_price ?? '90.00',
      total_weight: 0,
      total_tax: '10.00',
      taxes_included: false,
      currency: 'USD',
      financial_status: isFailed ? 'refunded' : 'paid',
      confirmed: true,
      total_discounts: '0.00',
      total_line_items_price: '90.00',
      cart_token: `cart_${id}`,
      buyer_accepts_marketing: false,
      name: `#${nextOrderId()}`,
      referring_site: null,
      landing_site: null,
      cancelled_at: isFailed ? new Date().toISOString() : null,
      cancel_reason: isFailed ? 'customer' : null,
      total_price_usd: '100.00',
      checkout_token: `checkout_${id}`,
      reference: orderData.reference ?? null,
      user_id: null,
      location_id: null,
      source_identifier: null,
      source_url: null,
      processed_at: new Date().toISOString(),
      device_id: null,
      phone: null,
      customer_locale: 'en',
      app_id: null,
      browser_ip: null,
      landing_site_ref: null,
      order_number: nextOrderId(),
      discount_applications: [],
      discount_codes: [],
      note_attributes: [],
      payment_gateway_names: ['manual'],
      processing_method: 'manual',
      checkout_id: Number(id),
      source_name: 'web',
      fulfillment_status: isFailed ? 'cancelled' : null,
      tax_lines: [{ title: 'Tax', price: '10.00', rate: 0.1 }],
      tags: '',
      contact_email: orderData.email ?? 'customer@example.com',
      order_status_url: `${service.url}/orders/${id}`,
      presentment_currency: 'USD',
      total_line_items_price_set: {
        shop_money: { amount: '90.00', currency_code: 'USD' },
        presentment_money: { amount: '90.00', currency_code: 'USD' },
      },
      total_discounts_set: {
        shop_money: { amount: '0.00', currency_code: 'USD' },
        presentment_money: { amount: '0.00', currency_code: 'USD' },
      },
      total_shipping_price_set: {
        shop_money: { amount: '0.00', currency_code: 'USD' },
        presentment_money: { amount: '0.00', currency_code: 'USD' },
      },
      subtotal_price_set: {
        shop_money: { amount: '90.00', currency_code: 'USD' },
        presentment_money: { amount: '90.00', currency_code: 'USD' },
      },
      total_price_set: {
        shop_money: { amount: '100.00', currency_code: 'USD' },
        presentment_money: { amount: '100.00', currency_code: 'USD' },
      },
      total_tax_set: {
        shop_money: { amount: '10.00', currency_code: 'USD' },
        presentment_money: { amount: '10.00', currency_code: 'USD' },
      },
      line_items: orderData.line_items ?? [
        {
          id: nextProductId(),
          variant_id: nextProductId(),
          title: 'Test Product',
          quantity: 1,
          sku: 'SKU123',
          variant_title: null,
          vendor: 'Test Vendor',
          fulfillment_service: 'manual',
          product_id: nextProductId(),
          requires_shipping: true,
          taxable: true,
          gift_card: false,
          name: 'Test Product',
          variant_inventory_management: 'shopify',
          properties: [],
          product_exists: true,
          fulfillable_quantity: 1,
          grams: 0,
          price: '90.00',
          total_discount: '0.00',
          fulfillment_status: null,
          price_set: {
            shop_money: { amount: '90.00', currency_code: 'USD' },
            presentment_money: { amount: '90.00', currency_code: 'USD' },
          },
          total_discount_set: {
            shop_money: { amount: '0.00', currency_code: 'USD' },
            presentment_money: { amount: '0.00', currency_code: 'USD' },
          },
          discount_allocations: [],
          duties: [],
          admin_graphql_api_id: `gid://shopify/LineItem/${nextProductId()}`,
        },
      ],
      shipping_lines: [],
      billing_address: orderData.billing_address ?? {
        first_name: 'John',
        address1: '123 Main St',
        phone: '555-123-4567',
        city: 'San Francisco',
        zip: '94105',
        province: 'CA',
        country: 'US',
        last_name: 'Doe',
        address2: '',
        company: null,
        latitude: 37.7749,
        longitude: -122.4194,
        name: 'John Doe',
        country_code: 'US',
        province_code: 'CA',
      },
      shipping_address: orderData.shipping_address ?? {
        first_name: 'John',
        address1: '123 Main St',
        phone: '555-123-4567',
        city: 'San Francisco',
        zip: '94105',
        province: 'CA',
        country: 'US',
        last_name: 'Doe',
        address2: '',
        company: null,
        latitude: 37.7749,
        longitude: -122.4194,
        name: 'John Doe',
        country_code: 'US',
        province_code: 'CA',
      },
      fulfillments: [],
      refunds: [],
      customer: orderData.customer ?? {
        id: nextCustomerId(),
        email: orderData.email ?? 'customer@example.com',
        accepts_marketing: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        first_name: 'John',
        last_name: 'Doe',
        state: 'disabled',
        note: null,
        verified_email: true,
        multipass_identifier: null,
        tax_exempt: false,
        phone: null,
        tags: '',
        currency: 'USD',
      },
    }

    service.state.orders.set(id, order)
    json(res, 201, { order })
  })

  // Customers
  service.on('GET', '/admin/api/2024-01/customers.json', (req, res) => {
    const limit = Number(req.query.limit ?? 50)
    const customers = [...service.state.customers.values()].slice(0, limit)
    json(res, 200, { customers })
  })

  service.on('POST', '/admin/api/2024-01/customers.json', (req, res) => {
    const body = req.json ?? {}
    const customerData = body.customer ?? {}
    const id = String(nextCustomerId())

    const customer = {
      id: Number(id),
      email: customerData.email ?? 'customer@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      first_name: customerData.first_name ?? 'John',
      last_name: customerData.last_name ?? 'Doe',
      state: 'disabled',
      note: null,
      verified_email: true,
      multipass_identifier: null,
      tax_exempt: false,
      phone: null,
      tags: '',
      currency: 'USD',
      accepts_marketing: false,
      addresses: customerData.addresses ?? [],
      default_address: customerData.default_address ?? {
        id: nextCustomerId(),
        customer_id: Number(id),
        first_name: 'John',
        last_name: 'Doe',
        company: null,
        address1: '123 Main St',
        address2: '',
        city: 'San Francisco',
        province: 'CA',
        country: 'US',
        zip: '94105',
        phone: '555-123-4567',
        name: 'John Doe',
        province_code: 'CA',
        country_code: 'US',
        country_name: 'United States',
        default: true,
      },
    }

    service.state.customers.set(id, customer)
    json(res, 201, { customer })
  })

  // Webhooks
  service.on('POST', '/admin/api/2024-01/webhooks.json', (req, res) => {
    const body = req.json ?? {}
    service.state.webhooks.push(body)
    json(res, 201, {
      webhook: {
        id: nextOrderId(),
        address: body.webhook?.address ?? 'https://example.com/webhook',
        topic: body.webhook?.topic ?? 'orders/create',
        format: 'json',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    })
  })

  return service
}

/**
 * eBay.
 *
 * The eBay Sell API: inventory, offers, orders, and fulfillment.
 * This is a simplified mock covering the key endpoints.
 *
 * The reference decides: an item with `success` succeeds, `failed` fails.
 */
export function createEbayMock() {
  const service = new MockService('ebay')

  service.state.inventoryItems = new Map()
  service.state.offers = new Map()
  service.state.orders = new Map()

  let offerId = 1000
  let orderId = 2000

  const nextOfferId = () => offerId++
  const nextOrderId = () => orderId++

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'ebay-mock' })
  })

  // OAuth token endpoint
  service.on('POST', '/identity/v1/oauth2/token', (req, res) => {
    json(res, 200, {
      access_token: 'mock_ebay_token',
      token_type: 'Bearer',
      expires_in: 7200,
      refresh_token: 'mock_refresh_token',
      refresh_token_expires_in: 47304000,
      scope: 'https://api.ebay.com/oauth/api_scope',
    })
  })

  // Inventory API
  service.on('PUT', '/sell/inventory/v1/inventory_item/:sku', (req, res) => {
    const sku = String(req.params.sku)
    const body = req.json ?? {}

    const item = {
      sku,
      product: body.product ?? {
        title: `Product ${sku}`,
        description: 'Test product description.',
        aspects: { Brand: ['Test Brand'] },
        imageUrls: ['https://example.com/image.jpg'],
      },
      condition: body.condition ?? 'NEW',
      availability: body.availability ?? { shipToLocationAvailability: { quantity: 100 } },
      locale: 'en_US',
    }

    service.state.inventoryItems.set(sku, item)
    json(res, 200, item)
  })

  service.on('GET', '/sell/inventory/v1/inventory_item/:sku', (req, res) => {
    const sku = String(req.params.sku)
    const item = service.state.inventoryItems.get(sku)

    if (!item) {
      json(res, 404, { errors: [{ errorId: 25709, domain: 'API_INVENTORY', category: 'REQUEST', message: 'Inventory item not found' }] })
      return
    }

    json(res, 200, item)
  })

  // Offer API
  service.on('POST', '/sell/inventory/v1/offer', (req, res) => {
    const body = req.json ?? {}
    const offerId = String(nextOfferId())

    const isFailed = failed(body.sku ?? offerId)

    const offer = {
      offerId,
      sku: body.sku ?? `SKU${offerId}`,
      marketplaceId: body.marketplaceId ?? 'EBAY_US',
      format: 'FIXED_PRICE',
      availableQuantity: body.availableQuantity ?? 10,
      categoryId: body.categoryId ?? '1234',
      listingDescription: body.listingDescription ?? 'Test listing description.',
      listingPolicies: body.listingPolicies ?? {
        returnPolicy: { returnPolicyId: 'return_policy_1' },
        fulfillmentPolicy: { fulfillmentPolicyId: 'fulfillment_policy_1' },
        paymentPolicy: { paymentPolicyId: 'payment_policy_1' },
      },
      pricingSummary: {
        price: { value: '100.00', currency: 'USD' },
      },
      quantityLimitPerBuyer: 10,
      status: isFailed ? 'ENDED' : 'PUBLISHED',
    }

    service.state.offers.set(offerId, offer)
    json(res, 201, offer)
  })

  service.on('GET', '/sell/inventory/v1/offer/:offerId', (req, res) => {
    const offerId = String(req.params.offerId)
    const offer = service.state.offers.get(offerId)

    if (!offer) {
      json(res, 404, { errors: [{ errorId: 25710, domain: 'API_INVENTORY', category: 'REQUEST', message: 'Offer not found' }] })
      return
    }

    json(res, 200, offer)
  })

  // Orders API
  service.on('GET', '/sell/fulfillment/v1/order', (req, res) => {
    const limit = Number(req.query.limit ?? 50)
    const orders = [...service.state.orders.values()].slice(0, limit)
    json(res, 200, { orders, total: orders.length })
  })

  service.on('GET', '/sell/fulfillment/v1/order/:orderId', (req, res) => {
    const orderId = String(req.params.orderId)
    const order = service.state.orders.get(orderId)

    if (!order) {
      json(res, 404, { errors: [{ errorId: 1100, domain: 'API_FULFILLMENT', category: 'REQUEST', message: 'Order not found' }] })
      return
    }

    json(res, 200, order)
  })

  return service
}

/**
 * Etsy.
 *
 * The Etsy Open API: listings, shops, orders, and receipts.
 * This is a simplified mock covering the key endpoints.
 *
 * The reference decides: a listing with `success` succeeds, `failed` fails.
 */
export function createEtsyMock() {
  const service = new MockService('etsy')

  service.state.listings = new Map()
  service.state.shops = new Map()
  service.state.receipts = new Map()

  let listingId = 1000
  let receiptId = 2000

  const nextListingId = () => listingId++
  const nextReceiptId = () => receiptId++

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'etsy-mock' })
  })

  // OAuth token endpoint
  service.on('POST', '/v3/oauth/token', (req, res) => {
    json(res, 200, {
      access_token: 'mock_etsy_token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'mock_refresh_token',
      scope: 'listings_r listings_w shops_r transactions_r',
    })
  })

  // Listings
  service.on('GET', '/v3/application/shops/:shopId/listings', (req, res) => {
    const limit = Number(req.query.limit ?? 50)
    const shopId = String(req.params.shopId)
    const listings = [...service.state.listings.values()].filter((l) => l.shop_id === shopId).slice(0, limit)

    json(res, 200, {
      count: listings.length,
      results: listings,
      pagination: { next_page: null },
    })
  })

  service.on('POST', '/v3/application/shops/:shopId/listings', (req, res) => {
    const body = req.json ?? {}
    const shopId = String(req.params.shopId)
    const listingId = nextListingId()

    const isFailed = failed(body.title ?? listingId)

    const listing = {
      listing_id: listingId,
      shop_id: shopId,
      title: body.title ?? `Test Listing ${listingId}`,
      description: body.description ?? 'Test description.',
      state: isFailed ? 'draft' : 'active',
      quantity: body.quantity ?? 10,
      price: { amount: '100.00', currency_code: 'USD' },
      tags: body.tags ?? ['test', 'handmade'],
      materials: body.materials ?? ['wood', 'paint'],
      shipping_profile_id: body.shipping_profile_id ?? 'ship_profile_1',
      return_policy_id: body.return_policy_id ?? 'return_policy_1',
      creation_tsz: Date.now(),
      ending_tsz: Date.now() + 3600 * 24 * 30 * 1000,
      views: 0,
      num_favorers: 0,
      url: `${service.url}/listing/${listingId}`,
    }

    service.state.listings.set(String(listingId), listing)
    json(res, 201, listing)
  })

  service.on('GET', '/v3/application/listings/:listingId', (req, res) => {
    const listingId = String(req.params.listingId)
    const listing = service.state.listings.get(listingId)

    if (!listing) {
      json(res, 404, { error: 'Listing not found' })
      return
    }

    json(res, 200, listing)
  })

  // Receipts (orders)
  service.on('GET', '/v3/application/shops/:shopId/receipts', (req, res) => {
    const limit = Number(req.query.limit ?? 50)
    const shopId = String(req.params.shopId)
    const receipts = [...service.state.receipts.values()].filter((r) => r.shop_id === shopId).slice(0, limit)

    json(res, 200, {
      count: receipts.length,
      results: receipts,
      pagination: { next_page: null },
    })
  })

  return service
}

/**
 * Walmart.
 *
 * The Walmart Marketplace API: items, orders, and feeds.
 * This is a simplified mock covering the key endpoints.
 *
 * The reference decides: an item with `success` succeeds, `failed` fails.
 */
export function createWalmartMock() {
  const service = new MockService('walmart')

  service.state.items = new Map()
  service.state.orders = new Map()
  service.state.feeds = new Map()

  let feedId = 1000

  const nextFeedId = () => feedId++

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'walmart-mock' })
  })

  // Items API
  service.on('GET', '/v3/items', (req, res) => {
    const limit = Number(req.query.limit ?? 50)
    const items = [...service.state.items.values()].slice(0, limit)
    json(res, 200, { items, totalResults: items.length })
  })

  service.on('POST', '/v3/items', (req, res) => {
    const body = req.json ?? {}
    const sku = body.sku ?? `WM${Date.now()}`

    const isFailed = failed(sku)

    const item = {
      sku,
      productName: body.productName ?? `Product ${sku}`,
      shortDescription: body.shortDescription ?? 'Short description.',
      longDescription: body.longDescription ?? 'Long description.',
      primaryImageUrl: body.primaryImageUrl ?? 'https://example.com/image.jpg',
      category: body.category ?? 'Electronics',
      brand: body.brand ?? 'Test Brand',
      gtin: body.gtin ?? `123456789${sku}`,
      productIdentifiers: body.productIdentifiers ?? [],
      price: { amount: '100.00', currency: 'USD' },
      shippingWeight: { value: 10, unit: 'LB' },
      shipToLocation: body.shipToLocation ?? ['US'],
      productCondition: body.productCondition ?? 'NEW',
      lifecycleStatus: isFailed ? 'INACTIVE' : 'ACTIVE',
      publishedStatus: isFailed ? 'UNPUBLISHED' : 'PUBLISHED',
    }

    service.state.items.set(sku, item)
    json(res, 201, item)
  })

  service.on('GET', '/v3/items/:sku', (req, res) => {
    const sku = String(req.params.sku)
    const item = service.state.items.get(sku)

    if (!item) {
      json(res, 404, { errors: [{ code: 'NOT_FOUND', message: 'Item not found' }] })
      return
    }

    json(res, 200, item)
  })

  // Orders API
  service.on('GET', '/v3/orders', (req, res) => {
    const limit = Number(req.query.limit ?? 50)
    const orders = [...service.state.orders.values()].slice(0, limit)
    json(res, 200, { orders, totalElements: orders.length })
  })

  service.on('GET', '/v3/orders/:orderId', (req, res) => {
    const orderId = String(req.params.orderId)
    const order = service.state.orders.get(orderId)

    if (!order) {
      json(res, 404, { errors: [{ code: 'NOT_FOUND', message: 'Order not found' }] })
      return
    }

    json(res, 200, order)
  })

  // Feeds API
  service.on('POST', '/v3/feeds', (req, res) => {
    const body = req.json ?? {}
    const feedId = nextFeedId()

    const feed = {
      feedId,
      feedType: body.feedType ?? 'item',
      status: 'SUBMITTED',
      submittedDate: new Date().toISOString(),
      processingStatus: 'IN_PROGRESS',
    }

    service.state.feeds.set(String(feedId), feed)
    json(res, 202, feed)
  })

  service.on('GET', '/v3/feeds/:feedId', (req, res) => {
    const feedId = String(req.params.feedId)
    const feed = service.state.feeds.get(feedId)

    if (!feed) {
      json(res, 404, { errors: [{ code: 'NOT_FOUND', message: 'Feed not found' }] })
      return
    }

    json(res, 200, feed)
  })

  return service
}
