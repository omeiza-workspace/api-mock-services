import { MockService, json, counter } from '../harness.js'

/**
 * PayPal.
 *
 * The Orders API v2: create an order, capture it, and the webhooks that follow.
 * The shapes are the real ones: the same fields, the same envelopes and the
 * same status codes, so the code that talks to PayPal does not change when it
 * is pointed at a mock.
 *
 * The reference decides: an order id with `success` in it captures successfully,
 * one with `failed` in it fails — so a test can ask for either without a flag.
 */
export function createPaypalMock() {
  const service = new MockService('paypal')

  service.state.orders = new Map()
  service.state.captures = new Map()
  service.state.webhooks = []

  const nextOrder = counter('order')
  const nextCapture = counter('capture')

  const failed = (id) => String(id ?? '').includes('failed')
  const successful = (id) => String(id ?? '').includes('success')

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'paypal-mock' })
  })

  service.on('POST', '/v2/checkout/orders', (req, res) => {
    const body = req.json ?? {}
    const id = nextOrder()

    const order = {
      id,
      intent: body.intent ?? 'CAPTURE',
      status: 'CREATED',
      purchase_units: body.purchase_units ?? [
        {
          reference_id: 'default',
          amount: {
            currency_code: 'USD',
            value: '100.00',
          },
        },
      ],
      create_time: new Date().toISOString(),
      links: [
        {
          href: `${service.url}/v2/checkout/orders/${id}`,
          rel: 'self',
          method: 'GET',
        },
        {
          href: `${service.url}/v2/checkout/orders/${id}/capture`,
          rel: 'capture',
          method: 'POST',
        },
      ],
    }

    service.state.orders.set(id, order)
    json(res, 201, order)
  })

  service.on('GET', '/v2/checkout/orders/:id', (req, res) => {
    const id = String(req.params.id)
    const order = service.state.orders.get(id)

    if (!order) {
      json(res, 404, {
        name: 'NOT_FOUND',
        message: 'The specified resource does not exist.',
        details: [],
        links: [],
      })
      return
    }

    json(res, 200, order)
  })

  service.on('POST', '/v2/checkout/orders/:id/capture', (req, res) => {
    const id = String(req.params.id)
    const order = service.state.orders.get(id)

    if (!order) {
      json(res, 404, {
        name: 'NOT_FOUND',
        message: 'The specified resource does not exist.',
      })
      return
    }

    const captureId = nextCapture()
    const isFailed = failed(id)
    const isSuccess = successful(id) || !isFailed

    const capture = {
      id: captureId,
      status: isSuccess ? 'COMPLETED' : 'DECLINED',
      amount: order.purchase_units[0]?.amount ?? { currency_code: 'USD', value: '100.00' },
      final_capture: true,
      seller_protection: { status: 'ELIGIBLE', dispute_categories: ['ITEM_NOT_RECEIVED', 'UNAUTHORIZED_TRANSACTION'] },
      create_time: new Date().toISOString(),
      update_time: new Date().toISOString(),
    }

    order.status = isSuccess ? 'COMPLETED' : 'APPROVED'
    service.state.orders.set(id, order)
    service.state.captures.set(captureId, capture)

    json(res, 201, {
      id,
      status: isSuccess ? 'COMPLETED' : 'APPROVED',
      purchase_units: [
        {
          reference_id: 'default',
          payments: { captures: [capture] },
        },
      ],
      payer: { email_address: 'buyer@example.com', payer_id: 'PAYER123' },
      create_time: order.create_time,
      update_time: new Date().toISOString(),
      links: [
        { href: `${service.url}/v2/checkout/orders/${id}`, rel: 'self', method: 'GET' },
      ],
    })
  })

  service.on('POST', '/v1/webhooks', (req, res) => {
    const body = req.json ?? {}
    service.state.webhooks.push(body)
    json(res, 201, { id: `wh_${service.state.webhooks.length}`, status: 'ACTIVE', ...body })
  })

  service.on('GET', '/v1/webhooks', (req, res) => {
    json(res, 200, { webhooks: service.state.webhooks })
  })

  // The checkout a person uses to pay. The browser layer mounts it.
  service.checkout = {
    title: 'PayPal (mock)',
    find: (orderId) => {
      const order = service.state.orders.get(orderId)

      return order
        ? {
            reference: orderId,
            amount: order.purchase_units[0]?.amount?.value ?? '100.00',
            merchant: 'The shop',
          }
        : null
    },
    onDone: (orderId, outcome) => {
      const order = service.state.orders.get(orderId)

      if (order) order.status = outcome === 'success' ? 'COMPLETED' : 'APPROVED'
    },
  }

  return service
}

