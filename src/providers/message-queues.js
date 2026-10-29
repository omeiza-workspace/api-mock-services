import { MockService, json, counter } from '../harness.js'

/**
 * RabbitMQ.
 *
 * The RabbitMQ HTTP API: connections, channels, queues, exchanges, and messages.
 * The shapes match RabbitMQ's management API.
 *
 * The reference decides: a queue with `success` succeeds, `failed` fails.
 */
export function createRabbitmqMock() {
  const service = new MockService('rabbitmq')

  service.state.connections = new Map()
  service.state.channels = new Map()
  service.state.queues = new Map()
  service.state.exchanges = new Map()
  service.state.messages = []

  let connId = 1000
  let channelId = 2000
  let queueId = 3000
  let exchangeId = 4000
  let msgId = 5000

  const nextConnId = () => `conn_${connId++}`
  const nextChannelId = () => `ch_${channelId++}`
  const nextQueueId = () => `q_${queueId++}`
  const nextExchangeId = () => `ex_${exchangeId++}`
  const nextMsgId = () => `msg_${msgId++}`

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'rabbitmq-mock' })
  })

  service.on('GET', '/api/connections', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const conns = [...service.state.connections.values()].slice(0, limit)
    json(res, 200, conns)
  })

  service.on('GET', '/api/connections/:name', (req, res) => {
    const name = String(req.params.name)
    const conn = service.state.connections.get(name)
    if (!conn) {
      json(res, 404, { error: 'Not found', reason: 'Connection not found' })
      return
    }
    json(res, 200, conn)
  })

  service.on('DELETE', '/api/connections/:name', (req, res) => {
    const name = String(req.params.name)
    if (!service.state.connections.has(name)) {
      json(res, 404, { error: 'Not found', reason: 'Connection not found' })
      return
    }
    service.state.connections.delete(name)
    res.statusCode = 204
    res.end()
  })

  service.on('GET', '/api/channels', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const channels = [...service.state.channels.values()].slice(0, limit)
    json(res, 200, channels)
  })

  service.on('POST', '/api/channels', (req, res) => {
    const body = req.body ?? {}
    const connName = body.connection_name ?? 'conn_1'
    const isFailed = failed(connName)

    const id = nextChannelId()
    const channel = {
      name: id,
      connection_name: connName,
      number: channelId,
      confirm: true,
      consumer_count: 0,
      messages_unacknowledged: 0,
      messages_uncommitted: 0,
      messages_unconfirmed: 0,
      prefetch_count: body.prefetch_count ?? 10,
      state: isFailed ? 'closed' : 'running',
    }

    service.state.channels.set(id, channel)

    if (isFailed) {
      json(res, 400, { error: 'Failed to create channel', reason: 'Connection failed' })
      return
    }

    json(res, 201, channel)
  })

  service.on('GET', '/api/queues', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const vhost = req.query.vhost ?? '/'
    const queues = [...service.state.queues.values()]
      .filter(q => q.vhost === vhost)
      .slice(0, limit)
    json(res, 200, queues)
  })

  service.on('PUT', '/api/queues/:vhost/:name', (req, res) => {
    const vhost = String(req.params.vhost)
    const name = String(req.params.name)
    const body = req.body ?? {}
    const isFailed = failed(name)

    const queue = {
      name,
      vhost,
      durable: body.durable ?? true,
      auto_delete: body.auto_delete ?? false,
      arguments: body.arguments ?? {},
      messages: 0,
      messages_ready: 0,
      messages_unacknowledged: 0,
      consumers: [],
      state: isFailed ? 'error' : 'running',
    }

    service.state.queues.set(`${vhost}/${name}`, queue)

    if (isFailed) {
      json(res, 400, { error: 'Failed to declare queue', reason: 'Queue failed' })
      return
    }

    json(res, 201, queue)
  })

  service.on('DELETE', '/api/queues/:vhost/:name', (req, res) => {
    const vhost = String(req.params.vhost)
    const name = String(req.params.name)
    const key = `${vhost}/${name}`
    if (!service.state.queues.has(key)) {
      json(res, 404, { error: 'Not found', reason: 'Queue not found' })
      return
    }
    service.state.queues.delete(key)
    res.statusCode = 204
    res.end()
  })

  service.on('GET', '/api/exchanges', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const vhost = req.query.vhost ?? '/'
    const exchanges = [...service.state.exchanges.values()]
      .filter(e => e.vhost === vhost)
      .slice(0, limit)
    json(res, 200, exchanges)
  })

  service.on('POST', '/api/exchanges/:vhost/:name', (req, res) => {
    const vhost = String(req.params.vhost)
    const name = String(req.params.name)
    const body = req.body ?? {}
    const isFailed = failed(name)

    const exchange = {
      name,
      vhost,
      type: body.type ?? 'direct',
      durable: body.durable ?? true,
      auto_delete: body.auto_delete ?? false,
      internal: body.internal ?? false,
      arguments: body.arguments ?? {},
      state: isFailed ? 'error' : 'running',
    }

    service.state.exchanges.set(`${vhost}/${name}`, exchange)

    if (isFailed) {
      json(res, 400, { error: 'Failed to declare exchange', reason: 'Exchange failed' })
      return
    }

    json(res, 201, exchange)
  })

  service.on('POST', '/api/exchanges/:vhost/:name/publish', (req, res) => {
    const vhost = String(req.params.vhost)
    const exchange = String(req.params.exchange)
    const body = req.body ?? {}
    const isFailed = failed(body.routing_key ?? body.payload ?? '')

    const msg = {
      payload: body.payload ?? '',
      payload_bytes: Buffer.byteLength(body.payload ?? ''),
      payload_encoding: 'string',
      properties: body.properties ?? {},
      routing_key: body.routing_key ?? '',
      exchange,
      redelivered: false,
    }

    service.state.messages.push(msg)

    if (isFailed) {
      json(res, 400, { error: 'Failed to publish', reason: 'Publish failed' })
      return
    }

    json(res, 200, { routed: true })
  })

  service.on('POST', '/api/queues/:vhost/:name/get', (req, res) => {
    const vhost = String(req.params.vhost)
    const name = String(req.params.name)
    const key = `${vhost}/${name}`
    const queue = service.state.queues.get(key)

    if (!queue) {
      json(res, 404, { error: 'Not found', reason: 'Queue not found' })
      return
    }

    const msg = service.state.messages.shift()

    if (!msg) {
      json(res, 200, { message: null })
      return
    }

    json(res, 200, {
      payload: msg.payload,
      payload_bytes: msg.payload_bytes,
      payload_encoding: msg.payload_encoding,
      properties: msg.properties,
      routing_key: msg.routing_key,
      exchange: msg.exchange,
      redelivered: msg.redelivered,
    })
  })

  service.on('POST', '/api/bindings/:vhost/e/:exchange/q/:queue', (req, res) => {
    const vhost = String(req.params.vhost)
    const exchange = String(req.params.exchange)
    const queue = String(req.params.queue)
    const body = req.body ?? {}
    const routing_key = body.routing_key ?? ''

    const binding = {
      source: exchange,
      destination: queue,
      destination_type: 'queue',
      routing_key,
      arguments: body.arguments ?? {},
      vhost,
    }

    json(res, 201, binding)
  })

  return service
}

