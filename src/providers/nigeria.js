import { MockService, json, counter } from '../harness.js'

/**
 * The Nigerian payment gateways and the identity provider.
 *
 * The shapes are the real ones — the same fields, the same status codes and
 * the same meaning — so the code that talks to them does not change when it
 * is pointed at a mock.
 */

/**
 * Paystack.
 *
 * Initialising a transaction gives a reference and an access code; verifying
 * it says whether the money moved. A reference with "success" in it is
 * successful, one with "failed" in it is not — so a test can ask for either.
 */
export function createPaystackMock() {
  const service = new MockService('paystack')

  service.state.transactions = new Map()

  const nextReference = counter('ref')
  const nextAccess = counter('acc')

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy' })
  })

  service.on('POST', '/transaction/initialize', (req, res) => {
    const body = req.json ?? {}
    const reference = body.reference || `ref_${Date.now()}_${nextReference()}`
    const accessCode = `acc_${Date.now()}_${nextAccess()}`

    const transaction = {
      reference,
      access_code: accessCode,
      authorization_url: `http://localhost:5001/checkout/${accessCode}`,
      email: body.email,
      amount: body.amount || 10000,
      currency: 'NGN',
      status: 'pending',
      outcome: null,
      metadata: body.metadata,
      created_at: new Date().toISOString(),
    }

    service.state.transactions.set(reference, transaction)

    json(res, 200, {
      status: true,
      message: 'Authorization URL created',
      data: {
        authorization_url: transaction.authorization_url,
        access_code: accessCode,
        reference,
      },
    })
  })

  service.on('GET', '/transaction/verify/:reference', (req, res) => {
    const reference = String(req.params.reference)
    const transaction = service.state.transactions.get(reference)

    if (!transaction) {
      json(res, 404, {
        status: false,
        message: 'Transaction not found',
        data: null,
      })
      return
    }

    // How the payment went: what the checkout said, or — when there was
    // no checkout — what the reference says.
    const outcome =
      transaction.outcome ??
      (reference.includes('success')
        ? 'success'
        : reference.includes('failed')
          ? 'failed'
          : null)

    let status = transaction.status
    let gatewayResponse = 'Successful'

    if (outcome === 'success') {
      status = 'success'
    } else if (outcome === 'failed' || outcome === 'cancelled') {
      status = outcome
      gatewayResponse = outcome === 'failed' ? 'Transaction failed' : 'Transaction cancelled'
    }

    transaction.status = status
    service.state.transactions.set(reference, transaction)

    json(res, 200, {
      status: true,
      message: 'Verification successful',
      data: {
        id: service.state.transactions.size,
        reference: transaction.reference,
        amount: transaction.amount,
        status,
        gateway_response: gatewayResponse,
        paid_at: new Date().toISOString(),
        channel: 'card',
        currency: transaction.currency,
        customer: { email: transaction.email },
        metadata: transaction.metadata,
      },
    })
  })

  service.on('POST', '/transaction/charge_authorization', (req, res) => {
    const body = req.json ?? {}
    const reference = body.reference || `rec_${Date.now()}_${nextReference()}`

    const transaction = {
      reference,
      authorization_code: body.authorization_code,
      email: body.email,
      amount: body.amount || 10000,
      currency: 'NGN',
      status: 'success',
      created_at: new Date().toISOString(),
    }

    service.state.transactions.set(reference, transaction)

    json(res, 200, {
      status: true,
      message: 'Charge successful',
      data: {
        reference,
        status: 'success',
        amount: transaction.amount,
        gateway_response: 'Successful',
        paid_at: new Date().toISOString(),
        channel: 'card',
        currency: transaction.currency,
        customer: { email: body.email },
      },
    })
  })

  service.on('POST', '/transferrecipient', (req, res) => {
    const body = req.json ?? {}

    json(res, 200, {
      status: true,
      message: 'Transfer recipient created successfully',
      data: {
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: body.type,
        is_deleted: false,
        domain: 'test',
        integration: 12345,
        id: service.state.transactions.size + 1,
        name: body.name,
        description: null,
        currency: body.currency || 'NGN',
        account_number: body.account_number,
        bank_code: body.bank_code,
        bank_name: 'Test Bank',
        recipient_code: `rcp_${Date.now()}_${nextReference()}`,
        metadata: null,
      },
    })
  })

  service.on('POST', '/transfer', (req, res) => {
    const body = req.json ?? {}
    const transferCode = `trf_${Date.now()}_${nextReference()}`

    json(res, 200, {
      status: true,
      message: 'Transfer has been queued successfully',
      data: {
        transfer_code: transferCode,
        reference: body.reference || transferCode,
        amount: body.amount,
        status: 'pending',
        currency: 'NGN',
        recipient: {
          account_number: body.recipient?.account_number,
          bank_code: body.recipient?.bank_code,
          name: body.recipient?.name,
        },
        reason: body.reason,
      },
    })
  })

  service.on('POST', '/transfer/finalize', (req, res) => {
    json(res, 200, {
      status: true,
      message: 'Transfer has been finalized successfully',
      data: {
        transfer_code: req.json?.transfer_code,
        status: 'success',
        amount: 10000,
        reference: 'ref_123456',
      },
    })
  })

  // The checkout a person uses to pay. The browser layer mounts it.
  service.checkout = {
    title: 'Paystack (mock)',
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

  service.on('GET', '/bank', (req, res) => {
    json(res, 200, {
      status: true,
      message: 'Banks retrieved',
      data: [
        { name: 'Test Bank', code: '001', slug: 'test-bank' },
        { name: 'Another Bank', code: '002', slug: 'another-bank' },
      ],
    })
  })

  return service
}

