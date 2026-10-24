import { MockService, json, counter } from '../harness.js'

/**
 * Avalara.
 *
 * The Avalara AvaTax API: tax calculation, address validation, and tax codes.
 * The shapes match Avalara's API.
 *
 * The reference decides: a transaction with `success` succeeds, `failed` fails.
 */
export function createAvalaraMock() {
  const service = new MockService('avalara')

  service.state.transactions = new Map()
  service.state.addresses = new Map()

  let transactionId = 1000
  let addressId = 2000

  const nextTransactionId = () => String(transactionId++)
  const nextAddressId = () => String(addressId++)

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'avalara-mock' })
  })

  // OAuth token endpoint
  service.on('POST', '/api/v2/auth/token', (req, res) => {
    json(res, 200, {
      access_token: 'mock_avalara_token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'mock_refresh_token',
    })
  })

  // Tax calculation
  service.on('POST', '/api/v2/transactions/create', (req, res) => {
    const body = req.json ?? {}
    const code = body.code ?? `TXN-${nextTransactionId()}`

    const isFailed = failed(code)
    const id = nextTransactionId()

    const lines = body.lines ?? [
      {
        number: '1',
        quantity: 1,
        amount: 100,
        taxCode: 'P0000000',
        description: 'Test Product',
      },
    ]

    const totalAmount = lines.reduce((sum, line) => sum + (line.amount ?? 0), 0)
    const totalTax = totalAmount * 0.0875 // 8.75% tax rate

    const transaction = {
      id,
      code,
      type: body.type ?? 'SalesInvoice',
      status: isFailed ? 'Error' : 'Committed',
      date: body.date ?? new Date().toISOString().split('T')[0],
      currencyCode: body.currencyCode ?? 'USD',
      customerCode: body.customerCode ?? 'CUST-001',
      addresses: body.addresses ?? {
        SingleLocation: {
          line1: '123 Main St',
          city: 'San Francisco',
          region: 'CA',
          country: 'US',
          postalCode: '94105',
        },
      },
      lines: lines.map((line, i) => ({
        number: line.number ?? String(i + 1),
        quantity: line.quantity ?? 1,
        amount: line.amount ?? 100,
        taxCode: line.taxCode ?? 'P0000000',
        description: line.description ?? 'Test Product',
        tax: Math.round((line.amount ?? 100) * 0.0875 * 100) / 100,
        taxIncluded: false,
      })),
      totalAmount,
      totalTax: isFailed ? 0 : totalTax,
      totalExempt: 0,
      totalDiscount: 0,
      taxDate: new Date().toISOString().split('T')[0],
      createdDate: new Date().toISOString(),
      modifiedDate: new Date().toISOString(),
    }

    service.state.transactions.set(id, transaction)

    if (isFailed) {
      json(res, 400, { error: { code: 'TransactionError', message: 'Failed to create transaction', details: [] } })
      return
    }

    json(res, 200, transaction)
  })

  service.on('POST', '/api/v2/transactions/calculate', (req, res) => {
    const body = req.json ?? {}
    const code = body.code ?? `CALC-${nextTransactionId()}`

    const isFailed = failed(code)

    const lines = body.lines ?? [
      {
        number: '1',
        quantity: 1,
        amount: 100,
        taxCode: 'P0000000',
      },
    ]

    const totalAmount = lines.reduce((sum, line) => sum + (line.amount ?? 0), 0)
    const totalTax = totalAmount * 0.0875

    const transaction = {
      id: nextTransactionId(),
      code,
      type: body.type ?? 'SalesInvoice',
      status: isFailed ? 'Error' : 'Temporary',
      date: body.date ?? new Date().toISOString().split('T')[0],
      currencyCode: body.currencyCode ?? 'USD',
      customerCode: body.customerCode ?? 'CUST-001',
      addresses: body.addresses ?? {
        SingleLocation: {
          line1: '123 Main St',
          city: 'San Francisco',
          region: 'CA',
          country: 'US',
          postalCode: '94105',
        },
      },
      lines: lines.map((line, i) => ({
        number: line.number ?? String(i + 1),
        quantity: line.quantity ?? 1,
        amount: line.amount ?? 100,
        taxCode: line.taxCode ?? 'P0000000',
        tax: Math.round((line.amount ?? 100) * 0.0875 * 100) / 100,
        taxIncluded: false,
      })),
      totalAmount,
      totalTax: isFailed ? 0 : totalTax,
      totalExempt: 0,
      totalDiscount: 0,
    }

    if (isFailed) {
      json(res, 400, { error: { code: 'CalculationError', message: 'Failed to calculate tax', details: [] } })
      return
    }

    json(res, 200, transaction)
  })

  // Address validation
  service.on('POST', '/api/v2/addresses/resolve', (req, res) => {
    const body = req.json ?? {}
    const line1 = body.line1 ?? '123 Main St'

    const isFailed = failed(line1)
    const id = nextAddressId()

    const address = {
      id,
      line1,
      line2: body.line2 ?? '',
      line3: body.line3 ?? '',
      city: body.city ?? 'San Francisco',
      region: body.region ?? 'CA',
      country: body.country ?? 'US',
      postalCode: body.postalCode ?? '94105',
      latitude: 37.7749,
      longitude: -122.4194,
      resolutionQuality: isFailed ? 'Error' : 'Intersection',
      validatedAddresses: isFailed
        ? []
        : [
            {
              line1: '123 Main St',
              city: 'San Francisco',
              region: 'CA',
              country: 'US',
              postalCode: '94105',
            },
          ],
    }

    service.state.addresses.set(id, address)

    if (isFailed) {
      json(res, 400, { error: { code: 'AddressError', message: 'Failed to resolve address', details: [] } })
      return
    }

    json(res, 200, address)
  })

  // Tax codes
  service.on('GET', '/api/v2/definitions/taxcodes', (req, res) => {
    const limit = Number(req.query.$top ?? 100)
    const skip = Number(req.query.$skip ?? 0)

    const taxCodes = [
      { taxCode: 'P0000000', description: 'General Tangible Personal Property', taxType: 'Sales' },
      { taxCode: 'P0000100', description: 'Clothing', taxType: 'Sales' },
      { taxCode: 'P0000200', description: 'Food & Groceries', taxType: 'Sales' },
      { taxCode: 'P0000300', description: 'Medical', taxType: 'Sales' },
      { taxCode: 'P0000400', description: 'Software', taxType: 'Sales' },
      { taxCode: 'FR000000', description: 'Freight', taxType: 'Sales' },
      { taxCode: 'DC000000', description: 'Discount', taxType: 'Sales' },
    ]

    const paginated = taxCodes.slice(skip, skip + limit)
    json(res, 200, { value: paginated, '@odata.count': taxCodes.length })
  })

  return service
}