/**
 * Kafka (via Confluent REST Proxy).
 *
 * The Kafka REST Proxy API: topics, partitions, consumers, and messages.
 * The shapes match Confluent's REST Proxy API.
 *
 * The reference decides: a topic with `success` succeeds, `failed` fails.
 */
export function createKafkaMock() {
  const service = new MockService('kafka')

  service.state.topics = new Map()
  service.state.consumers = new Map()
  service.state.messages = new Map()

  let topicId = 1000
  let consumerId = 2000
  let msgId = 3000

  const nextTopicId = () => `topic_${topicId++}`
  const nextConsumerId = () => `consumer_${consumerId++}`
  const nextMsgId = () => `msg_${msgId++}`

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'kafka-mock' })
  })

  service.on('GET', '/topics', (req, res) => {
    const topics = [...service.state.topics.keys()]
    json(res, 200, topics)
  })

  service.on('GET', '/topics/:topic', (req, res) => {
    const topic = String(req.params.topic)
    const topicData = service.state.topics.get(topic)

    if (!topicData) {
      json(res, 404, { error_code: 404, message: 'Topic not found' })
      return
    }

    json(res, 200, topicData)
  })

  service.on('POST', '/topics', (req, res) => {
    const body = req.body ?? {}
    const name = body.name ?? nextTopicId()
    const isFailed = failed(name)

    const topic = {
      name,
      partitions: body.partitions ?? 1,
      configs: body.configs ?? {},
      replication_factor: body.replication_factor ?? 1,
    }

    service.state.topics.set(name, topic)
    service.state.messages.set(name, [])

    if (isFailed) {
      json(res, 400, { error_code: 400, message: 'Failed to create topic' })
      return
    }

    json(res, 201, topic)
  })

  service.on('DELETE', '/topics/:topic', (req, res) => {
    const topic = String(req.params.topic)
    if (!service.state.topics.has(topic)) {
      json(res, 404, { error_code: 404, message: 'Topic not found' })
      return
    }
    service.state.topics.delete(topic)
    service.state.messages.delete(topic)
    res.statusCode = 204
    res.end()
  })

  service.on('POST', '/topics/:topic/records', (req, res) => {
    const topic = String(req.params.topic)
    const body = req.body ?? {}
    const records = body.records ?? []
    const isFailed = failed(topic)

    const produced = records.map(r => ({
      partition: r.partition ?? 0,
      offset: msgId++,
      timestamp: Date.now(),
      key: r.key ?? null,
      value: r.value ?? '',
      headers: r.headers ?? [],
    }))

    const topicMessages = service.state.messages.get(topic) ?? []
    topicMessages.push(...produced)
    service.state.messages.set(topic, topicMessages)

    if (isFailed) {
      json(res, 400, { error_code: 400, message: 'Failed to produce records' })
      return
    }

    json(res, 200, { offsets: produced.map(p => ({ partition: p.partition, offset: p.offset })) })
  })

  service.on('POST', '/consumers/:group/instances', (req, res) => {
    const group = String(req.params.group)
    const body = req.body ?? {}
    const id = nextConsumerId()

    const consumer = {
      instance_id: id,
      base_uri: `http://mock/kafka/consumers/${group}/instances/${id}`,
      format: body.format ?? 'json',
      auto_offset_reset: body.auto_offset_reset ?? 'latest',
      enable_auto_commit: body.enable_auto_commit ?? true,
    }

    service.state.consumers.set(`${group}/${id}`, consumer)
    json(res, 200, consumer)
  })

  service.on('DELETE', '/consumers/:group/instances/:instance', (req, res) => {
    const key = `${req.params.group}/${req.params.instance}`
    service.state.consumers.delete(key)
    res.statusCode = 204
    res.end()
  })

  service.on('GET', '/consumers/:group/instances/:instance/records', (req, res) => {
    const key = `${req.params.group}/${req.params.instance}`
    const consumer = service.state.consumers.get(key)

    if (!consumer) {
      json(res, 404, { error_code: 404, message: 'Consumer not found' })
      return
    }

    json(res, 200, [])
  })

  service.on('POST', '/consumers/:group/instances/:instance/offsets', (req, res) => {
    json(res, 200, { committed: true })
  })

  return service
}

