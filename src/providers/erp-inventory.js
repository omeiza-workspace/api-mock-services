import { MockService, json, counter } from '../harness.js'

/**
 * Cin7 (formerly DEAR Systems / TradeGecko).
 *
 * The Cin7 API: products, orders, stock, and suppliers.
 * The shapes match Cin7's API.
 *
 * The reference decides: a product with `success` succeeds, `failed` fails.
 */
export function createCin7Mock() {
  const service = new MockService('cin7')

  service.state.products = new Map()
  service.state.orders = new Map()
  service.state.suppliers = new Map()
  service.state.stock = new Map()

  let productId = 1000
  let orderId = 2000
  let supplierId = 3000

  const nextProductId = () => String(productId++)
  const nextOrderId = () => String(orderId++)
  const nextSupplierId = () => String(supplierId++)

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'cin7-mock' })
  })

  // OAuth token endpoint
  service.on('POST', '/api/auth/token', (req, res) => {
    json(res, 200, {
      access_token: 'mock_cin7_token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'mock_refresh_token',
    })
  })

  // Products
  service.on('POST', '/api/v1/products', (req, res) => {
    const body = req.json ?? {}
    const sku = body.SKU ?? body.sku ?? `SKU-${nextProductId()}`

    const isFailed = failed(sku)
    const id = nextProductId()

    const product = {
      Id: id,
      SKU: sku,
      Name: body.Name ?? body.name ?? `Product ${sku}`,
      Description: body.Description ?? body.description ?? '',
      ProductType: body.ProductType ?? 'Stock',
      UnitOfMeasure: body.UnitOfMeasure ?? 'Each',
      UnitPrice: body.UnitPrice ?? body.unitPrice ?? '100.00',
      SalePrice: body.SalePrice ?? body.salePrice ?? '120.00',
      PurchasePrice: body.PurchasePrice ?? body.purchasePrice ?? '60.00',
      Category: body.Category ?? 'General',
      Brand: body.Brand ?? '',
      Supplier: body.Supplier ?? '',
      SupplierCode: body.SupplierCode ?? '',
      IsActive: !isFailed,
      CreatedOn: new Date().toISOString(),
      ModifiedOn: new Date().toISOString(),
    }

    service.state.products.set(id, product)

    if (isFailed) {
      json(res, 400, { Error: 'Failed to create product', Code: 'CREATE_FAILED' })
      return
    }

    json(res, 201, product)
  })

  service.on('GET', '/api/v1/products', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const products = [...service.state.products.values()].slice(0, limit)
    json(res, 200, { Products: products, Total: products.length })
  })

  service.on('GET', '/api/v1/products/:id', (req, res) => {
    const id = String(req.params.id)
    const product = service.state.products.get(id)

    if (!product) {
      json(res, 404, { Error: 'Product not found', Code: 'NOT_FOUND' })
      return
    }

    json(res, 200, product)
  })

  // Orders
  service.on('POST', '/api/v1/orders', (req, res) => {
    const body = req.json ?? {}
    const orderNumber = body.OrderNumber ?? `ORD-${nextOrderId()}`

    const isFailed = failed(orderNumber)
    const id = nextOrderId()

    const order = {
      Id: id,
      OrderNumber: orderNumber,
      CustomerName: body.CustomerName ?? 'Test Customer',
      CustomerEmail: body.CustomerEmail ?? 'customer@example.com',
      OrderDate: body.OrderDate ?? new Date().toISOString().split('T')[0],
      RequiredDate: body.RequiredDate ?? new Date(Date.now() + 604800000).toISOString().split('T')[0],
      Status: isFailed ? 'Cancelled' : 'Draft',
      TotalAmount: body.TotalAmount ?? '100.00',
      TaxAmount: body.TaxAmount ?? '10.00',
      DiscountAmount: body.DiscountAmount ?? '0.00',
      Currency: body.Currency ?? 'USD',
      Lines: body.Lines ?? [
        {
          ProductId: body.Lines?.[0]?.ProductId ?? '1',
          ProductName: body.Lines?.[0]?.ProductName ?? 'Test Product',
          Quantity: body.Lines?.[0]?.Quantity ?? 1,
          UnitPrice: body.Lines?.[0]?.UnitPrice ?? '100.00',
          Discount: body.Lines?.[0]?.Discount ?? '0.00',
          Tax: body.Lines?.[0]?.Tax ?? '10.00',
          Total: '100.00',
        },
      ],
      CreatedOn: new Date().toISOString(),
      ModifiedOn: new Date().toISOString(),
    }

    service.state.orders.set(id, order)

    if (isFailed) {
      json(res, 400, { Error: 'Failed to create order', Code: 'CREATE_FAILED' })
      return
    }

    json(res, 201, order)
  })

  service.on('GET', '/api/v1/orders', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const orders = [...service.state.orders.values()].slice(0, limit)
    json(res, 200, { Orders: orders, Total: orders.length })
  })

  // Suppliers
  service.on('POST', '/api/v1/suppliers', (req, res) => {
    const body = req.json ?? {}
    const name = body.Name ?? `Supplier ${nextSupplierId()}`

    const isFailed = failed(name)
    const id = nextSupplierId()

    const supplier = {
      Id: id,
      Name: name,
      ContactName: body.ContactName ?? '',
      Email: body.Email ?? 'supplier@example.com',
      Phone: body.Phone ?? '555-1234',
      Address: body.Address ?? { Line1: '123 Supplier St', City: 'San Francisco', State: 'CA', PostalCode: '94105', Country: 'US' },
      Currency: body.Currency ?? 'USD',
      PaymentTerms: body.PaymentTerms ?? 'NET30',
      IsActive: !isFailed,
      CreatedOn: new Date().toISOString(),
      ModifiedOn: new Date().toISOString(),
    }

    service.state.suppliers.set(id, supplier)

    if (isFailed) {
      json(res, 400, { Error: 'Failed to create supplier', Code: 'CREATE_FAILED' })
      return
    }

    json(res, 201, supplier)
  })

  service.on('GET', '/api/v1/suppliers', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const suppliers = [...service.state.suppliers.values()].slice(0, limit)
    json(res, 200, { Suppliers: suppliers, Total: suppliers.length })
  })

  // Stock
  service.on('GET', '/api/v1/stock', (req, res) => {
    const productId = req.query.ProductId
    const stock = []

    for (const [id, product] of service.state.products) {
      if (productId && productId !== id) continue

      stock.push({
        ProductId: id,
        ProductName: product.Name,
        SKU: product.SKU,
        QuantityOnHand: Math.floor(Math.random() * 1000),
        QuantityAllocated: Math.floor(Math.random() * 100),
        QuantityAvailable: Math.floor(Math.random() * 900),
        Location: 'Main Warehouse',
        LastUpdated: new Date().toISOString(),
      })
    }

    json(res, 200, { Stock: stock, Total: stock.length })
  })

  return service
}

