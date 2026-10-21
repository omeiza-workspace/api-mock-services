import { MockService, json, counter } from '../harness.js'

/**
 * The Nigerian gateways that are not Paystack.
 *
 * Flutterwave and Monnify are the two an app in Nigeria meets next: one for
 * cards and transfers, one for bank accounts — including the reserved
 * virtual account, which is the flow Monnify is used for.
 *
 * The shapes are the real ones: the same fields, the same status codes and
 * the same meaning.
 */

/**
 * Flutterwave.
 *
 * A payment is started and a hosted link is given; the link is where a
 * person pays; the transaction is then verified by its reference. The
 * statuses are Flutterwave's own — `successful`, `failed`, `cancelled`.
 */
export function createFlutterwaveMock() {
  const service = new MockService('flutterwave')

  service.state.transactions = new Map()

  const nextId = counter('flw')
  const nextReference = counter('FLW')

  service.on('POST', '/v3/payments', (req, res) => {
    const body = req.json ?? {}
    const reference = body.tx_ref || `FLW-${Date.now()}-${nextReference()}`

    const transaction = {
      id: nextId(),
      tx_ref: reference,
      amount: Number(body.amount ?? 0),
      currency: String(body.currency ?? 'NGN').toUpperCase(),
      status: 'pending',
      outcome: null,
      customer: {
        email: body.customer?.email ?? body.email ?? null,
        name: body.customer?.name ?? body.name ?? null,
        phone_number: body.customer?.phone_number ?? null,
      },
      redirect_url: body.redirect_url ?? null,
      meta: body.meta ?? null,
      created_at: new Date().toISOString(),
    }

    service.state.transactions.set(reference, transaction)

    json(res, 200, {
      status: 'success',
      message: 'Hosted Link created',
      data: {
        link: `http://localhost:4010/checkout/${reference}`,
        id: transaction.id,
        tx_ref: reference,
        amount: transaction.amount,
        currency: transaction.currency,
        customer: transaction.customer,
      },
    })
  })

  service.on('GET', '/v3/transactions/:tx_ref/verify', (req, res) => {
    const reference = String(req.params.tx_ref)
    const transaction = service.state.transactions.get(reference)

    if (!transaction) {
      json(res, 404, { status: 'error', message: 'Transaction not found' })
      return
    }

    // How it went: what the checkout said, or what the reference says.
    const outcome =
      transaction.outcome ??
      (reference.includes('success')
        ? 'success'
        : reference.includes('failed')
          ? 'failed'
          : null)

    const status =
      outcome === 'success'
        ? 'successful'
        : outcome === 'failed'
          ? 'failed'
          : outcome === 'cancelled'
            ? 'cancelled'
            : 'pending'

    transaction.status = status
    service.state.transactions.set(reference, transaction)

    json(res, 200, {
      status: 'success',
      message: 'Transaction fetched successfully',
      data: {
        id: transaction.id,
        tx_ref: transaction.tx_ref,
        flw_ref: `FLW-MOCK-${transaction.tx_ref}`,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        customer: transaction.customer,
        created_at: transaction.created_at,
      },
    })
  })

  service.on('POST', '/v3/transfers', (req, res) => {
    const body = req.json ?? {}

    json(res, 200, {
      status: 'success',
      message: 'Transfer queued',
      data: {
        id: nextId(),
        tx_ref: body.tx_ref ?? `FLT-${Date.now()}-${nextReference()}`,
        amount: Number(body.amount ?? 0),
        currency: String(body.currency ?? 'NGN').toUpperCase(),
        status: 'pending',
        bank_code: body.bank_code ?? null,
        account_number: body.account_number ?? null,
        narration: body.narration ?? null,
      },
    })
  })

  // The checkout a person uses to pay. The browser layer mounts it.
  service.checkout = {
    title: 'Flutterwave (mock)',
    find: (reference) => {
      const transaction = service.state.transactions.get(reference)

      return transaction
        ? {
            reference,
            amount: `${(transaction.amount / 100).toFixed(2)}`,
            merchant: 'The shop',
          }
        : null
    },
    onDone: (reference, outcome) => {
      const transaction = service.state.transactions.get(reference)

      if (transaction) transaction.outcome = outcome
    },
  }

  return service
}