/**
 * Square.
 *
 * The Payments API: create a payment, refund it, and the webhooks.
 * The shapes match Square's API: idempotency keys, money objects, and the
 * same status transitions.
 *
 * The reference decides: a payment id with `success` succeeds, `failed` fails.
 */
export function createSquareMock() {
  const service = new MockService('square')

  service.state.payments = new Map()
  service.state.refunds = new Map()
  service.state.webhooks = []

  const nextPayment = counter('payment')
  const nextRefund = counter('refund')

  const failed = (id) => String(id ?? '').includes('failed')
  const successful = (id) => String(id ?? '').includes('success')

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'square-mock' })
  })

  service.on('POST', '/v2/payments', (req, res) => {
    const body = req.json ?? {}
    const idempotencyKey = body.idempotency_key ?? `idem_${nextPayment()}`

    if (!body.source_id || !body.amount_money) {
      json(res, 400, {
        errors: [
          {
            category: 'INVALID_REQUEST_ERROR',
            code: 'MISSING_REQUIRED_PARAMETER',
            detail: 'source_id and amount_money are required',
          },
        ],
      })
      return
    }

    const paymentId = nextPayment()
    const isFailed = failed(idempotencyKey)
    const isSuccess = successful(idempotencyKey) || !isFailed

    const payment = {
      id: paymentId,
      type: 'PAYMENT',
      amount_money: body.amount_money,
      tip_money: body.tip_money ?? { amount: 0, currency: body.amount_money.currency },
      status: isSuccess ? 'COMPLETED' : 'FAILED',
      delay_duration: 'PT168H',
      delay_action: 'CANCEL',
      cancel_reason: isFailed ? 'CARD_DECLINED' : undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      card_details: {
        status: isSuccess ? 'AUTHORIZED' : 'DECLINED',
        card: { card_brand: 'VISA', last_4: '1111', exp_month: 12, exp_year: 2028 },
      },
      idempotency_key: idempotencyKey,
      location_id: body.location_id ?? 'LOCATION_1',
      order_id: body.order_id ?? `order_${paymentId}`,
      processing_fee: [
        { amount_money: { amount: Math.round(Number(body.amount_money.amount) * 0.029), currency: body.amount_money.currency }, type: 'INITIAL' },
      ],
    }

    service.state.payments.set(paymentId, payment)
    json(res, 200, { payment })
  })

  service.on('GET', '/v2/payments/:id', (req, res) => {
    const id = String(req.params.id)
    const payment = service.state.payments.get(id)

    if (!payment) {
      json(res, 404, {
        errors: [
          {
            category: 'NOT_FOUND',
            code: 'PAYMENT_NOT_FOUND',
            detail: `Payment ${id} not found`,
          },
        ],
      })
      return
    }

    json(res, 200, { payment })
  })

  service.on('POST', '/v2/refunds', (req, res) => {
    const body = req.json ?? {}
    const idempotencyKey = body.idempotency_key ?? `idem_${nextRefund()}`

    if (!body.payment_id || !body.amount_money) {
      json(res, 400, {
        errors: [
          { category: 'INVALID_REQUEST_ERROR', code: 'MISSING_REQUIRED_PARAMETER', detail: 'payment_id and amount_money are required' },
        ],
      })
      return
    }

    const payment = service.state.payments.get(body.payment_id)

    if (!payment) {
      json(res, 404, { errors: [{ category: 'NOT_FOUND', code: 'PAYMENT_NOT_FOUND', detail: 'Payment not found' }] })
      return
    }

    const refundId = nextRefund()
    const refund = {
      id: refundId,
      payment_id: body.payment_id,
      amount_money: body.amount_money,
      status: 'COMPLETED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      idempotency_key: idempotencyKey,
    }

    service.state.refunds.set(refundId, refund)
    json(res, 200, { refund })
  })

  service.on('POST', '/v2/webhooks/subscriptions', (req, res) => {
    const body = req.json ?? {}
    service.state.webhooks.push(body)
    json(res, 200, { subscription: { id: `sub_${service.state.webhooks.length}`, enabled: true, ...body } })
  })

  return service
}