/**
 * AWS SQS.
 *
 * The SQS API: queues, messages, and dead letter queues.
 * The shapes match AWS SQS API.
 *
 * The reference decides: a queue with `success` succeeds, `failed` fails.
 */
export function createSqsMock() {
  const service = new MockService('sqs')

  service.state.queues = new Map()
  service.state.messages = new Map()
  service.state.dlqs = new Map()

  let queueId = 1000
  let msgId = 2000

  const nextQueueId = () => `https://sqs.us-east-1.mock.amazonaws.com/queue_${queueId++}`
  const nextMsgId = () => `msg_${msgId++}`

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'sqs-mock' })
  })

  service.on('GET', '/', (req, res) => {
    const prefix = req.query.QueueNamePrefix
    const queues = [...service.state.queues.values()]
      .filter(q => !prefix || q.QueueUrl.includes(prefix))
      .slice(0, 1000)
      .map(q => ({ QueueUrl: q.QueueUrl }))

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListQueuesResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/">
  <ListQueuesResult>
${queues.map(q => `    <QueueUrl>${q.QueueUrl}</QueueUrl>`).join('\n')}
  </ListQueuesResult>
  <ResponseMetadata>
    <RequestId>mock-request-id</RequestId>
  </ResponseMetadata>
</ListQueuesResponse>`

    res.setHeader('content-type', 'application/xml')
    res.end(xml)
  })

  service.on('POST', '/', (req, res) => {
    const action = req.query.Action
    if (action !== 'CreateQueue') {
      json(res, 400, { Error: { Code: 'InvalidAction', Message: 'Unknown action' } })
      return
    }

    const name = req.query.QueueName
    if (!name) {
      res.setHeader('content-type', 'application/xml')
      res.end(`<?xml version="1.0"?><ErrorResponse><Error><Code>MissingParameter</Code><Message>QueueName is required</Message></ErrorResponse>`)
      return
    }

    const isFailed = failed(name)
    const queueUrl = `https://sqs.us-east-1.mock.amazonaws.com/queue_${queueId++}`

    if (isFailed) {
      res.setHeader('content-type', 'application/xml')
      res.statusCode = 400
      res.end(`<?xml version="1.0"?><ErrorResponse><Error><Code>QueueCreationFailed</Code><Message>Failed to create queue</Message></ErrorResponse>`)
      return
    }

    const queue = {
      QueueUrl: queueUrl,
      Name: name,
      Attributes: {
        DelaySeconds: '0',
        MaximumMessageSize: '262144',
        MessageRetentionPeriod: '345600',
        ReceiveMessageWaitTimeSeconds: '0',
        VisibilityTimeout: '30',
      },
    }

    service.state.queues.set(queueUrl, queue)
    service.state.messages.set(queueUrl, [])

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CreateQueueResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/">
  <CreateQueueResult>
    <QueueUrl>${queueUrl}</QueueUrl>
  </CreateQueueResult>
  <ResponseMetadata>
    <RequestId>mock-request-id</RequestId>
  </ResponseMetadata>
</CreateQueueResponse>`

    res.setHeader('content-type', 'application/xml')
    res.end(xml)
  })

  service.on('POST', '/', (req, res) => {
    const action = req.query.Action
    if (action === 'DeleteQueue') {
      const queueUrl = req.query.QueueUrl
      if (!queueUrl || !service.state.queues.has(queueUrl)) {
        res.setHeader('content-type', 'application/xml')
        res.statusCode = 404
        res.end(`<?xml version="1.0"?><ErrorResponse><Error><Code>NonExistentQueue</Code><Message>Queue does not exist</Message></ErrorResponse>`)
        return
      }
      service.state.queues.delete(queueUrl)
      service.state.messages.delete(queueUrl)
      res.setHeader('content-type', 'application/xml')
      res.end(`<?xml version="1.0"?><DeleteQueueResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/"><ResponseMetadata><RequestId>mock</RequestId></ResponseMetadata></DeleteQueueResponse>`)
      return
    }
  })

  service.on('POST', '/', (req, res) => {
    const action = req.query.Action
    if (action !== 'SendMessage') {
      return
    }

    const queueUrl = req.query.QueueUrl
    const body = req.body ?? {}

    if (!queueUrl || !service.state.queues.has(queueUrl)) {
      res.setHeader('content-type', 'application/xml')
      res.statusCode = 404
      res.end(`<?xml version="1.0"?><ErrorResponse><Error><Code>NonExistentQueue</Code><Message>Queue does not exist</Message></ErrorResponse>`)
      return
    }

    const isFailed = failed(body.MessageBody ?? '')
    const msgIdVal = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    if (isFailed) {
      res.setHeader('content-type', 'application/xml')
      res.statusCode = 400
      res.end(`<?xml version="1.0"?><ErrorResponse><Error><Code>SendFailed</Code><Message>Failed to send message</Message></ErrorResponse>`)
      return
    }

    const message = {
      MessageId: msgIdVal,
      Body: body.MessageBody ?? '',
      MD5OfBody: require('crypto').createHash('md5').update(body.MessageBody ?? '').digest('hex'),
      Attributes: body.MessageAttributes ?? {},
    }

    const queueMessages = service.state.messages.get(queueUrl) ?? []
    queueMessages.push(message)
    service.state.messages.set(queueUrl, queueMessages)

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<SendMessageResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/">
  <SendMessageResult>
    <MessageId>${msgIdVal}</MessageId>
    <MD5OfMessageBody>${message.MD5OfBody}</MD5OfMessageBody>
  </SendMessageResult>
  <ResponseMetadata>
    <RequestId>mock-request-id</RequestId>
  </ResponseMetadata>
</SendMessageResponse>`

    res.setHeader('content-type', 'application/xml')
    res.end(xml)
  })

  service.on('POST', '/', (req, res) => {
    const action = req.query.Action
    if (action !== 'ReceiveMessage') {
      return
    }

    const queueUrl = req.query.QueueUrl
    const maxNumber = Number(req.query.MaxNumberOfMessages ?? 1)
    const waitTime = Number(req.query.WaitTimeSeconds ?? 0)

    if (!queueUrl || !service.state.queues.has(queueUrl)) {
      res.setHeader('content-type', 'application/xml')
      res.statusCode = 404
      res.end(`<?xml version="1.0"?><ErrorResponse><Error><Code>NonExistentQueue</Code><Message>Queue does not exist</Message></ErrorResponse>`)
      return
    }

    const messages = service.state.messages.get(queueUrl) ?? []
    const received = messages.splice(0, maxNumber)

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ReceiveMessageResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/">
  <ReceiveMessageResult>
${received.map(m => `    <Message>
      <MessageId>${m.MessageId}</MessageId>
      <ReceiptHandle>${m.MessageId}</ReceiptHandle>
      <MD5OfBody>${m.MD5OfBody}</MD5OfBody>
      <Body>${m.Body}</Body>
    </Message>`).join('\n')}
  </ReceiveMessageResult>
  <ResponseMetadata>
    <RequestId>mock-request-id</RequestId>
  </ResponseMetadata>
</ReceiveMessageResponse>`

    res.setHeader('content-type', 'application/xml')
    res.end(xml)
  })

  service.on('POST', '/', (req, res) => {
    const action = req.query.Action
    if (action !== 'DeleteMessage') {
      return
    }

    const queueUrl = req.query.QueueUrl
    const receiptHandle = req.query.ReceiptHandle

    const messages = service.state.messages.get(queueUrl) ?? []
    const idx = messages.findIndex(m => m.MessageId === receiptHandle)
    if (idx !== -1) {
      messages.splice(idx, 1)
    }

    res.setHeader('content-type', 'application/xml')
    res.end(`<?xml version="1.0"?><DeleteMessageResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/"><ResponseMetadata><RequestId>mock</RequestId></ResponseMetadata></DeleteMessageResponse>`)
  })

  service.on('POST', '/', (req, res) => {
    const action = req.query.Action
    if (action !== 'GetQueueAttributes') {
      return
    }

    const queueUrl = req.query.QueueUrl
    const queue = service.state.queues.get(queueUrl)
    if (!queue) {
      res.setHeader('content-type', 'application/xml')
      res.statusCode = 404
      res.end(`<?xml version="1.0"?><ErrorResponse><Error><Code>NonExistentQueue</Code><Message>Queue does not exist</Message></ErrorResponse>`)
      return
    }

    const messages = service.state.messages.get(queueUrl) ?? []
    const attrs = {
      ApproximateNumberOfMessages: String(messages.length),
      ApproximateNumberOfMessagesNotVisible: '0',
      ApproximateNumberOfMessagesDelayed: '0',
      ...queue.Attributes,
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<GetQueueAttributesResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/">
  <GetQueueAttributesResult>
${Object.entries(attrs).map(([k, v]) => `    <Attribute>
      <Name>${k}</Name>
      <Value>${v}</Value>
    </Attribute>`).join('\n')}
  </GetQueueAttributesResult>
  <ResponseMetadata>
    <RequestId>mock-request-id</RequestId>
  </ResponseMetadata>
</GetQueueAttributesResponse>`

    res.setHeader('content-type', 'application/xml')
    res.end(xml)
  })

  return service
}

/**
 * Google Cloud Pub/Sub.
 *
 * The Pub/Sub API: topics, subscriptions, and messages.
 * The shapes match Google Cloud Pub/Sub REST API.
 *
 * The reference decides: a topic with `success` succeeds, `failed` fails.
 */
export function createPubsubMock() {
  const service = new MockService('pubsub')

  service.state.topics = new Map()
  service.state.subscriptions = new Map()
  service.state.messages = new Map()

  let topicId = 1000
  let subId = 2000
  let msgId = 3000

  const nextTopicId = () => `projects/mock-project/topics/topic_${topicId++}`
  const nextSubId = () => `projects/mock-project/subscriptions/sub_${subId++}`
  const nextMsgId = () => `msg_${msgId++}`

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'pubsub-mock' })
  })

  service.on('GET', '/v1/projects/:project/topics', (req, res) => {
    const topics = [...service.state.topics.keys()].map(name => ({ name }))
    json(res, 200, { topics })
  })

  service.on('POST', '/v1/projects/:project/topics', (req, res) => {
    const body = req.body ?? {}
    const name = body.name ?? `projects/mock-project/topics/topic_${nextTopicId()}`
    const isFailed = failed(name)

    const topic = { name }
    service.state.topics.set(name, topic)
    service.state.messages.set(name, [])

    if (isFailed) {
      json(res, 400, { error: { code: 400, message: 'Failed to create topic', status: 'INVALID_ARGUMENT' } })
      return
    }

    json(res, 201, topic)
  })

  service.on('GET', '/v1/:topic', (req, res) => {
    const topic = req.params.topic
    if (!service.state.topics.has(topic)) {
      json(res, 404, { error: { code: 404, message: 'Topic not found', status: 'NOT_FOUND' } })
      return
    }
    json(res, 200, topic)
  })

  service.on('DELETE', '/v1/:topic', (req, res) => {
    const topic = req.params.topic
    service.state.topics.delete(topic)
    service.state.messages.delete(topic)
    res.statusCode = 204
    res.end()
  })

  service.on('POST', '/v1/:topic:publish', (req, res) => {
    const topic = req.params.topic
    const body = req.body ?? {}
    const messages = body.messages ?? []
    const isFailed = failed(topic)

    const messageIds = messages.map(() => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)

    if (isFailed) {
      json(res, 400, { error: { code: 400, message: 'Failed to publish', status: 'INVALID_ARGUMENT' } })
      return
    }

    json(res, 200, { messageIds })
  })

  service.on('GET', '/v1/projects/:project/subscriptions', (req, res) => {
    const subs = [...service.state.subscriptions.values()]
    json(res, 200, { subscriptions: subs })
  })

  service.on('POST', '/v1/projects/:project/subscriptions', (req, res) => {
    const body = req.body ?? {}
    const name = body.name ?? `projects/mock-project/subscriptions/sub_${nextSubId()}`
    const topic = body.topic
    const isFailed = failed(name)

    if (!topic) {
      json(res, 400, { error: { code: 400, message: 'topic is required', status: 'INVALID_ARGUMENT' } })
      return
    }

    const sub = {
      name,
      topic,
      pushConfig: body.pushConfig ?? {},
      ackDeadlineSeconds: body.ackDeadlineSeconds ?? 10,
      retainAckedMessages: body.retainAckedMessages ?? false,
      messageRetentionDuration: body.messageRetentionDuration ?? '604800s',
    }

    service.state.subscriptions.set(name, sub)

    if (isFailed) {
      json(res, 400, { error: { code: 400, message: 'Failed to create subscription', status: 'INVALID_ARGUMENT' } })
      return
    }

    json(res, 201, sub)
  })

  service.on('DELETE', '/v1/:subscription', (req, res) => {
    service.state.subscriptions.delete(req.params.subscription)
    res.statusCode = 204
    res.end()
  })

  service.on('POST', '/v1/:subscription:pull', (req, res) => {
    const subscription = req.params.subscription
    const body = req.body ?? {}
    const maxMessages = body.maxMessages ?? 100

    const sub = service.state.subscriptions.get(subscription)
    if (!sub) {
      json(res, 404, { error: { code: 404, message: 'Subscription not found', status: 'NOT_FOUND' } })
      return
    }

    const topicMessages = service.state.messages.get(sub.topic) ?? []
    const pulled = topicMessages.splice(0, maxMessages).map(m => ({
      message: m,
      ackId: `ack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }))

    json(res, 200, { receivedMessages: pulled })
  })

  service.on('POST', '/v1/:subscription:acknowledge', (req, res) => {
    json(res, 200, {})
  })

  service.on('POST', '/v1/:subscription:push', (req, res) => {
    json(res, 200, {})
  })

  return service
}