/**
 * TaxJar.
 *
 * The TaxJar API: tax calculation, rates, categories, and nexus.
 * The shapes match TaxJar's API.
 *
 * The reference decides: a transaction with `success` succeeds, `failed` fails.
 */
export function createTaxJarMock() {
  const service = new MockService('taxjar')

  service.state.transactions = new Map()
  service.state.rates = new Map()

  let transactionId = 1000

  const nextTransactionId = () => String(transactionId++)

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'taxjar-mock' })
  })

  // Tax calculation
  service.on('POST', '/v2/taxes', (req, res) => {
    const body = req.json ?? {}
    const fromCountry = body.from_country ?? 'US'
    const fromZip = body.from_zip ?? '94105'
    const fromState = body.from_state ?? 'CA'
    const toCountry = body.to_country ?? 'US'
    const toZip = body.to_zip ?? '94105'
    const toState = body.to_state ?? 'CA'
    const amount = body.amount ?? 100
    const shipping = body.shipping ?? 0

    const isFailed = failed(`${fromZip}-${toZip}`)
    const rate = isFailed ? 0 : 0.0875

    const tax = {
      tax: {
        order_total_amount: amount,
        shipping: shipping,
        taxable_amount: amount,
        amount_to_collect: Math.round(amount * rate * 100) / 100,
        rate,
        has_nexus: !isFailed,
        freight_taxable: false,
        tax_source: isFailed ? '' : 'destination',
        jurisdiction: isFailed ? '' : 'San Francisco',
        breakdown: {
          tax_collectable: Math.round(amount * rate * 100) / 100,
          combined_tax_rate: rate,
          state_tax_rate: 0.06,
          county_tax_rate: 0.01,
          city_tax_rate: 0.01,
          special_district_tax_rate: 0.0075,
        },
      },
    }

    if (isFailed) {
      json(res, 422, { error: 'Unable to calculate tax', detail: 'Invalid address', status: 422 })
      return
    }

    json(res, 200, tax)
  })

  // Tax for order
  service.on('POST', '/v2/taxes/orders', (req, res) => {
    const body = req.json ?? {}
    const transactionId = body.transaction_id ?? `TXN-${Date.now()}`

    const isFailed = failed(transactionId)
    const amount = body.amount ?? 100
    const rate = isFailed ? 0 : 0.0875

    const order = {
      order: {
        transaction_id: transactionId,
        user_id: body.user_id ?? 1,
        transaction_date: body.transaction_date ?? new Date().toISOString().split('T')[0],
        to_country: body.to_country ?? 'US',
        to_zip: body.to_zip ?? '94105',
        to_state: body.to_state ?? 'CA',
        to_city: body.to_city ?? 'San Francisco',
        to_street: body.to_street ?? '123 Main St',
        amount,
        shipping: body.shipping ?? 0,
        line_items: body.line_items ?? [
          {
            id: '1',
            quantity: 1,
            unit_price: 100,
            discount: 0,
            sales_tax: Math.round(100 * 0.0875 * 100) / 100,
          },
        ],
      },
    }

    if (isFailed) {
      json(res, 422, { error: 'Failed to create order', detail: 'Invalid transaction', status: 422 })
      return
    }

    json(res, 200, order)
  })

  // Rates
  service.on('GET', '/v2/rates/:zip', (req, res) => {
    const zip = String(req.params.zip)
    const isFailed = failed(zip)

    if (isFailed) {
      json(res, 404, { error: 'Rate not found', detail: 'Invalid ZIP code', status: 404 })
      return
    }

    const rate = {
      rate: {
        zip,
        country: 'US',
        state: 'CA',
        city: 'San Francisco',
        county: 'San Francisco County',
        combined_rate: 0.0875,
        state_rate: 0.06,
        county_rate: 0.01,
        city_rate: 0.01,
        special_district_rate: 0.0075,
      },
    }

    json(res, 200, rate)
  })

  // Categories
  service.on('GET', '/v2/categories', (req, res) => {
    const categories = {
      categories: [
        { name: 'Clothing', description: 'Clothing and apparel', product_tax_code: '20010' },
        { name: 'Food & Groceries', description: 'Food and grocery items', product_tax_code: '40010' },
        { name: 'Digital Goods', description: 'Digital products and services', product_tax_code: '30010' },
        { name: 'Medical', description: 'Medical products and services', product_tax_code: '50010' },
        { name: 'Software', description: 'Software and SaaS', product_tax_code: '30020' },
      ],
    }

    json(res, 200, categories)
  })

  // Nexus
  service.on('GET', '/v2/nexus', (req, res) => {
    const nexus = {
      nexus: [
        { country: 'US', state: 'CA', has_nexus: true },
        { country: 'US', state: 'NY', has_nexus: true },
        { country: 'US', state: 'TX', has_nexus: false },
      ],
    }

    json(res, 200, nexus)
  })

  // Summary
  service.on('GET', '/v2/summary', (req, res) => {
    const summary = {
      summary: {
        total_orders: 100,
        total_transactions: 150,
        total_tax_collected: 8750.00,
        period: body?.period ?? 'monthly',
      },
    }

    json(res, 200, summary)
  })

  return service
}