/**
 * Interswitch.
 *
 * A payment is started, then the card is put in, then the status is asked
 * for. The card number decides the outcome: one starting with 4 succeeds,
 * one starting with 6 fails.
 */
export function createInterswitchMock() {
  const service = new MockService('interswitch')

  service.state.transactions = new Map()

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'interswitch-mock' })
  })

  service.on('POST', '/paydirect/api/v1/payment/init', (req, res) => {
    const body = req.json ?? {}

    const transactionRef = `TXN_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
    const paymentId = `PAY_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

    const transaction = {
      transaction_ref: transactionRef,
      payment_id: paymentId,
      amount: body.amount || 10000,
      customer_id: body.customer_id || 'CUST_123',
      pay_item_id: body.pay_item_id || 'DEFAULT_PAY_ITEM',
      currency: body.currency || 'NGN',
      status: 'PENDING',
      outcome: null,
      redirect_url: body.redirect_url || 'http://localhost:3000/callback',
      description: body.description || 'Test payment',
      created_at: new Date().toISOString(),
    }

    service.state.transactions.set(transactionRef, transaction)

    json(res, 200, {
      status: '00',
      message: 'Payment initialized successfully',
      data: {
        transaction_ref: transactionRef,
        payment_id: paymentId,
        payment_url: `http://localhost:5002/paydirect/api/v1/payment/pay/${paymentId}`,
        amount: transaction.amount,
        currency: transaction.currency,
      },
    })
  })

  service.on('GET', '/paydirect/api/v1/payment/status/:transaction_ref', (req, res) => {
    const transaction = service.state.transactions.get(String(req.params.transaction_ref))

    if (!transaction) {
      json(res, 404, { status: '96', message: 'Transaction not found' })
      return
    }

    json(res, 200, {
      status: '00',
      message: 'Transaction status retrieved successfully',
      data: {
        transaction_ref: transaction.transaction_ref,
        payment_id: transaction.payment_id,
        amount: transaction.amount,
        status: transaction.status,
        customer_id: transaction.customer_id,
        pay_item_id: transaction.pay_item_id,
        currency: transaction.currency,
        created_at: transaction.created_at,
      },
    })
  })

  service.on('POST', '/paydirect/api/v1/payment/pay/:payment_id', (req, res) => {
    const body = req.json ?? {}
    const paymentId = String(req.params.payment_id)

    let transaction = null

    for (const entry of service.state.transactions.values()) {
      if (entry.payment_id === paymentId) {
        transaction = entry
        break
      }
    }

    if (!transaction) {
      json(res, 404, { status: '96', message: 'Payment not found' })
      return
    }

    // How it went: what the checkout said, or the card number.
    const cardNumber = body.card_number ?? ''
    const success =
      transaction.outcome === 'success' ||
      (transaction.outcome !== 'failed' &&
        transaction.outcome !== 'cancelled' &&
        (cardNumber === '4084084084084081' || cardNumber.startsWith('4')))

    transaction.status = success ? 'SUCCESS' : 'FAILED'
    transaction.card_last4 = cardNumber.slice(-4) || '0000'
    transaction.completed_at = new Date().toISOString()

    json(res, 200, {
      status: success ? '00' : '05',
      message: success ? 'Payment successful' : 'Payment failed',
      data: {
        transaction_ref: transaction.transaction_ref,
        payment_id: transaction.payment_id,
        amount: transaction.amount,
        status: transaction.status,
        card_last4: transaction.card_last4,
        completed_at: transaction.completed_at,
      },
    })
  })

  service.on('GET', '/paydirect/api/v1/payment/query/:transaction_ref', (req, res) => {
    const transaction = service.state.transactions.get(String(req.params.transaction_ref))

    if (!transaction) {
      json(res, 404, { status: '96', message: 'Transaction not found' })
      return
    }

    json(res, 200, {
      status: '00',
      message: 'Transaction retrieved successfully',
      data: transaction,
    })
  })

  // The real Interswitch gateway verifies a payment by GETting
  // collections/api/v1/gettransaction.json with merchantcode and
  // transactionreference. The application expects `resp === '00'`, `txnref`,
  // `amount` (in minor units), `retRef` and `desc`.
  service.on('GET', '/collections/api/v1/gettransaction.json', (req, res) => {
    const reference = String(req.query.transactionreference ?? req.query.txnref ?? '')
    const transaction = service.state.transactions.get(reference)

    if (!transaction) {
      json(res, 200, {
        resp: '01',
        desc: 'Transaction not found',
        txnref: reference,
        amount: 0,
        retRef: null,
      })
      return
    }

    // The payment outcome is decided when the card is put in; a transaction
    // that was never paid through is still pending.
    const paid = transaction.status === 'SUCCESS'

    json(res, 200, {
      resp: paid ? '00' : '01',
      desc: paid ? 'Approved' : 'Transaction not completed',
      txnref: transaction.transaction_ref,
      amount: transaction.amount * 100,
      retRef: transaction.payment_id,
    })
  })

  // The checkout a person uses to pay. The browser layer mounts it.
  service.checkout = {
    title: 'Interswitch (mock)',
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

  service.on('POST', '/webhook/test', (req, res) => {
    json(res, 200, { received: true })
  })

  return service
}

