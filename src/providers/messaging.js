import { MockService, json, counter } from '../harness.js'

/**
 * The ways an app reaches a person.
 *
 * A text message, a WhatsApp message and a push notification — the three an
 * app in Nigeria sends most, and the three that cost money the moment they
 * are real.
 *
 * Every one of them is kept, so a test can look at what was sent without a
 * phone, and the SMS is printed, so a container's logs show what went out.
 */

/**
 * Termii.
 *
 * The message is sent, it is kept, and it can be asked for afterwards. The
 * text is also printed, so `docker logs` shows the messages that went out.
 */
export function createTermiiMock() {
  const service = new MockService('termii')

  service.state.messages = new Map()

  const nextId = counter('msg')

  service.on('POST', '/api/v1/send', (req, res) => {
    const body = req.json ?? {}

    if (!body.to || !body.message) {
      json(res, 400, {
        status: 'error',
        message: 'to and message are required',
        data: null,
      })
      return
    }

    const id = `msg_${nextId()}`

    const message = {
      message_id: id,
      to: body.to,
      from: body.sender ?? body.from ?? 'Termii',
      message: body.message,
      status: 'success',
      units_used: 1,
      total_units_used: 1,
      created_at: new Date().toISOString(),
    }

    service.state.messages.set(id, message)

    // The message is printed, so a container's logs show what went out.
    console.log(`[termii] ${message.to}: ${message.message}`)

    json(res, 200, {
      status: 'success',
      message: 'Message sent successfully',
      data: message,
    })
  })

  service.on('GET', '/api/v1/messages/:id', (req, res) => {
    const message = service.state.messages.get(String(req.params.id))

    if (!message) {
      json(res, 404, { status: 'error', message: 'Message not found', data: null })
      return
    }

    json(res, 200, { status: 'success', message: 'Message retrieved successfully', data: message })
  })

  return service
}

/**
 * The WhatsApp Cloud API.
 *
 * The message is sent and the receipt comes back — with the `wamid` the
 * real API gives. The webhook handshake is answered too, so an app can be
 * pointed at the mock without changing its verification code.
 */
export function createWhatsAppMock() {
  const service = new MockService('whatsapp')

  service.state.messages = []
  service.state.events = []
  service.state.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? 'mock-verify-token'

  const nextId = counter('wamid')

  service.on('POST', '/v1/messages', (req, res) => {
    const body = req.json ?? {}

    if (!body.to || !body.type) {
      json(res, 400, {
        error: {
          code: 131000,
          title: 'Message failed to send because more than one parameter was specified',
          message: 'to and type are required',
        },
      })
      return
    }

    const to = String(body.to)
    const id = `wamid.${nextId()}.${Date.now()}`

    const text =
      body.type === 'template'
        ? body.template?.components?.[0]?.parameters?.map((part) => part.text).join(' ') ?? ''
        : (body.text?.body ?? '')

    const message = {
      id,
      to,
      type: body.type,
      text,
      status: 'accepted',
      created_at: new Date().toISOString(),
    }

    service.state.messages.push(message)

    json(res, 200, {
      messaging_product: 'whatsapp',
      contacts: [{ input: to, wa_id: to.replace(/[^\d]/g, '') }],
      messages: [{ id, message_status: 'accepted' }],
    })
  })

  // The handshake WhatsApp does when a webhook is set up.
  service.on('GET', '/webhook', (req, res) => {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if (mode === 'subscribe' && token === service.state.verifyToken) {
      res.statusCode = 200
      res.setHeader('content-type', 'text/plain')
      res.end(String(challenge ?? ''))
      return
    }

    json(res, 403, { error: 'the verification token does not match' })
  })

  // The events that arrive afterwards.
  service.on('POST', '/webhook', (req, res) => {
    const body = req.json ?? {}

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        service.state.events.push({
          field: change.field,
          value: change.value,
          received_at: new Date().toISOString(),
        })
      }
    }

    json(res, 200, { received: true })
  })

  return service
}

/**
 * Firebase Cloud Messaging.
 *
 * The message is sent and the receipt comes back — the count of what was
 * delivered, and the name of the message, as the real API gives them.
 */
export function createFcmMock() {
  const service = new MockService('fcm')

  service.state.messages = []

  const nextId = counter('fcm')

  service.on('POST', /^\/v1\/projects\/(?<projectId>[^/]+)\/messages:send$/, (req, res) => {
    const body = req.json ?? {}

    if (!body.message?.token) {
      json(res, 400, {
        error: { code: 400, message: 'The registration token is required', status: 'INVALID_ARGUMENT' },
      })
      return
    }

    const id = nextId()

    const message = {
      id,
      project: req.params.projectId,
      token: body.message.token,
      notification: body.message.notification ?? null,
      data: body.message.data ?? {},
      created_at: new Date().toISOString(),
    }

    service.state.messages.push(message)

    json(res, 200, {
      name: `projects/${req.params.projectId}/messages/${id}`,
      successCount: 1,
      failureCount: 0,
      response: [{ status: 'SUCCESS', messageId: id }],
    })
  })

  service.on('POST', /^\/v1\/projects\/(?<projectId>[^/]+)\/messages:batchSend$/, (req, res) => {
    const body = req.json ?? {}
    const messages = body.messages ?? []

    const responses = messages.map((message) => {
      const id = nextId()

      service.state.messages.push({
        id,
        project: req.params.projectId,
        token: message.message?.token ?? null,
        notification: message.message?.notification ?? null,
        data: message.message?.data ?? {},
        created_at: new Date().toISOString(),
      })

      return { status: 'SUCCESS', messageId: id }
    })

    json(res, 200, {
      name: `projects/${req.params.projectId}/messages/batch`,
      successCount: responses.length,
      failureCount: 0,
      responses,
    })
  })

  return service
}