/**
 * Monnify.
 *
 * The reserved account is the point of Monnify: a virtual account number is
 * given to the customer, money is paid into it, and the transaction is
 * confirmed. The transaction API is the other half.
 */
export function createMonnifyMock() {
  const service = new MockService('monnify')

  service.state.accounts = new Map()
  service.state.transactions = new Map()

  const nextAccount = counter('acct')
  const nextTransaction = counter('txn')

  service.on('POST', '/api/v1/accounts', (req, res) => {
    const body = req.json ?? {}

    if (!body.accountName) {
      json(res, 400, {
        response_code: 'MISSING_REQUIRED_PARAMETERS',
        response_message: 'accountName is required',
        data: null,
      })
      return
    }

    const reference = body.accountReference ?? `ref_${nextAccount()}`

    const account = {
      account_number: `70${nextAccount()}${String(Date.now()).slice(-6)}`,
      account_name: body.accountName,
      bank_name: 'Providus Bank',
      bank_id: '140',
      account_reference: reference,
      currency: body.currency ?? 'NGN',
      account_status: 'ACTIVE',
      account_type: 'RESERVED',
      reserved_account_type: { Bank: 'Providus Bank', Scheme: 'ACCOUNT' },
      created_at: new Date().toISOString(),
      reason: 'Account reserved successfully',
    }

    service.state.accounts.set(reference, account)

    json(res, 200, {
      response_code: 'SUCCESS',
      response_message: 'Account Reserved Successfully',
      data: { reserved_account: account },
    })
  })

  service.on('GET', '/api/v1/accounts/:accountReference', (req, res) => {
    const account = service.state.accounts.get(String(req.params.accountReference))

    if (!account) {
      json(res, 404, {
        response_code: 'ACCOUNT_NOT_FOUND',
        response_message: 'Account not found',
        data: null,
      })
      return
    }

    json(res, 200, {
      response_code: 'SUCCESS',
      response_message: 'Account retrieved successfully',
      data: { reserved_account: account },
    })
  })

  service.on('POST', '/api/v1/transactions', (req, res) => {
    const body = req.json ?? {}
    const reference = body.reference ?? `trx_${nextTransaction()}`

    const transaction = {
      transaction_id: `${nextTransaction()}`,
      reference,
      account_reference: body.accountReference ?? null,
      amount: Number(body.amount ?? 0),
      currency: body.currency ?? 'NGN',
      status: 'INITIATED',
      outcome: null,
      narration: body.narration ?? null,
      created_at: new Date().toISOString(),
    }

    service.state.transactions.set(reference, transaction)

    json(res, 200, {
      response_code: 'SUCCESS',
      response_message: 'Transaction created successfully',
      data: {
        transaction_id: transaction.transaction_id,
        reference: transaction.reference,
        account_reference: transaction.account_reference,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
      },
    })
  })

  service.on('GET', '/api/v1/transactions/:reference', (req, res) => {
    const reference = String(req.params.reference)
    const transaction = service.state.transactions.get(reference)

    if (!transaction) {
      json(res, 404, {
        response_code: 'TRANSACTION_NOT_FOUND',
        response_message: 'Transaction not found',
        data: null,
      })
      return
    }

    // How it went: what the checkout said, or what the reference says.
    const outcome =
      transaction.outcome ??
      (reference.includes('success')
        ? 'success'
        : reference.includes('failed')
          ? 'failed'
          : null)

    transaction.status =
      outcome === 'success' ? 'SUCCESS' : outcome === 'failed' ? 'FAILED' : 'INITIATED'

    service.state.transactions.set(reference, transaction)

    json(res, 200, {
      response_code: 'SUCCESS',
      response_message: 'Transaction details retrieved successfully',
      data: {
        transaction_id: transaction.transaction_id,
        reference: transaction.reference,
        account_reference: transaction.account_reference,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        narration: transaction.narration,
        created_at: transaction.created_at,
      },
    })
  })

  return service
}