/**
 * YouVerify.
 *
 * The identity and address checks. A reference that says "fail" comes back
 * failed, so a test can ask for either.
 */
export function createYouVerifyMock() {
  const service = new MockService('youverify')

  service.state.verifications = new Map()

  const nextId = counter('idv')
  const nextAddress = counter('adv')

  service.on('GET', '/v1/health', (req, res) => {
    json(res, 200, { status: 'healthy' })
  })

  service.on('POST', '/v2/api/identity/verify', (req, res) => {
    const body = req.json ?? {}
    const id = `idv_${Date.now()}_${nextId()}`

    const verification = {
      id,
      identity_type: body.identity_type,
      identity_number: body.identity_number,
      firstname: body.firstname,
      lastname: body.lastname,
      middlename: body.middlename,
      dob: body.dob,
      phone: body.phone,
      email: body.email,
      status: 'pending',
      created_at: new Date().toISOString(),
    }

    service.state.verifications.set(id, verification)

    json(res, 200, {
      status: 'pending',
      data: { id, status: 'pending' },
    })
  })

  service.on('POST', '/v2/api/address/verify', (req, res) => {
    const body = req.json ?? {}
    const id = `adv_${Date.now()}_${nextAddress()}`

    const verification = {
      id,
      address: body.address,
      state: body.state,
      lga: body.lga,
      landmark: body.landmark,
      phone: body.phone,
      email: body.email,
      status: 'pending',
      created_at: new Date().toISOString(),
    }

    service.state.verifications.set(id, verification)

    json(res, 200, {
      status: 'pending',
      data: { id, status: 'pending' },
    })
  })

  service.on('GET', '/v2/api/identity/verify/:id', (req, res) => {
    const verification = service.state.verifications.get(String(req.params.id))

    if (!verification) {
      json(res, 404, { status: false, message: 'Verification not found' })
      return
    }

    // The reference says how it went.
    if (String(req.params.id).includes('fail')) {
      verification.status = 'failed'
    } else if (String(req.params.id).includes('success')) {
      verification.status = 'success'
    }

    json(res, 200, {
      status: verification.status,
      data: verification,
    })
  })

  return service
}