/**
 * Adyen.
 *
 * The Payments API v68: submit a payment, get a result code, and the
 * notification webhook. The shapes are Adyen's: the same field names, the same
 * result codes, and the same additional data.
 *
 * The reference decides: a merchantReference with `success` gets `Authorised`,
 * one with `failed` gets `Refused`.
 */
export function createAdyenMock() {
  const service = new MockService('adyen')

  service.state.payments = new Map()
  service.state.notifications = []

  const nextPsp = counter('psp')

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success')

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'adyen-mock' })
  })

  service.on('POST', '/checkout/v68/payments', (req, res) => {
    const body = req.json ?? {}
    const merchantReference = body.reference ?? `order_${nextPsp()}`
    const isFailed = failed(merchantReference)
    const isSuccess = successful(merchantReference) || !isFailed

    const pspReference = `psp_${nextPsp()}`
    const resultCode = isSuccess ? 'Authorised' : 'Refused'
    const refusalReason = isFailed ? 'Refused' : undefined

    const payment = {
      pspReference,
      resultCode,
      merchantReference,
      refusalReason,
      additionalData: {
        authCode: isSuccess ? `AUTH_${pspReference}` : undefined,
        avsResult: '4 AVS supported',
        cvcResult: '1 Matches',
      },
      amount: body.amount ?? { currency: 'EUR', value: 10000 },
    }

    service.state.payments.set(merchantReference, payment)

    json(res, 200, payment)
  })

  service.on('POST', '/checkout/v68/payments/details', (req, res) => {
    const body = req.json ?? {}
    const merchantReference = body.merchantReference ?? ''
    const payment = service.state.payments.get(merchantReference)

    if (!payment) {
      json(res, 404, { errorCode: '101', message: 'Payment not found', errorType: 'validation' })
      return
    }

    json(res, 200, payment)
  })

  service.on('POST', '/checkout/v68/payments/:pspRef/cancels', (req, res) => {
    const pspRef = String(req.params.pspRef)
    const payment = [...service.state.payments.values()].find((p) => p.pspReference === pspRef)

    if (!payment) {
      json(res, 404, { errorCode: '101', message: 'Payment not found', errorType: 'validation' })
      return
    }

    payment.resultCode = 'Cancelled'
    json(res, 200, { pspReference: pspRef, resultCode: 'Cancelled' })
  })

  service.on('POST', '/checkout/v68/payments/:pspRef/refunds', (req, res) => {
    const pspRef = String(req.params.pspRef)
    const payment = [...service.state.payments.values()].find((p) => p.pspReference === pspRef)

    if (!payment) {
      json(res, 404, { errorCode: '101', message: 'Payment not found', errorType: 'validation' })
      return
    }

    const refundRef = `re_${nextPsp()}`
    json(res, 200, {
      pspReference: refundRef,
      resultCode: 'Refunded',
      merchantReference: payment.merchantReference,
    })
  })

  service.on('POST', '/binlookup/v31/getCostEstimate', (req, res) => {
    json(res, 200, {
      costEstimate: {
        totalAmount: { currency: 'EUR', value: 100 },
        feeAmount: { currency: 'EUR', value: 290 },
        surchargeAmount: { currency: 'EUR', value: 0 },
      },
    })
  })

  // Notification webhook endpoint (the one Adyen calls)
  service.on('POST', '/notifications/webhook', (req, res) => {
    const body = req.json ?? {}
    service.state.notifications.push(body)
    json(res, 200, '[accepted]')
  })

  service.on('GET', '/notifications/webhook', (req, res) => {
    json(res, 200, { notifications: service.state.notifications })
  })

  return service
}
