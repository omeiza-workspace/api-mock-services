import { MockService, json, counter } from '../harness.js'

/**
 * QuickBooks.
 *
 * The QuickBooks Online API: customers, invoices, payments, and accounts.
 * The shapes match QuickBooks' API.
 *
 * The reference decides: a customer with `success` succeeds, `failed` fails.
 */
export function createQuickBooksMock() {
  const service = new MockService('quickbooks')

  service.state.customers = new Map()
  service.state.invoices = new Map()
  service.state.payments = new Map()
  service.state.accounts = new Map()

  let customerId = 1000
  let invoiceId = 2000
  let paymentId = 3000
  let accountId = 4000

  const nextCustomerId = () => String(customerId++)
  const nextInvoiceId = () => String(invoiceId++)
  const nextPaymentId = () => String(paymentId++)
  const nextAccountId = () => String(accountId++)

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'quickbooks-mock' })
  })

  // OAuth token endpoint
  service.on('POST', '/oauth2/v1/tokens/bearer', (req, res) => {
    json(res, 200, {
      access_token: 'mock_quickbooks_token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock_refresh_token',
      x_refresh_token_expires_in: 8726400,
    })
  })

  // Customers
  service.on('POST', '/v3/company/:realmId/customer', (req, res) => {
    const body = req.json ?? {}
    const displayName = body.DisplayName

    if (!displayName) {
      json(res, 400, { Fault: { Error: [{ Message: 'DisplayName is required', code: '2000', element: 'DisplayName' }], type: 'ValidationFault' } })
      return
    }

    const isFailed = failed(displayName)
    const id = nextCustomerId()

    const customer = {
      Id: id,
      SyncToken: '0',
      MetaData: {
        CreateTime: new Date().toISOString(),
        LastUpdatedTime: new Date().toISOString(),
      },
      DisplayName: displayName,
      FullyQualifiedName: displayName,
      CompanyName: body.CompanyName ?? '',
      PrimaryPhone: body.PrimaryPhone ?? { FreeFormNumber: '555-1234' },
      PrimaryEmailAddr: body.PrimaryEmailAddr ?? { Address: 'customer@example.com' },
      BillAddr: body.BillAddr ?? { Line1: '123 Main St', City: 'San Francisco', CountrySubDivisionCode: 'CA', PostalCode: '94105', Country: 'US' },
      ShipAddr: body.ShipAddr ?? { Line1: '123 Main St', City: 'San Francisco', CountrySubDivisionCode: 'CA', PostalCode: '94105', Country: 'US' },
      Active: !isFailed,
      Taxable: true,
      Job: false,
      BillWithParent: false,
      Balance: 0,
      BalanceWithJobs: 0,
      CurrencyRef: { value: 'USD', name: 'United States Dollar' },
      PreferredDeliveryMethod: 'Email',
      domain: 'QBO',
      sparse: false,
    }

    service.state.customers.set(id, customer)

    if (isFailed) {
      json(res, 400, { Fault: { Error: [{ Message: 'Failed to create customer', code: '2000', element: 'DisplayName' }], type: 'ValidationFault' } })
      return
    }

    json(res, 200, { Customer: customer, time: new Date().toISOString() })
  })

  service.on('GET', '/v3/company/:realmId/customer/:id', (req, res) => {
    const id = String(req.params.id)
    const customer = service.state.customers.get(id)

    if (!customer) {
      json(res, 404, { Fault: { Error: [{ Message: 'Customer not found', code: '610', element: '' }], type: 'NotFoundFault' } })
      return
    }

    json(res, 200, { Customer: customer, time: new Date().toISOString() })
  })

  service.on('GET', '/v3/company/:realmId/query', (req, res) => {
    const query = String(req.query.query ?? '')
    const isFailed = failed(query)

    if (isFailed) {
      json(res, 200, { QueryResponse: { Customer: [], Invoice: [], Payment: [], Account: [] }, time: new Date().toISOString() })
      return
    }

    const entity = query.match(/FROM\s+(\w+)/i)?.[1] ?? 'Customer'
    let results = []

    switch (entity) {
      case 'Customer':
        results = [...service.state.customers.values()]
        break
      case 'Invoice':
        results = [...service.state.invoices.values()]
        break
      case 'Payment':
        results = [...service.state.payments.values()]
        break
      case 'Account':
        results = [...service.state.accounts.values()]
        break
    }

    json(res, 200, { QueryResponse: { [entity]: results }, time: new Date().toISOString() })
  })

  // Invoices
  service.on('POST', '/v3/company/:realmId/invoice', (req, res) => {
    const body = req.json ?? {}
    const customerRef = body.CustomerRef?.value

    if (!customerRef) {
      json(res, 400, { Fault: { Error: [{ Message: 'CustomerRef is required', code: '2000', element: 'CustomerRef' }], type: 'ValidationFault' } })
      return
    }

    const isFailed = failed(customerRef)
    const id = nextInvoiceId()

    const invoice = {
      Id: id,
      SyncToken: '0',
      MetaData: {
        CreateTime: new Date().toISOString(),
        LastUpdatedTime: new Date().toISOString(),
      },
      DocNumber: `INV-${id}`,
      CustomerRef: { value: customerRef },
      CustomerMemo: { value: body.CustomerMemo?.value ?? 'Thank you for your business!' },
      BillEmail: body.BillEmail ?? { Address: 'customer@example.com' },
      BillAddr: body.BillAddr ?? { Line1: '123 Main St', City: 'San Francisco', CountrySubDivisionCode: 'CA', PostalCode: '94105', Country: 'US' },
      ShipAddr: body.ShipAddr ?? { Line1: '123 Main St', City: 'San Francisco', CountrySubDivisionCode: 'CA', PostalCode: '94105', Country: 'US' },
      DueDate: body.DueDate ?? new Date(Date.now() + 2592000000).toISOString().split('T')[0],
      TotalAmt: body.TotalAmt ?? '100.00',
      ApplyTaxAfterDiscount: false,
      PrintStatus: 'NotSet',
      EmailStatus: 'NotSet',
      Balance: isFailed ? '100.00' : '0.00',
      Deposit: 0,
      AllowIPNPayment: false,
      AllowOnlinePayment: true,
      AllowOnlineCreditCardPayment: true,
      AllowOnlineACHPayment: true,
      domain: 'QBO',
      sparse: false,
      Line: body.Line ?? [
        {
          Id: '1',
          LineNum: 1,
          Description: 'Test Service',
          Amount: '100.00',
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            ItemRef: { value: '1', name: 'Services' },
            UnitPrice: '100.00',
            Qty: 1,
          },
        },
      ],
    }

    service.state.invoices.set(id, invoice)

    if (isFailed) {
      json(res, 400, { Fault: { Error: [{ Message: 'Failed to create invoice', code: '2000', element: 'CustomerRef' }], type: 'ValidationFault' } })
      return
    }

    json(res, 200, { Invoice: invoice, time: new Date().toISOString() })
  })

  // Payments
  service.on('POST', '/v3/company/:realmId/payment', (req, res) => {
    const body = req.json ?? {}
    const customerRef = body.CustomerRef?.value
    const totalAmt = body.TotalAmt ?? '100.00'

    if (!customerRef) {
      json(res, 400, { Fault: { Error: [{ Message: 'CustomerRef is required', code: '2000', element: 'CustomerRef' }], type: 'ValidationFault' } })
      return
    }

    const isFailed = failed(customerRef)
    const id = nextPaymentId()

    const payment = {
      Id: id,
      SyncToken: '0',
      MetaData: {
        CreateTime: new Date().toISOString(),
        LastUpdatedTime: new Date().toISOString(),
      },
      TotalAmt: totalAmt,
      CustomerRef: { value: customerRef },
      PaymentRefNum: `PMT-${id}`,
      PaymentMethodRef: { value: '1', name: 'Cash' },
      DepositToAccountRef: { value: '1', name: 'Checking' },
      UnappliedAmt: isFailed ? totalAmt : '0.00',
      ProcessPayment: !isFailed,
      domain: 'QBO',
      sparse: false,
      Line: body.Line ?? [
        {
          Amount: totalAmt,
          LinkedTxn: [{ TxnId: body.Line?.[0]?.LinkedTxn?.[0]?.TxnId ?? '1', TxnType: 'Invoice' }],
        },
      ],
    }

    service.state.payments.set(id, payment)

    if (isFailed) {
      json(res, 400, { Fault: { Error: [{ Message: 'Failed to create payment', code: '2000', element: 'CustomerRef' }], type: 'ValidationFault' } })
      return
    }

    json(res, 200, { Payment: payment, time: new Date().toISOString() })
  })

  // Accounts
  service.on('POST', '/v3/company/:realmId/account', (req, res) => {
    const body = req.json ?? {}
    const name = body.Name

    if (!name) {
      json(res, 400, { Fault: { Error: [{ Message: 'Name is required', code: '2000', element: 'Name' }], type: 'ValidationFault' } })
      return
    }

    const isFailed = failed(name)
    const id = nextAccountId()

    const account = {
      Id: id,
      SyncToken: '0',
      MetaData: {
        CreateTime: new Date().toISOString(),
        LastUpdatedTime: new Date().toISOString(),
      },
      Name: name,
      SubAccount: false,
      FullyQualifiedName: name,
      Active: !isFailed,
      Classification: body.Classification ?? 'Asset',
      AccountType: body.AccountType ?? 'Bank',
      AccountSubType: body.AccountSubType ?? 'Checking',
      CurrentBalance: 0,
      CurrentBalanceWithSubAccounts: 0,
      CurrencyRef: { value: 'USD', name: 'United States Dollar' },
      domain: 'QBO',
      sparse: false,
    }

    service.state.accounts.set(id, account)

    if (isFailed) {
      json(res, 400, { Fault: { Error: [{ Message: 'Failed to create account', code: '2000', element: 'Name' }], type: 'ValidationFault' } })
      return
    }

    json(res, 200, { Account: account, time: new Date().toISOString() })
  })

  return service
}