/**
 * DEAR Systems (now part of Cin7).
 *
 * The DEAR API: products, purchase orders, sale orders, and stock.
 * The shapes match DEAR's API.
 *
 * The reference decides: a product with `success` succeeds, `failed` fails.
 */
export function createDearMock() {
  const service = new MockService('dear')

  service.state.products = new Map()
  service.state.purchaseOrders = new Map()
  service.state.saleOrders = new Map()
  service.state.stock = new Map()

  let productId = 1000
  let poId = 2000
  let soId = 3000

  const nextProductId = () => String(productId++)
  const nextPoId = () => String(poId++)
  const nextSoId = () => String(soId++)

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'dear-mock' })
  })

  // Products
  service.on('POST', '/api/v2/Product', (req, res) => {
    const body = req.json ?? {}
    const sku = body.SKU ?? `SKU-${nextProductId()}`

    const isFailed = failed(sku)
    const id = nextProductId()

    const product = {
      ID: id,
      SKU: sku,
      Name: body.Name ?? `Product ${sku}`,
      Description: body.Description ?? '',
      ProductType: body.ProductType ?? 'Stock',
      UnitOfMeasure: body.UnitOfMeasure ?? 'Each',
      UnitPrice: body.UnitPrice ?? '100.00',
      SalePrice: body.SalePrice ?? '120.00',
      PurchasePrice: body.PurchasePrice ?? '60.00',
      Category: body.Category ?? 'General',
      Brand: body.Brand ?? '',
      Supplier: body.Supplier ?? '',
      SupplierCode: body.SupplierCode ?? '',
      IsActive: !isFailed,
      Created: new Date().toISOString(),
      Modified: new Date().toISOString(),
    }

    service.state.products.set(id, product)

    if (isFailed) {
      json(res, 400, { Message: 'Failed to create product', Code: 'CREATE_FAILED' })
      return
    }

    json(res, 201, product)
  })

  service.on('GET', '/api/v2/Product', (req, res) => {
    const limit = Number(req.query.Limit ?? 100)
    const products = [...service.state.products.values()].slice(0, limit)
    json(res, 200, { Products: products, Total: products.length, Page: 1, PageSize: limit })
  })

  service.on('GET', '/api/v2/Product/:id', (req, res) => {
    const id = String(req.params.id)
    const product = service.state.products.get(id)

    if (!product) {
      json(res, 404, { Message: 'Product not found', Code: 'NOT_FOUND' })
      return
    }

    json(res, 200, product)
  })

  // Purchase Orders
  service.on('POST', '/api/v2/PurchaseOrder', (req, res) => {
    const body = req.json ?? {}
    const orderNumber = body.OrderNumber ?? `PO-${nextPoId()}`

    const isFailed = failed(orderNumber)
    const id = nextPoId()

    const po = {
      ID: id,
      OrderNumber: orderNumber,
      Supplier: body.Supplier ?? 'Test Supplier',
      SupplierID: body.SupplierID ?? '1',
      OrderDate: body.OrderDate ?? new Date().toISOString().split('T')[0],
      RequiredDate: body.RequiredDate ?? new Date(Date.now() + 604800000).toISOString().split('T')[0],
      Status: isFailed ? 'VOIDED' : 'DRAFT',
      Total: body.Total ?? '100.00',
      Tax: body.Tax ?? '10.00',
      Currency: body.Currency ?? 'USD',
      Lines: body.Lines ?? [
        {
          ProductID: body.Lines?.[0]?.ProductID ?? '1',
          ProductName: body.Lines?.[0]?.ProductName ?? 'Test Product',
          Quantity: body.Lines?.[0]?.Quantity ?? 1,
          UnitPrice: body.Lines?.[0]?.UnitPrice ?? '100.00',
          Discount: body.Lines?.[0]?.Discount ?? '0.00',
          Tax: body.Lines?.[0]?.Tax ?? '10.00',
          Total: '100.00',
        },
      ],
      Created: new Date().toISOString(),
      Modified: new Date().toISOString(),
    }

    service.state.purchaseOrders.set(id, po)

    if (isFailed) {
      json(res, 400, { Message: 'Failed to create purchase order', Code: 'CREATE_FAILED' })
      return
    }

    json(res, 201, po)
  })

  service.on('GET', '/api/v2/PurchaseOrder', (req, res) => {
    const limit = Number(req.query.Limit ?? 100)
    const pos = [...service.state.purchaseOrders.values()].slice(0, limit)
    json(res, 200, { PurchaseOrders: pos, Total: pos.length, Page: 1, PageSize: limit })
  })

  // Sale Orders
  service.on('POST', '/api/v2/SaleOrder', (req, res) => {
    const body = req.json ?? {}
    const orderNumber = body.OrderNumber ?? `SO-${nextSoId()}`

    const isFailed = failed(orderNumber)
    const id = nextSoId()

    const so = {
      ID: id,
      OrderNumber: orderNumber,
      Customer: body.Customer ?? 'Test Customer',
      CustomerID: body.CustomerID ?? '1',
      OrderDate: body.OrderDate ?? new Date().toISOString().split('T')[0],
      RequiredDate: body.RequiredDate ?? new Date(Date.now() + 604800000).toISOString().split('T')[0],
      Status: isFailed ? 'VOIDED' : 'DRAFT',
      Total: body.Total ?? '100.00',
      Tax: body.Tax ?? '10.00',
      Currency: body.Currency ?? 'USD',
      Lines: body.Lines ?? [
        {
          ProductID: body.Lines?.[0]?.ProductID ?? '1',
          ProductName: body.Lines?.[0]?.ProductName ?? 'Test Product',
          Quantity: body.Lines?.[0]?.Quantity ?? 1,
          UnitPrice: body.Lines?.[0]?.UnitPrice ?? '100.00',
          Discount: body.Lines?.[0]?.Discount ?? '0.00',
          Tax: body.Lines?.[0]?.Tax ?? '10.00',
          Total: '100.00',
        },
      ],
      Created: new Date().toISOString(),
      Modified: new Date().toISOString(),
    }

    service.state.saleOrders.set(id, so)

    if (isFailed) {
      json(res, 400, { Message: 'Failed to create sale order', Code: 'CREATE_FAILED' })
      return
    }

    json(res, 201, so)
  })

  service.on('GET', '/api/v2/SaleOrder', (req, res) => {
    const limit = Number(req.query.Limit ?? 100)
    const sos = [...service.state.saleOrders.values()].slice(0, limit)
    json(res, 200, { SaleOrders: sos, Total: sos.length, Page: 1, PageSize: limit })
  })

  // Stock
  service.on('GET', '/api/v2/Stock', (req, res) => {
    const productId = req.query.ProductID
    const stock = []

    for (const [id, product] of service.state.products) {
      if (productId && productId !== id) continue

      stock.push({
        ProductID: id,
        ProductName: product.Name,
        SKU: product.SKU,
        QuantityOnHand: Math.floor(Math.random() * 1000),
        QuantityAllocated: Math.floor(Math.random() * 100),
        QuantityAvailable: Math.floor(Math.random() * 900),
        Location: 'Main Warehouse',
        LastUpdated: new Date().toISOString(),
      })
    }

    json(res, 200, { Stock: stock, Total: stock.length })
  })

  return service
}

