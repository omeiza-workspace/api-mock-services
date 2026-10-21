import { MockService, json, counter } from '../harness.js'

/**
 * Stripe.
 *
 * A PaymentIntent, a refund, and the webhook the browser never sees. The
 * intents are kept, so a webhook can be about a real one and a test can look
 * at what was asked for.
 */
export function createStripeMock() {
  const service = new MockService('stripe')

  service.state.intents = new Map()
  service.state.refunds = []
  service.state.webhook = {
    id: 'evt_test_1',
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_test_1', status: 'succeeded', amount: 1000 } },
  }

  const nextIntent = counter('pi_test')
  const nextRefund = counter('re_test')

  service.on('POST', '/v1/payment_intents', (req, res) => {
    const id = nextIntent()
    const amount = Number(req.json?.amount ?? 0)

    const intent = {
      id,
      object: 'payment_intent',
      amount,
      currency: req.json?.currency ?? 'usd',
      status:
        service.state.outcomeSet && service.state.outcome === 'success'
          ? 'succeeded'
          : 'requires_payment_method',
      client_secret: `${id}_secret`,
      description: req.json?.description ?? null,
      receipt_email: req.json?.receipt_email ?? null,
      metadata: req.json?.metadata ?? {},
    }

    service.state.intents.set(id, intent)
    json(res, 200, intent)
  })

  service.on('GET', '/v1/payment_intents/:id', (req, res) => {
    const intent = service.state.intents.get(String(req.params.id))

    if (!intent) {
      json(res, 404, { error: { message: `No such payment intent: ${req.params.id}` } })
      return
    }

    json(res, 200, intent)
  })

  service.on('POST', '/v1/refunds', (req, res) => {
    const refund = {
      id: nextRefund(),
      object: 'refund',
      payment_intent: req.json?.payment_intent ?? null,
      amount: Number(req.json?.amount ?? 0),
      status: 'succeeded',
    }

    service.state.refunds.push(refund)
    json(res, 200, refund)
  })

  /** What the next webhook will say. */
  service.state.setWebhook = (event) => {
    service.state.webhook = event
  }

  /** The event, built from the intent it is about. */
  service.state.webhookEvent = (intentId) => {
    const intent = service.state.intents.get(String(intentId))

    return {
      id: `evt_test_${service.state.webhooks.length + 1}`,
      type: intent?.status === 'succeeded' ? 'payment_intent.succeeded' : 'payment_intent.payment_failed',
      data: {
        object: {
          id: intent?.id ?? intentId,
          status: intent?.status ?? 'requires_payment_method',
          amount: intent?.amount ?? 0,
          metadata: intent?.metadata ?? {},
        },
      },
    }
  }

  // The checkout a person uses to pay. The browser layer mounts it.
  service.checkout = {
    title: 'Card payment (mock)',
    find: (id) => {
      const intent = service.state.intents.get(id)

      return intent
        ? {
            reference: id,
            amount: `${(intent.amount / 100).toFixed(2)}`,
            merchant: 'The shop',
          }
        : null
    },
    onDone: (id, outcome) => {
      const intent = service.state.intents.get(id)

      if (!intent) return

      intent.status = outcome === 'success' ? 'succeeded' : 'requires_payment_method'
      intent.error =
        outcome === 'success'
          ? undefined
          : { type: 'card_error', message: outcome === 'failed' ? 'Your card was declined.' : 'The payment was cancelled.' }
    },
  }

  return service
}

/**
 * Resend.
 *
 * The sending domains, with the DNS records a shop has to create, and the
 * sending of the email itself.
 */
export function createResendMock() {
  const service = new MockService('resend')

  service.state.domains = new Map()
  service.state.sent = []

  const nextDomain = counter('dom')
  const nextEmail = counter('em')

  service.on('GET', '/domains', (req, res) => {
    json(res, 200, { data: [...service.state.domains.values()] })
  })

  service.on('POST', '/domains', (req, res) => {
    const name = String(req.json?.name ?? '')

    if (!name) {
      json(res, 422, { message: 'The domain needs a name' })
      return
    }

    const domain = {
      id: nextDomain(),
      name,
      status: 'pending',
      region: 'us-east-1',
      created_at: new Date().toISOString(),
      records: [
        {
          record: 'SPF',
          name: 'send',
          type: 'MX',
          value: 'feedback-smtp.us-east-1.amazonses.com',
          priority: 10,
          status: 'not_started',
        },
        {
          record: 'DKIM',
          name: 'resend._domainkey',
          type: 'TXT',
          value: 'p=MIGfMA0GCSqGSIb3DQEBBQUA=pilot-mock-key',
          status: 'not_started',
        },
      ],
    }

    service.state.domains.set(name, domain)
    json(res, 201, domain)
  })

  service.on('POST', '/emails', (req, res) => {
    const body = req.json ?? {}

    if (!body.to) {
      json(res, 422, { message: 'The email needs a recipient' })
      return
    }

    service.state.sent.push(body)
    json(res, 200, { id: nextEmail() })
  })

  return service
}