/**
 * OneSignal.
 *
 * The notifications are kept, and — when an NTFY address is given — they are
 * passed on to it, so a phone can still show them.
 */
export function createOneSignalMock(options = {}) {
  const service = new MockService('onesignal')

  service.state.notifications = []

  const ntfyUrl = options.ntfyUrl ?? process.env.NTFY_URL ?? ''
  const ntfyTopic = options.ntfyTopic ?? process.env.NTFY_TOPIC ?? 'gefix-notifications'

  service.on('GET', '/', (req, res) => {
    json(res, 200, { status: 'ok', service: 'onesignal-adapter' })
  })

  service.on('POST', '/api/v1/notifications', (req, res) => {
    const body = req.json ?? {}

    // OneSignal accepts three ways of saying who the notification is for:
    // a segment, a list of external user ids, or a list of player ids. The
    // app targets users by their external id, so requiring a segment
    // rejected every notification it sent.
    const targets =
      body.included_segments ?? body.include_external_user_ids ?? body.include_player_ids

    if (!body.app_id || !targets || !body.headings || !body.contents) {
      json(res, 400, { errors: [{ message: 'Missing required fields' }] })
      return
    }

    const message = body.contents[Object.keys(body.contents)[0]]
    const title = body.headings[Object.keys(body.headings)[0]]

    const notification = { ...body, title, message, created_at: new Date().toISOString() }
    service.state.notifications.push(notification)

    const answer = () =>
      json(res, 200, {
        id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        recipients: Array.isArray(targets) ? targets.length : 0,
      })

    if (!ntfyUrl) {
      answer()
      return
    }

    // Pass it on, so a phone can still show it.
    fetch(`${ntfyUrl}/${ntfyTopic}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: ntfyTopic,
        title,
        message,
        tags: ['gefix'],
        priority: 'default',
      }),
    })
      .then(answer)
      .catch(() => {
        json(res, 500, { errors: [{ message: 'Failed to send notification' }] })
      })
  })

  return service
}

/**
 * Twilio.
 *
 * The SMS API: a message is sent, and it can be asked for afterwards.
 *
 * The OpenAPI spec and the Prism container are kept alongside this for the
 * calls Prism covers; this one runs in a process, so it needs no container
 * and no spec download.
 */
export function createTwilioMock() {
  const service = new MockService('twilio')

  service.state.messages = new Map()

  const nextSid = counter('SM')

  service.on('GET', '/2010-04-01/Accounts/:accountSid.json', (req, res) => {
    json(res, 200, {
      account_sid: req.params.accountSid,
      friendly_name: 'Mock Account',
      status: 'active',
      type: 'Trial',
    })
  })

  service.on('POST', '/2010-04-01/Accounts/:accountSid/Messages.json', (req, res) => {
    const body = req.json ?? {}

    if (!body.To || !body.Body) {
      json(res, 400, {
        code: 21201,
        message: "The 'To' or 'Body' parameter is missing.",
      })
      return
    }

    const sid = nextSid()
    const message = {
      sid,
      account_sid: req.params.accountSid,
      to: body.To,
      from: body.From ?? '+15550000000',
      body: body.Body,
      status: 'queued',
      direction: 'outbound-api',
      num_media: '0',
      date_created: new Date().toISOString(),
    }

    service.state.messages.set(sid, message)

    res.statusCode = 201
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(message))
  })

  service.on('GET', '/2010-04-01/Accounts/:accountSid/Messages/:sid.json', (req, res) => {
    const message = service.state.messages.get(String(req.params.sid))

    if (!message) {
      json(res, 404, { code: 20404, message: 'The requested resource was not found' })
      return
    }

    json(res, 200, message)
  })

  return service
}