/**
 * Redis Streams.
 *
 * The Redis Streams API: XADD, XREAD, XRANGE, XGROUP, XCLAIM.
 * The shapes match Redis RESP protocol (simulated over HTTP).
 *
 * The reference decides: a stream with `success` succeeds, `failed` fails.
 */
export function createRedisStreamsMock() {
  const service = new MockService('redis-streams')

  service.state.streams = new Map()
  service.state.groups = new Map()

  let entryId = 1000

  const nextEntryId = () => `${Date.now()}-${entryId++}`
  const nextGroupId = () => `group_${Date.now()}`

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'redis-streams-mock' })
  })

  service.on('POST', '/streams/:key/add', (req, res) => {
    const key = req.params.key
    const body = req.body ?? {}
    const isFailed = failed(key)

    const id = body.id ?? nextEntryId()
    const fields = body.fields ?? {}

    if (!service.state.streams.has(key)) {
      service.state.streams.set(key, [])
    }

    const entry = {
      id,
      fields,
      timestamp: Date.now(),
    }

    service.state.streams.get(key).push(entry)

    if (isFailed) {
      json(res, 400, { error: 'Failed to add entry' })
      return
    }

    json(res, 201, { id })
  })

  service.on('GET', '/streams/:key/range', (req, res) => {
    const key = req.params.key
    const start = req.query.start ?? '-'
    const end = req.query.end ?? '+'
    const count = Number(req.query.count ?? 100)

    const stream = service.state.streams.get(key) ?? []
    const filtered = stream.filter(e => {
      if (start !== '-' && e.id < start) return false
      if (end !== '+' && e.id > end) return false
      return true
    }).slice(0, count)

    json(res, 200, filtered.map(e => [e.id, Object.entries(e.fields).flat()]))
  })

  service.on('POST', '/streams/read', (req, res) => {
    const body = req.body ?? {}
    const streams = body.streams ?? []
    const count = body.count ?? 100
    const block = body.block ?? 0

    const results = []

    for (const stream of streams) {
      const key = stream.key
      const id = stream.id ?? '0-0'
      const streamData = service.state.streams.get(key) ?? []
      const entries = streamData.filter(e => e.id > id).slice(0, count)

      if (entries.length > 0) {
        results.push({
          key,
          entries: entries.map(e => [e.id, Object.entries(e.fields).flat()]),
        })
      }
    }

    json(res, 200, results)
  })

  service.on('POST', '/streams/:key/groups', (req, res) => {
    const key = req.params.key
    const body = req.body ?? {}
    const groupName = body.groupname
    const id = body.id ?? '$'

    if (!groupName) {
      json(res, 400, { error: 'GROUPNAME required' })
      return
    }

    if (!service.state.groups.has(key)) {
      service.state.groups.set(key, new Map())
    }

    const groups = service.state.groups.get(key)
    if (groups.has(groupName)) {
      json(res, 400, { error: 'BUSYGROUP Consumer Group name already exists' })
      return
    }

    groups.set(groupName, { id, consumers: new Map(), pending: [] })
    json(res, 201, { ok: true })
  })

  service.on('POST', '/streams/:key/groups/:group/read', (req, res) => {
    const key = req.params.key
    const group = req.params.group
    const body = req.body ?? {}
    const consumer = body.consumer
    const count = body.count ?? 100

    if (!consumer) {
      json(res, 400, { error: 'CONSUMER required' })
      return
    }

    const stream = service.state.streams.get(key) ?? []
    const groupData = service.state.groups.get(key)?.get(group)

    if (!groupData) {
      json(res, 400, { error: 'NOGROUP Consumer Group not found' })
      return
    }

    const available = stream.filter(e => !e.delivered).slice(0, body.count ?? 100)
    const results = available.map(e => {
      e.delivered = true
      groupData.pending.push({ id: e.id, consumer, deliveredAt: Date.now() })
      return [e.id, Object.entries(e.fields).flat()]
    })

    json(res, 200, [{ key, entries: results }])
  })

  service.on('POST', '/streams/:key/groups/:group/ack', (req, res) => {
    const key = req.params.key
    const group = req.params.group
    const body = req.body ?? {}
    const ids = body.ids ?? []

    const groupData = service.state.groups.get(key)?.get(group)
    if (groupData) {
      groupData.pending = groupData.pending.filter(p => !ids.includes(p.id))
    }

    json(res, 200, { acknowledged: ids.length })
  })

  service.on('GET', '/streams/:key/groups/:group/pending', (req, res) => {
    const key = req.params.key
    const group = req.params.group

    const groupData = service.state.groups.get(key)?.get(group)
    if (!groupData) {
      json(res, 400, { error: 'NOGROUP' })
      return
    }

    json(res, 200, {
      pending: groupData.pending.length,
      min: groupData.pending[0]?.id ?? '0-0',
      max: groupData.pending[groupData.pending.length - 1]?.id ?? '0-0',
      consumers: Array.from(groupData.consumers.keys()).map(c => [c, groupData.pending.filter(p => p.consumer === c).length]),
    })
  })

  service.on('POST', '/streams/:key/groups/:group/claim', (req, res) => {
    const key = req.params.key
    const group = req.params.group
    const body = req.body ?? {}
    const consumer = body.consumer
    const minIdleTime = body.min_idle_time ?? 0
    const ids = body.ids ?? []

    const groupData = service.state.groups.get(key)?.get(group)
    if (!groupData) {
      json(res, 400, { error: 'NOGROUP' })
      return
    }

    const claimed = groupData.pending
      .filter(p => ids.includes(p.id) && Date.now() - p.deliveredAt >= minIdleTime)
      .map(p => {
        p.consumer = consumer
        p.deliveredAt = Date.now()
        return p.id
      })

    json(res, 200, { claimed })
  })

  return service
}