/**
 * Xero.
 *
 * The token exchange, the connections, and the invoices that are pushed.
 */
export function createXeroMock() {
  const service = new MockService('xero')

  service.state.invoices = []
  service.state.tokens = []

  const nextToken = counter('at')
  const nextRefresh = counter('rt')
  const nextInvoice = counter('inv')

  service.on('POST', '/connect/token', (req, res) => {
    const body = new URLSearchParams(req.raw)

    if (!body.get('client_id') || !body.get('client_secret')) {
      json(res, 400, {
        error: 'invalid_client',
        error_description: 'The client is not known',
      })
      return
    }

    const token = {
      access_token: nextToken(),
      refresh_token: nextRefresh(),
      expires_in: 1800,
      token_type: 'Bearer',
      scope: body.get('grant_type'),
    }

    service.state.tokens.push(token)
    json(res, 200, token)
  })

  // Xero answers with a plain array of the organisations.
  service.on('GET', '/connections', (req, res) => {
    json(res, 200, [
      {
        id: 'conn_1',
        tenantId: 'tenant_1',
        tenantName: 'Test Shop',
        tenantType: 'ORGANISATION',
      },
    ])
  })

  service.on('POST', '/api.xro/2.0/Invoices', (req, res) => {
    service.state.invoices.push(req.json)
    json(res, 200, { Invoices: [{ InvoiceID: nextInvoice(), Status: 'DRAFT' }] })
  })

  service.on('*', /^\/api\.xro\/2\.0\//, (req, res) => {
    json(res, 200, [])
  })

  return service
}

/**
 * Cloudflare.
 *
 * The zones, and the DNS records.
 */
export function createCloudflareMock() {
  const service = new MockService('cloudflare')

  service.state.records = new Map()
  service.state.zoneId = 'zone_1'

  const nextRecord = counter('rec')

  service.on('GET', /^\/?(?:client\/v4\/)?zones$/, (req, res) => {
    const name = req.query.name

    json(res, 200, {
      success: true,
      errors: [],
      messages: [],
      result: name
        ? [{ id: service.state.zoneId, name: String(name).toLowerCase(), status: 'active' }]
        : [{ id: service.state.zoneId, name: 'shop.example', status: 'active' }],
    })
  })

  service.on('GET', /^\/?(?:client\/v4\/)?zones\/(?<zone>[^/]+)\/dns_records$/, (req, res) => {
    const own = service.state.records.get(String(req.params.zone)) ?? []

    json(res, 200, {
      success: true,
      errors: [],
      messages: [],
      result: own.filter(
        (record) =>
          (!req.query.type || record.type === req.query.type) &&
          (!req.query.name || record.name === req.query.name),
      ),
    })
  })

  service.on('POST', /^\/?(?:client\/v4\/)?zones\/(?<zone>[^/]+)\/dns_records$/, (req, res) => {
    const zone = String(req.params.zone)

    // Cloudflare does not route to a zone it does not have.
    if (zone !== service.state.zoneId) {
      json(res, 200, {
        success: false,
        errors: [{ code: 7003, message: 'Could not route to the zone' }],
        messages: [],
        result: null,
      })
      return
    }

    const own = service.state.records.get(zone) ?? []

    const record = {
      id: nextRecord(),
      type: req.json?.type,
      name: req.json?.name,
      content: req.json?.content,
      ttl: req.json?.ttl ?? 3600,
      ...(req.json?.priority !== undefined ? { priority: req.json.priority } : {}),
    }

    own.push(record)
    service.state.records.set(zone, own)

    json(res, 200, { success: true, errors: [], messages: [], result: record })
  })

  return service
}