/**
 * TradeGecko (now part of Cin7).
 *
 * The TradeGecko API: products, orders, stock levels, and fulfillment.
 * The shapes match TradeGecko's API.
 *
 * The reference decides: a product with `success` succeeds, `failed` fails.
 */
export function createTradeGeckoMock() {
  const service = new MockService('tradegecko')

  service.state.products = new Map()
  service.state.orders = new Map()
  service.state.variants = new Map()
  service.state.stockLevels = new Map()

  let productId = 1000
  let variantId = 2000
  let orderId = 3000

  const nextProductId = () => String(productId++)
  const nextVariantId = () => String(variantId++)
  const nextOrderId = () => String(orderId++)

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'tradegecko-mock' })
  })

  // Products
  service.on('POST', '/products', (req, res) => {
    const body = req.json ?? {}
    const sku = body.sku ?? `SKU-${nextProductId()}`

    const isFailed = failed(sku)
    const id = nextProductId()

    const product = {
      id,
      sku,
      name: body.name ?? `Product ${sku}`,
      description: body.description ?? '',
      product_type: body.product_type ?? 'standard',
      status: isFailed ? 'archived' : 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      variants: [],
      images: [],
      collections: [],
    }

    service.state.products.set(id, product)

    if (isFailed) {
      json(res, 400, { errors: { sku: ['Failed to create product'] } })
      return
    }

    json(res, 201, { product })
  })

  service.on('GET', '/products', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const products = [...service.state.products.values()].slice(0, limit)
    json(res, 200, { products, meta: { total: products.length } })
  })

  service.on('GET', '/products/:id', (req, res) => {
    const id = String(req.params.id)
    const product = service.state.products.get(id)

    if (!product) {
      json(res, 404, { errors: 'Product not found' })
      return
    }

    json(res, 200, { product })
  })

  // Variants
  service.on('POST', '/variants', (req, res) => {
    const body = req.json ?? {}
    const productId = body.product_id

    if (!productId) {
      json(res, 400, { errors: { product_id: ['is required'] } })
      return
    }

    const isFailed = failed(productId)
    const id = nextVariantId()

    const variant = {
      id,
      product_id: productId,
      sku: body.sku ?? `VAR-${nextVariantId()}`,
      name: body.name ?? 'Default Variant',
      barcode: body.barcode ?? '',
      weight: body.weight ?? 0,
      weight_unit: body.weight_unit ?? 'kg',
      length: body.length ?? 0,
      width: body.width ?? 0,
      height: body.height ?? 0,
      length_unit: body.length_unit ?? 'cm',
      retail_price: body.retail_price ?? '100.00',
      wholesale_price: body.wholesale_price ?? '60.00',
      cost_price: body.cost_price ?? '50.00',
      taxable: body.taxable ?? true,
      sellable: !isFailed,
      purchasable: true,
      track_stock: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    service.state.variants.set(id, variant)

    if (isFailed) {
      json(res, 400, { errors: { product_id: ['Failed to create variant'] } })
      return
    }

    json(res, 201, { variant })
  })

  service.on('GET', '/variants', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const variants = [...service.state.variants.values()].slice(0, limit)
    json(res, 200, { variants, meta: { total: variants.length } })
  })

  // Orders
  service.on('POST', '/orders', (req, res) => {
    const body = req.json ?? {}
    const orderNumber = body.order_number ?? `ORD-${nextOrderId()}`

    const isFailed = failed(orderNumber)
    const id = nextOrderId()

    const order = {
      id,
      order_number: orderNumber,
      status: isFailed ? 'cancelled' : 'draft',
      customer: body.customer ?? { id: '1', name: 'Test Customer', email: 'customer@example.com' },
      shipping_address: body.shipping_address ?? { address1: '123 Main St', city: 'San Francisco', state: 'CA', zip: '94105', country: 'US' },
      billing_address: body.billing_address ?? { address1: '123 Main St', city: 'San Francisco', state: 'CA', zip: '94105', country: 'US' },
      currency: body.currency ?? 'USD',
      total_price: body.total_price ?? '100.00',
      tax_price: body.tax_price ?? '10.00',
      discount_price: body.discount_price ?? '0.00',
      line_items: body.line_items ?? [
        {
          variant_id: body.line_items?.[0]?.variant_id ?? '1',
          quantity: body.line_items?.[0]?.quantity ?? 1,
          price: body.line_items?.[0]?.price ?? '100.00',
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    service.state.orders.set(id, order)

    if (isFailed) {
      json(res, 400, { errors: { order_number: ['Failed to create order'] } })
      return
    }

    json(res, 201, { order })
  })

  service.on('GET', '/orders', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const orders = [...service.state.orders.values()].slice(0, limit)
    json(res, 200, { orders, meta: { total: orders.length } })
  })

  // Stock Levels
  service.on('GET', '/stock_levels', (req, res) => {
    const variantId = req.query.variant_id
    const stockLevels = []

    for (const [id, variant] of service.state.variants) {
      if (variantId && variantId !== id) continue

      stockLevels.push({
        id: `sl_${id}`,
        variant_id: id,
        location_id: '1',
        quantity_on_hand: Math.floor(Math.random() * 1000),
        incoming_stock: Math.floor(Math.random() * 100),
        available_stock: Math.floor(Math.random() * 900),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    json(res, 200, { stock_levels: stockLevels, meta: { total: stockLevels.length } })
  })

  return service
}

/**
 * Katana.
 *
 * The Katana MRP API: products, manufacturing orders, sales orders, and inventory.
 * The shapes match Katana's API.
 *
 * The reference decides: a product with `success` succeeds, `failed` fails.
 */
export function createKatanaMock() {
  const service = new MockService('katana')

  service.state.products = new Map()
  service.state.variants = new Map()
  service.state.salesOrders = new Map()
  service.state.manufacturingOrders = new Map()
  service.state.inventory = new Map()

  let productId = 1000
  let variantId = 2000
  let soId = 3000
  let moId = 4000

  const nextProductId = () => String(productId++)
  const nextVariantId = () => String(variantId++)
  const nextSoId = () => String(soId++)
  const nextMoId = () => String(moId++)

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'katana-mock' })
  })

  // Products
  service.on('POST', '/api/v1/products', (req, res) => {
    const body = req.json ?? {}
    const sku = body.sku ?? `SKU-${nextProductId()}`

    const isFailed = failed(sku)
    const id = nextProductId()

    const product = {
      id,
      sku,
      name: body.name ?? `Product ${sku}`,
      type: body.type ?? 'product',
      category_id: body.category_id ?? null,
      sales_price: body.sales_price ?? '100.00',
      purchase_price: body.purchase_price ?? '60.00',
      default_variant_id: null,
      is_batch_tracked: body.is_batch_tracked ?? false,
      is_serial_tracked: body.is_serial_tracked ?? false,
      status: isFailed ? 'archived' : 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    service.state.products.set(id, product)

    if (isFailed) {
      json(res, 400, { errors: { sku: ['Failed to create product'] } })
      return
    }

    json(res, 201, { product })
  })

  service.on('GET', '/api/v1/products', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const products = [...service.state.products.values()].slice(0, limit)
    json(res, 200, { products: products, meta: { total: products.length } })
  })

  service.on('GET', '/api/v1/products/:id', (req, res) => {
    const id = String(req.params.id)
    const product = service.state.products.get(id)

    if (!product) {
      json(res, 404, { errors: 'Product not found' })
      return
    }

    json(res, 200, { product })
  })

  // Variants
  service.on('POST', '/api/v1/variants', (req, res) => {
    const body = req.json ?? {}
    const productId = body.product_id

    if (!productId) {
      json(res, 400, { errors: { product_id: ['is required'] } })
      return
    }

    const isFailed = failed(productId)
    const id = nextVariantId()

    const variant = {
      id,
      product_id: productId,
      sku: body.sku ?? `VAR-${nextVariantId()}`,
      name: body.name ?? 'Default Variant',
      barcode: body.barcode ?? '',
      sales_price: body.sales_price ?? '100.00',
      purchase_price: body.purchase_price ?? '60.00',
      cost: body.cost ?? '50.00',
      weight: body.weight ?? 0,
      weight_unit: body.weight_unit ?? 'kg',
      is_sellable: !isFailed,
      is_purchasable: true,
      track_inventory: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    service.state.variants.set(id, variant)

    if (isFailed) {
      json(res, 400, { errors: { product_id: ['Failed to create variant'] } })
      return
    }

    json(res, 201, { variant })
  })

  service.on('GET', '/api/v1/variants', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const variants = [...service.state.variants.values()].slice(0, limit)
    json(res, 200, { variants: variants, meta: { total: variants.length } })
  })

  // Sales Orders
  service.on('POST', '/api/v1/sales_orders', (req, res) => {
    const body = req.json ?? {}
    const orderNumber = body.order_number ?? `SO-${nextSoId()}`

    const isFailed = failed(orderNumber)
    const id = nextSoId()

    const so = {
      id,
      order_number: orderNumber,
      customer_id: body.customer_id ?? '1',
      customer_name: body.customer_name ?? 'Test Customer',
      status: isFailed ? 'cancelled' : 'open',
      currency: body.currency ?? 'USD',
      total_price: body.total_price ?? '100.00',
      tax_price: body.tax_price ?? '10.00',
      lines: body.lines ?? [
        {
          variant_id: body.lines?.[0]?.variant_id ?? '1',
          quantity: body.lines?.[0]?.quantity ?? 1,
          unit_price: body.lines?.[0]?.unit_price ?? '100.00',
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    service.state.salesOrders.set(id, so)

    if (isFailed) {
      json(res, 400, { errors: { order_number: ['Failed to create sales order'] } })
      return
    }

    json(res, 201, { sales_order: so })
  })

  service.on('GET', '/api/v1/sales_orders', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const sos = [...service.state.salesOrders.values()].slice(0, limit)
    json(res, 200, { sales_orders: sos, meta: { total: sos.length } })
  })

  // Manufacturing Orders
  service.on('POST', '/api/v1/manufacturing_orders', (req, res) => {
    const body = req.json ?? {}
    const moNumber = body.mo_number ?? `MO-${nextMoId()}`

    const isFailed = failed(moNumber)
    const id = nextMoId()

    const mo = {
      id,
      mo_number: moNumber,
      product_variant_id: body.product_variant_id ?? '1',
      quantity: body.quantity ?? 1,
      status: isFailed ? 'cancelled' : 'planned',
      scheduled_date: body.scheduled_date ?? new Date().toISOString().split('T')[0],
      completed_date: null,
      ingredients: body.ingredients ?? [
        {
          variant_id: body.ingredients?.[0]?.variant_id ?? '1',
          quantity: body.ingredients?.[0]?.quantity ?? 1,
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    service.state.manufacturingOrders.set(id, mo)

    if (isFailed) {
      json(res, 400, { errors: { mo_number: ['Failed to create manufacturing order'] } })
      return
    }

    json(res, 201, { manufacturing_order: mo })
  })

  service.on('GET', '/api/v1/manufacturing_orders', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const mos = [...service.state.manufacturingOrders.values()].slice(0, limit)
    json(res, 200, { manufacturing_orders: mos, meta: { total: mos.length } })
  })

  // Inventory
  service.on('GET', '/api/v1/inventory', (req, res) => {
    const variantId = req.query.variant_id
    const inventory = []

    for (const [id, variant] of service.state.variants) {
      if (variantId && variantId !== id) continue

      inventory.push({
        id: `inv_${id}`,
        variant_id: id,
        location_id: '1',
        quantity_on_hand: Math.floor(Math.random() * 1000),
        allocated_quantity: Math.floor(Math.random() * 100),
        available_quantity: Math.floor(Math.random() * 900),
        incoming_quantity: Math.floor(Math.random() * 50),
        outgoing_quantity: Math.floor(Math.random() * 50),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    json(res, 200, { inventory: inventory, meta: { total: inventory.length } })
  })

  return service
}
