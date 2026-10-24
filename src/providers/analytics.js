import { MockService, json, counter } from '../harness.js'

/**
 * Segment.
 *
 * The Segment API: track, identify, group, alias, and page.
 * The shapes match Segment's API.
 *
 * The reference decides: a track event with `success` succeeds, `failed` fails.
 */
export function createSegmentMock() {
  const service = new MockService('segment')

  service.state.events = []
  service.state.users = new Map()
  service.state.groups = new Map()

  let eventId = 1000

  const nextEventId = () => `evt_${eventId++}`

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'segment-mock' })
  })

  // Track
  service.on('POST', '/v1/track', (req, res) => {
    const body = req.json ?? {}
    const event = body.event ?? 'Test Event'
    const userId = body.userId ?? body.anonymousId

    if (!userId) {
      json(res, 400, { error: 'userId or anonymousId is required' })
      return
    }

    const isFailed = failed(event)
    const id = nextEventId()

    const trackedEvent = {
      id,
      type: 'track',
      event,
      userId,
      anonymousId: body.anonymousId ?? null,
      properties: body.properties ?? {},
      context: body.context ?? { library: { name: 'analytics.js', version: '1.0.0' } },
      timestamp: body.timestamp ?? new Date().toISOString(),
      messageId: id,
    }

    service.state.events.push(trackedEvent)

    if (isFailed) {
      json(res, 400, { error: 'Failed to track event', code: 'TRACK_FAILED' })
      return
    }

    json(res, 200, { success: true, messageId: id })
  })

  // Identify
  service.on('POST', '/v1/identify', (req, res) => {
    const body = req.json ?? {}
    const userId = body.userId

    if (!userId) {
      json(res, 400, { error: 'userId is required' })
      return
    }

    const isFailed = failed(userId)

    const user = {
      userId,
      traits: body.traits ?? { name: 'Test User', email: 'user@example.com' },
      timestamp: new Date().toISOString(),
    }

    service.state.users.set(userId, user)

    if (isFailed) {
      json(res, 400, { error: 'Failed to identify user', code: 'IDENTIFY_FAILED' })
      return
    }

    json(res, 200, { success: true, userId })
  })

  // Group
  service.on('POST', '/v1/group', (req, res) => {
    const body = req.json ?? {}
    const groupId = body.groupId
    const userId = body.userId

    if (!groupId || !userId) {
      json(res, 400, { error: 'groupId and userId are required' })
      return
    }

    const isFailed = failed(groupId)

    const group = {
      groupId,
      userId,
      traits: body.traits ?? { name: 'Test Company', employees: 100 },
      timestamp: new Date().toISOString(),
    }

    service.state.groups.set(groupId, group)

    if (isFailed) {
      json(res, 400, { error: 'Failed to group user', code: 'GROUP_FAILED' })
      return
    }

    json(res, 200, { success: true, groupId })
  })

  // Alias
  service.on('POST', '/v1/alias', (req, res) => {
    const body = req.json ?? {}
    const userId = body.userId
    const previousId = body.previousId

    if (!userId || !previousId) {
      json(res, 400, { error: 'userId and previousId are required' })
      return
    }

    const isFailed = failed(userId)

    if (isFailed) {
      json(res, 400, { error: 'Failed to alias user', code: 'ALIAS_FAILED' })
      return
    }

    json(res, 200, { success: true, userId, previousId })
  })

  // Page
  service.on('POST', '/v1/page', (req, res) => {
    const body = req.json ?? {}
    const userId = body.userId ?? body.anonymousId
    const name = body.name ?? 'Test Page'

    if (!userId) {
      json(res, 400, { error: 'userId or anonymousId is required' })
      return
    }

    const isFailed = failed(name)

    const page = {
      userId,
      name,
      properties: body.properties ?? {},
      timestamp: new Date().toISOString(),
    }

    service.state.events.push({ ...page, type: 'page' })

    if (isFailed) {
      json(res, 400, { error: 'Failed to track page', code: 'PAGE_FAILED' })
      return
    }

    json(res, 200, { success: true })
  })

  // Batch
  service.on('POST', '/v1/batch', (req, res) => {
    const body = req.json ?? []
    const results = []

    for (const event of body) {
      const isFailed = failed(event.event ?? event.userId ?? event.groupId ?? event.userId ?? '')
      results.push({
        success: !isFailed,
        error: isFailed ? 'Failed' : null,
      })
    }

    json(res, 200, results)
  })

  return service
}

/**
 * Mixpanel.
 *
 * The Mixpanel API: track, engage, and export.
 * The shapes match Mixpanel's API.
 *
 * The reference decides: a track event with `success` succeeds, `failed` fails.
 */