/**
 * NetSuite.
 *
 * The NetSuite SuiteTalk REST API: records, search, and file cabinet.
 * The shapes match NetSuite's API.
 *
 * The reference decides: a record with `success` succeeds, `failed` fails.
 */
export function createNetSuiteMock() {
  const service = new MockService('netsuite')

  service.state.customers = new Map()
  service.state.salesOrders = new Map()
  service.state.items = new Map()
  service.state.invoices = new Map()

  let customerId = 1000
  let salesOrderId = 2000
  let itemId = 3000
  let invoiceId = 4000

  const nextCustomerId = () => String(customerId++)
  const nextSalesOrderId = () => String(salesOrderId++)
  const nextItemId = () => String(itemId++)
  const nextInvoiceId = () => String(invoiceId++)

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'netsuite-mock' })
  })

  // OAuth token endpoint
  service.on('POST', '/services/rest/auth/oauth2/v1/token', (req, res) => {
    json(res, 200, {
      access_token: 'mock_netsuite_token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'restlets suite_talk rest_webservices',
    })
  })

  // Customers
  service.on('POST', '/services/rest/record/v1/customer', (req, res) => {
    const body = req.json ?? {}
    const entityId = body.entityId ?? body.companyName

    if (!entityId) {
      json(res, 400, { type: 'https://www.netsuite.com/errors/400', title: 'Bad Request', status: 400, detail: 'entityId is required', 'o:errorDetails': [] })
      return
    }

    const isFailed = failed(entityId)
    const id = nextCustomerId()

    const customer = {
      id,
      entityId,
      companyName: body.companyName ?? '',
      firstName: body.firstName ?? '',
      lastName: body.lastName ?? '',
      email: body.email ?? 'customer@example.com',
      phone: body.phone ?? '555-1234',
      addressbook: body.addressbook ?? [
        {
          addr1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105',
          country: 'US',
          defaultBilling: true,
          defaultShipping: true,
        },
      ],
      isPerson: body.isPerson ?? false,
      subsidiary: { id: '1', ref: '/services/rest/record/v1/subsidiary/1' },
      currency: { id: '1', ref: '/services/rest/record/v1/currency/1' },
      createdDate: new Date().toISOString(),
      lastModifiedDate: new Date().toISOString(),
    }

    service.state.customers.set(id, customer)

    if (isFailed) {
      json(res, 400, { type: 'https://www.netsuite.com/errors/400', title: 'Bad Request', status: 400, detail: 'Failed to create customer', 'o:errorDetails': [] })
      return
    }

    json(res, 201, customer)
  })

  service.on('GET', '/services/rest/record/v1/customer/:id', (req, res) => {
    const id = String(req.params.id)
    const customer = service.state.customers.get(id)

    if (!customer) {
      json(res, 404, { type: 'https://www.netsuite.com/errors/404', title: 'Not Found', status: 404, detail: 'Customer not found', 'o:errorDetails': [] })
      return
    }

    json(res, 200, customer)
  })

  // Sales Orders
  service.on('POST', '/services/rest/record/v1/salesOrder', (req, res) => {
    const body = req.json ?? {}
    const entityId = body.entityId ?? `SO-${nextSalesOrderId()}`
    const customerRef = body.entity?.id

    if (!customerRef) {
      json(res, 400, { type: 'https://www.netsuite.com/errors/400', title: 'Bad Request', status: 400, detail: 'entity.customer is required', 'o:errorDetails': [] })
      return
    }

    const isFailed = failed(entityId)
    const id = nextSalesOrderId()

    const salesOrder = {
      id,
      tranId: entityId,
      entity: { id: customerRef, ref: `/services/rest/record/v1/customer/${customerRef}` },
      tranDate: body.tranDate ?? new Date().toISOString().split('T')[0],
      memo: body.memo ?? '',
      status: isFailed ? 'Pending Fulfillment' : 'Pending Approval',
      total: body.total ?? '100.00',
      currency: { id: '1', ref: '/services/rest/record/v1/currency/1' },
      item: body.item ?? [
        {
          item: { id: '1', ref: '/services/rest/record/v1/inventoryItem/1' },
          quantity: 1,
          rate: '100.00',
          amount: '100.00',
        },
      ],
      createdDate: new Date().toISOString(),
      lastModifiedDate: new Date().toISOString(),
    }

    service.state.salesOrders.set(id, salesOrder)

    if (isFailed) {
      json(res, 400, { type: 'https://www.netsuite.com/errors/400', title: 'Bad Request', status: 400, detail: 'Failed to create sales order', 'o:errorDetails': [] })
      return
    }

    json(res, 201, salesOrder)
  })

  service.on('GET', '/services/rest/record/v1/salesOrder/:id', (req, res) => {
    const id = String(req.params.id)
    const salesOrder = service.state.salesOrders.get(id)

    if (!salesOrder) {
      json(res, 404, { type: 'https://www.netsuite.com/errors/404', title: 'Not Found', status: 404, detail: 'Sales Order not found', 'o:errorDetails': [] })
      return
    }

    json(res, 200, salesOrder)
  })

  // Items
  service.on('POST', '/services/rest/record/v1/inventoryItem', (req, res) => {
    const body = req.json ?? {}
    const itemId = body.itemId ?? `ITEM-${nextItemId()}`

    const isFailed = failed(itemId)
    const id = nextItemId()

    const item = {
      id,
      itemId,
      displayName: body.displayName ?? `Item ${itemId}`,
      type: { id: 'InvtPart', ref: '/services/rest/record/v1/itemType/InvtPart' },
      basePrice: body.basePrice ?? '100.00',
      salesDescription: body.salesDescription ?? '',
      purchaseDescription: body.purchaseDescription ?? '',
      cost: body.cost ?? '50.00',
      weight: body.weight ?? '1',
      weightUnit: { id: '1', ref: '/services/rest/record/v1/weightUnit/1' },
      subsidiary: { id: '1', ref: '/services/rest/record/v1/subsidiary/1' },
      createdDate: new Date().toISOString(),
      lastModifiedDate: new Date().toISOString(),
    }

    service.state.items.set(id, item)

    if (isFailed) {
      json(res, 400, { type: 'https://www.netsuite.com/errors/400', title: 'Bad Request', status: 400, detail: 'Failed to create item', 'o:errorDetails': [] })
      return
    }

    json(res, 201, item)
  })

  // Invoices
  service.on('POST', '/services/rest/record/v1/invoice', (req, res) => {
    const body = req.json ?? {}
    const entityId = body.entityId ?? `INV-${nextInvoiceId()}`
    const customerRef = body.entity?.id

    if (!customerRef) {
      json(res, 400, { type: 'https://www.netsuite.com/errors/400', title: 'Bad Request', status: 400, detail: 'entity.customer is required', 'o:errorDetails': [] })
      return
    }

    const isFailed = failed(entityId)
    const id = nextInvoiceId()

    const invoice = {
      id,
      tranId: entityId,
      entity: { id: customerRef, ref: `/services/rest/record/v1/customer/${customerRef}` },
      tranDate: body.tranDate ?? new Date().toISOString().split('T')[0],
      memo: body.memo ?? '',
      status: isFailed ? 'Open' : 'Paid In Full',
      total: body.total ?? '100.00',
      currency: { id: '1', ref: '/services/rest/record/v1/currency/1' },
      item: body.item ?? [
        {
          item: { id: '1', ref: '/services/rest/record/v1/inventoryItem/1' },
          quantity: 1,
          rate: '100.00',
          amount: '100.00',
        },
      ],
      createdDate: new Date().toISOString(),
      lastModifiedDate: new Date().toISOString(),
    }

    service.state.invoices.set(id, invoice)

    if (isFailed) {
      json(res, 400, { type: 'https://www.netsuite.com/errors/400', title: 'Bad Request', status: 400, detail: 'Failed to create invoice', 'o:errorDetails': [] })
      return
    }

    json(res, 201, invoice)
  })

  return service
}