/**
 * Vertex.
 *
 * The Vertex Cloud API: tax calculation, address cleansing, and compliance.
 * The shapes match Vertex's API.
 *
 * The reference decides: a transaction with `success` succeeds, `failed` fails.
 */
export function createVertexMock() {
  const service = new MockService('vertex')

  service.state.transactions = new Map()
  service.state.addresses = new Map()

  let transactionId = 1000
  let addressId = 2000

  const nextTransactionId = () => String(transactionId++)
  const nextAddressId = () => String(addressId++)

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'vertex-mock' })
  })

  // OAuth token endpoint
  service.on('POST', '/vertex-oauth/oauth/token', (req, res) => {
    json(res, 200, {
      access_token: 'mock_vertex_token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'mock_refresh_token',
    })
  })

  // Tax calculation
  service.on('POST', '/api/v1/calculatetax', (req, res) => {
    const body = req.json ?? {}
    const invoiceNumber = body.invoice?.number ?? `INV-${nextTransactionId()}`

    const isFailed = failed(invoiceNumber)

    const invoice = body.invoice ?? {}
    const lines = invoice.lines ?? [
      {
        lineNumber: '1',
        quantity: 1,
        unitPrice: 100,
        taxCode: 'P0000000',
        description: 'Test Product',
      },
    ]

    const totalAmount = lines.reduce((sum, line) => sum + (line.unitPrice ?? 100) * (line.quantity ?? 1), 0)
    const totalTax = totalAmount * 0.0875

    const response = {
      invoice: {
        number: invoiceNumber,
        date: invoice.date ?? new Date().toISOString().split('T')[0],
        customerCode: invoice.customerCode ?? 'CUST-001',
        seller: invoice.seller ?? { name: 'Test Seller', address: { line1: '123 Main St', city: 'San Francisco', region: 'CA', postalCode: '94105', country: 'US' } },
        shipTo: invoice.shipTo ?? { line1: '123 Main St', city: 'San Francisco', region: 'CA', postalCode: '94105', country: 'US' },
        lines: lines.map((line, i) => ({
          lineNumber: line.lineNumber ?? String(i + 1),
          quantity: line.quantity ?? 1,
          unitPrice: line.unitPrice ?? 100,
          taxCode: line.taxCode ?? 'P0000000',
          description: line.description ?? 'Test Product',
          tax: Math.round((line.unitPrice ?? 100) * 0.0875 * 100) / 100,
          taxable: true,
        })),
        totalAmount: totalAmount,
        totalTax: isFailed ? 0 : totalTax,
        totalExempt: 0,
        discount: 0,
        status: isFailed ? 'Error' : 'Success',
        taxDate: new Date().toISOString().split('T')[0],
        calculatedDate: new Date().toISOString(),
      },
    }

    if (isFailed) {
      json(res, 400, { error: { code: 'CalculationError', message: 'Failed to calculate tax', details: [] } })
      return
    }

    json(res, 200, response)
  })

  // Address cleansing
  service.on('POST', '/api/v1/cleanseaddress', (req, res) => {
    const body = req.json ?? {}
    const line1 = body.address?.line1 ?? '123 Main St'

    const isFailed = failed(line1)
    const id = `ADDR-${nextAddressId()}`

    const response = {
      address: {
        id,
        line1,
        line2: body.address?.line2 ?? '',
        line3: body.address?.line3 ?? '',
        city: body.address?.city ?? 'San Francisco',
        region: body.address?.region ?? 'CA',
        postalCode: body.address?.postalCode ?? '94105',
        country: body.address?.country ?? 'US',
        latitude: 37.7749,
        longitude: -122.4194,
        confidence: isFailed ? 0.0 : 0.95,
        status: isFailed ? 'Error' : 'Valid',
      },
    }

    if (isFailed) {
      json(res, 400, { error: { code: 'AddressError', message: 'Failed to cleanse address', details: [] } })
      return
    }

    json(res, 200, response)
  })

  // Tax codes
  service.on('GET', '/api/v1/taxcodes', (req, res) => {
    const taxCodes = {
      taxCodes: [
        { code: 'P0000000', description: 'General Tangible Personal Property', type: 'Sales' },
        { code: 'P0000100', description: 'Clothing', type: 'Sales' },
        { code: 'P0000200', description: 'Food & Groceries', type: 'Sales' },
        { code: 'P0000300', description: 'Medical', type: 'Sales' },
        { code: 'P0000400', description: 'Software', type: 'Sales' },
        { code: 'FR000000', description: 'Freight', type: 'Sales' },
        { code: 'DC000000', description: 'Discount', type: 'Sales' },
      ],
    }

    json(res, 200, taxCodes)
  })

  return service
}