export function createMixpanelMock() {
  const service = new MockService('mixpanel')

  service.state.events = []
  service.state.profiles = new Map()

  let eventId = 1000
  let importId = 2000

  const nextEventId = () => eventId++
  const nextImportId = () => `import_${importId++}`

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'mixpanel-mock' })
  })

  // Track
  service.on('POST', '/track', (req, res) => {
    const body = req.json ?? {}
    const event = body.event ?? 'Test Event'
    const distinctId = body.properties?.distinct_id ?? body.distinct_id

    if (!distinctId) {
      json(res, 400, { error: 'distinct_id is required' })
      return
    }

    const isFailed = failed(event)

    const trackedEvent = {
      event,
      properties: {
        ...body.properties,
        token: body.token ?? 'mock_token',
        time: Math.floor(Date.now() / 1000),
        distinct_id: distinctId,
        $insert_id: `evt_${nextEventId()}`,
      },
    }

    service.state.events.push(trackedEvent)

    if (isFailed) {
      json(res, 400, { error: 'Failed to track event', code: 'TRACK_FAILED' })
      return
    }

    json(res, 200, 1)
  })

  // Engage (profile update)
  service.on('POST', '/engage', (req, res) => {
    const body = req.json ?? {}
    const distinctId = body.$distinct_id ?? body.$set?.$distinct_id

    if (!distinctId) {
      json(res, 400, { error: 'distinct_id is required' })
      return
    }

    const isFailed = failed(distinctId)

    const profile = {
      $distinct_id: distinctId,
      $set: body.$set ?? { name: 'Test User', email: 'user@example.com' },
      $set_once: body.$set_once ?? {},
      $add: body.$add ?? {},
      $union: body.$union ?? {},
      $unset: body.$unset ?? [],
      $delete: body.$delete ?? false,
      $remove: body.$remove ?? {},
    }

    service.state.profiles.set(distinctId, profile)

    if (isFailed) {
      json(res, 400, { error: 'Failed to update profile', code: 'ENGAGE_FAILED' })
      return
    }

    json(res, 200, { status: 1, $distinct_id: distinctId })
  })

  // Import
  service.on('POST', '/import', (req, res) => {
    const body = req.json ?? []
    const isFailed = body.some((event) => failed(event.event ?? event.properties?.distinct_id))

    const importId = nextImportId()

    if (isFailed) {
      json(res, 400, { error: 'Failed to import events', code: 'IMPORT_FAILED' })
      return
    }

    for (const event of body) {
      service.state.events.push(event)
    }

    json(res, 200, { status: 1, import_id: importId })
  })

  // Export
  service.on('GET', '/export', (req, res) => {
    const fromDate = req.query.from_date ?? new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const toDate = req.query.to_date ?? new Date().toISOString().split('T')[0]

    const events = service.state.events.map((event, i) => ({
      event: event.event ?? 'Test Event',
      properties: {
        ...event.properties,
        time: event.properties?.time ?? Math.floor(Date.now() / 1000),
        distinct_id: event.properties?.distinct_id ?? `user_${i}`,
      },
    }))

    json(res, 200, events)
  })

  return service
}

/**
 * Amplitude.
 *
 * The Amplitude API: track, identify, and batch.
 * The shapes match Amplitude's API.
 *
 * The reference decides: a track event with `success` succeeds, `failed` fails.
 */
export function createAmplitudeMock() {
  const service = new MockService('amplitude')

  service.state.events = []
  service.state.identifications = []

  let eventId = 1000

  const nextEventId = () => `evt_${eventId++}`

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'amplitude-mock' })
  })

  // HTTP API v2 - Track
  service.on('POST', '/2/httpapi', (req, res) => {
    const body = req.json ?? {}
    const events = body.events ?? []

    const results = events.map((event) => {
      const eventName = event.event_type ?? event.event
      const userId = event.user_id
      const isFailed = failed(eventName)

      const trackedEvent = {
        event_type: eventName,
        user_id: userId,
        device_id: event.device_id,
        event_properties: event.event_properties ?? event.properties ?? {},
        user_properties: event.user_properties ?? {},
        timestamp: event.timestamp ?? Date.now(),
        insert_id: `evt_${nextEventId()}`,
        session_id: event.session_id ?? Math.floor(Date.now() / 1000) * 1000,
      }

      service.state.events.push(trackedEvent)

      return {
        insert_id: trackedEvent.insert_id,
        status: isFailed ? 400 : 200,
      }
    })

    const hasFailures = results.some((r) => r.status === 400)

    if (hasFailures) {
      json(res, 200, { code: 400, error: 'Some events failed', events: results })
      return
    }

    json(res, 200, { code: 200, events: results })
  })

  // Identify
  service.on('POST', '/identify', (req, res) => {
    const body = req.json ?? []
    const identifications = body.identifications ?? []

    const results = identifications.map((id) => {
      const userId = id.user_id
      const isFailed = failed(userId)

      const identification = {
        user_id: userId,
        device_id: id.device_id,
        user_properties: id.user_properties ?? {},
      }

      service.state.identifications.push(identification)

      return { user_id: userId, status: isFailed ? 400 : 200 }
    })

    const hasFailures = results.some((r) => r.status === 400)

    if (hasFailures) {
      json(res, 200, { code: 400, error: 'Some identifications failed', identifications: results })
      return
    }

    json(res, 200, { code: 200, identifications: results })
  })

  // Batch
  service.on('POST', '/batch', (req, res) => {
    const body = req.json ?? {}
    const uploads = body.uploads ?? []

    const results = uploads.map((upload) => {
      const isFailed = failed(upload.events?.[0]?.event_type ?? upload.events?.[0]?.event)
      return { status: isFailed ? 400 : 200 }
    })

    const hasFailures = results.some((r) => r.status === 400)

    if (hasFailures) {
      json(res, 200, { code: 400, error: 'Some uploads failed', uploads: results })
      return
    }

    json(res, 200, { code: 200, uploads: results })
  })

  return service
}