/**
 * Sage.
 *
 * The Sage Intacct API: customers, invoices, payments, and GL entries.
 * The shapes match Sage's API.
 *
 * The reference decides: a customer with `success` succeeds, `failed` fails.
 */
export function createSageMock() {
  const service = new MockService('sage')

  service.state.customers = new Map()
  service.state.invoices = new Map()
  service.state.payments = new Map()
  service.state.glEntries = new Map()

  let customerId = 1000
  let invoiceId = 2000
  let paymentId = 3000
  let glEntryId = 4000

  const nextCustomerId = () => String(customerId++)
  const nextInvoiceId = () => String(invoiceId++)
  const nextPaymentId = () => String(paymentId++)
  const nextGlEntryId = () => String(glEntryId++)

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'sage-mock' })
  })

  // Authentication
  service.on('POST', '/api/auth/token', (req, res) => {
    json(res, 200, {
      access_token: 'mock_sage_token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'mock_refresh_token',
    })
  })

  // Customers
  service.on('POST', '/api/v1/customers', (req, res) => {
    const body = req.json ?? {}
    const name = body.name

    if (!name) {
      json(res, 400, { errors: [{ code: 'VALIDATION_ERROR', message: 'name is required', field: 'name' }] })
      return
    }

    const isFailed = failed(name)
    const id = nextCustomerId()

    const customer = {
      id,
      name,
      display_name: name,
      email: body.email ?? 'customer@example.com',
      phone: body.phone ?? '555-1234',
      billing_address: body.billing_address ?? {
        line1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postal_code: '94105',
        country: 'US',
      },
      shipping_address: body.shipping_address ?? {
        line1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postal_code: '94105',
        country: 'US',
      },
      status: isFailed ? 'inactive' : 'active',
      currency: body.currency ?? 'USD',
      payment_terms: body.payment_terms ?? 'NET30',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    service.state.customers.set(id, customer)

    if (isFailed) {
      json(res, 400, { errors: [{ code: 'VALIDATION_ERROR', message: 'Failed to create customer', field: 'name' }] })
      return
    }

    json(res, 201, customer)
  })

  service.on('GET', '/api/v1/customers', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const customers = [...service.state.customers.values()].slice(0, limit)
    json(res, 200, { data: customers, meta: { total: customers.length, limit } })
  })

  service.on('GET', '/api/v1/customers/:id', (req, res) => {
    const id = String(req.params.id)
    const customer = service.state.customers.get(id)

    if (!customer) {
      json(res, 404, { errors: [{ code: 'NOT_FOUND', message: 'Customer not found' }] })
      return
    }

    json(res, 200, customer)
  })

  // Invoices
  service.on('POST', '/api/v1/invoices', (req, res) => {
    const body = req.json ?? {}
    const customerId = body.customer_id

    if (!customerId) {
      json(res, 400, { errors: [{ code: 'VALIDATION_ERROR', message: 'customer_id is required', field: 'customer_id' }] })
      return
    }

    const isFailed = failed(customerId)
    const id = nextInvoiceId()

    const invoice = {
      id,
      invoice_number: `INV-${id}`,
      customer_id: customerId,
      date: body.date ?? new Date().toISOString().split('T')[0],
      due_date: body.due_date ?? new Date(Date.now() + 2592000000).toISOString().split('T')[0],
      status: isFailed ? 'draft' : 'sent',
      total_amount: body.total_amount ?? '100.00',
      currency: body.currency ?? 'USD',
      line_items: body.line_items ?? [
        {
          description: 'Test Service',
          quantity: 1,
          unit_price: '100.00',
          total: '100.00',
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    service.state.invoices.set(id, invoice)

    if (isFailed) {
      json(res, 400, { errors: [{ code: 'VALIDATION_ERROR', message: 'Failed to create invoice', field: 'customer_id' }] })
      return
    }

    json(res, 201, invoice)
  })

  service.on('GET', '/api/v1/invoices/:id', (req, res) => {
    const id = String(req.params.id)
    const invoice = service.state.invoices.get(id)

    if (!invoice) {
      json(res, 404, { errors: [{ code: 'NOT_FOUND', message: 'Invoice not found' }] })
      return
    }

    json(res, 200, invoice)
  })

  // Payments
  service.on('POST', '/api/v1/payments', (req, res) => {
    const body = req.json ?? {}
    const customerId = body.customer_id
    const amount = body.amount ?? '100.00'

    if (!customerId) {
      json(res, 400, { errors: [{ code: 'VALIDATION_ERROR', message: 'customer_id is required', field: 'customer_id' }] })
      return
    }

    const isFailed = failed(customerId)
    const id = nextPaymentId()

    const payment = {
      id,
      customer_id: customerId,
      amount,
      currency: body.currency ?? 'USD',
      payment_method: body.payment_method ?? 'credit_card',
      status: isFailed ? 'failed' : 'completed',
      reference: body.reference ?? `PMT-${id}`,
      date: body.date ?? new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    service.state.payments.set(id, payment)

    if (isFailed) {
      json(res, 400, { errors: [{ code: 'VALIDATION_ERROR', message: 'Failed to create payment', field: 'customer_id' }] })
      return
    }

    json(res, 201, payment)
  })

  // GL Entries
  service.on('POST', '/api/v1/gl-entries', (req, res) => {
    const body = req.json ?? {}
    const description = body.description

    if (!description) {
      json(res, 400, { errors: [{ code: 'VALIDATION_ERROR', message: 'description is required', field: 'description' }] })
      return
    }

    const isFailed = failed(description)
    const id = nextGlEntryId()

    const glEntry = {
      id,
      date: body.date ?? new Date().toISOString().split('T')[0],
      description,
      reference: body.reference ?? `JE-${id}`,
      lines: body.lines ?? [
        {
          account_id: body.lines?.[0]?.account_id ?? '1000',
          debit: body.lines?.[0]?.debit ?? '100.00',
          credit: body.lines?.[0]?.credit ?? '0.00',
        },
        {
          account_id: body.lines?.[1]?.account_id ?? '2000',
          debit: body.lines?.[1]?.debit ?? '0.00',
          credit: body.lines?.[1]?.credit ?? '100.00',
        },
      ],
      status: isFailed ? 'draft' : 'posted',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    service.state.glEntries.set(id, glEntry)

    if (isFailed) {
      json(res, 400, { errors: [{ code: 'VALIDATION_ERROR', message: 'Failed to create GL entry', field: 'description' }] })
      return
    }

    json(res, 201, glEntry)
  })

  return service
}