/**
 * RudderStack.
 *
 * The RudderStack API: track, identify, group, alias, and page.
 * The shapes match RudderStack's API (compatible with Segment).
 *
 * The reference decides: a track event with `success` succeeds, `failed` fails.
 */
export function createRudderStackMock() {
  const service = new MockService('rudderstack')

  service.state.events = []
  service.state.users = new Map()
  service.state.groups = new Map()

  let eventId = 1000

  const nextEventId = () => `evt_${eventId++}`

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'rudderstack-mock' })
  })

  // Track
  service.on('POST', '/v1/track', (req, res) => {
    const body = req.json ?? {}
    const event = body.event ?? 'Test Event'
    const userId = body.userId ?? body.anonymousId

    if (!userId) {
      json(res, 400, { error: 'userId or anonymousId is required', code: 'MISSING_USER_ID' })
      return
    }

    const isFailed = failed(event)
    const id = nextEventId()

    const trackedEvent = {
      messageId: id,
      type: 'track',
      event,
      userId,
      anonymousId: body.anonymousId ?? null,
      properties: body.properties ?? {},
      context: body.context ?? { library: { name: 'rudderstack-js', version: '1.0.0' } },
      timestamp: body.timestamp ?? new Date().toISOString(),
    }

    service.state.events.push(trackedEvent)

    if (isFailed) {
      json(res, 400, { error: 'Failed to track event', code: 'TRACK_FAILED' })
      return
    }

    json(res, 200, { success: true, messageId: id })
  })

  // Identify
  service.on('POST', '/v1/identify', (req, res) => {
    const body = req.json ?? {}
    const userId = body.userId

    if (!userId) {
      json(res, 400, { error: 'userId is required', code: 'MISSING_USER_ID' })
      return
    }

    const isFailed = failed(userId)

    const user = {
      userId,
      traits: body.traits ?? { name: 'Test User', email: 'user@example.com' },
      timestamp: new Date().toISOString(),
    }

    service.state.users.set(userId, user)

    if (isFailed) {
      json(res, 400, { error: 'Failed to identify user', code: 'IDENTIFY_FAILED' })
      return
    }

    json(res, 200, { success: true, userId })
  })

  // Group
  service.on('POST', '/v1/group', (req, res) => {
    const body = req.json ?? {}
    const groupId = body.groupId
    const userId = body.userId

    if (!groupId || !userId) {
      json(res, 400, { error: 'groupId and userId are required', code: 'MISSING_GROUP_OR_USER' })
      return
    }

    const isFailed = failed(groupId)

    const group = {
      groupId,
      userId,
      traits: body.traits ?? { name: 'Test Company', employees: 100 },
      timestamp: new Date().toISOString(),
    }

    service.state.groups.set(groupId, group)

    if (isFailed) {
      json(res, 400, { error: 'Failed to group user', code: 'GROUP_FAILED' })
      return
    }

    json(res, 200, { success: true, groupId })
  })

  // Alias
  service.on('POST', '/v1/alias', (req, res) => {
    const body = req.json ?? {}
    const userId = body.userId
    const previousId = body.previousId

    if (!userId || !previousId) {
      json(res, 400, { error: 'userId and previousId are required', code: 'MISSING_USER_OR_PREVIOUS' })
      return
    }

    const isFailed = failed(userId)

    if (isFailed) {
      json(res, 400, { error: 'Failed to alias user', code: 'ALIAS_FAILED' })
      return
    }

    json(res, 200, { success: true, userId, previousId })
  })

  // Page
  service.on('POST', '/v1/page', (req, res) => {
    const body = req.json ?? {}
    const userId = body.userId ?? body.anonymousId
    const name = body.name ?? 'Test Page'

    if (!userId) {
      json(res, 400, { error: 'userId or anonymousId is required', code: 'MISSING_USER_ID' })
      return
    }

    const isFailed = failed(name)

    const page = {
      userId,
      name,
      properties: body.properties ?? {},
      timestamp: new Date().toISOString(),
    }

    service.state.events.push({ ...page, type: 'page' })

    if (isFailed) {
      json(res, 400, { error: 'Failed to track page', code: 'PAGE_FAILED' })
      return
    }

    json(res, 200, { success: true })
  })

  // Batch
  service.on('POST', '/v1/batch', (req, res) => {
    const body = req.json ?? []
    const results = []

    for (const event of body) {
      const isFailed = failed(event.event ?? event.userId ?? event.groupId ?? event.userId ?? '')
      results.push({
        success: !isFailed,
        error: isFailed ? 'Failed' : null,
      })
    }

    json(res, 200, results)
  })

  return service
}
