import { MockService, json, counter } from '../harness.js'

/**
 * HubSpot.
 *
 * The HubSpot API: contacts, companies, deals, and tickets.
 * The shapes match HubSpot's API.
 *
 * The reference decides: a contact with `success` succeeds, `failed` fails.
 */
export function createHubspotMock() {
  const service = new MockService('hubspot')

  service.state.contacts = new Map()
  service.state.companies = new Map()
  service.state.deals = new Map()
  service.state.tickets = new Map()

  let contactId = 1000
  let companyId = 2000
  let dealId = 3000
  let ticketId = 4000

  const nextContactId = () => contactId++
  const nextCompanyId = () => companyId++
  const nextDealId = () => dealId++
  const nextTicketId = () => ticketId++

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'hubspot-mock' })
  })

  // OAuth token endpoint
  service.on('POST', '/oauth/v1/token', (req, res) => {
    json(res, 200, {
      access_token: 'mock_hubspot_token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'mock_refresh_token',
    })
  })

  // Contacts
  service.on('POST', '/crm/v3/objects/contacts', (req, res) => {
    const body = req.json ?? {}
    const properties = body.properties ?? {}
    const email = properties.email

    if (!email) {
      json(res, 400, { status: 'error', message: 'email is required', correlationId: 'mock' })
      return
    }

    const isFailed = failed(email)
    const id = String(nextContactId())

    const contact = {
      id,
      properties: {
        ...properties,
        createdate: new Date().toISOString(),
        hs_object_id: id,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: isFailed,
    }

    service.state.contacts.set(id, contact)

    if (isFailed) {
      json(res, 400, { status: 'error', message: 'Failed to create contact', correlationId: 'mock' })
      return
    }

    json(res, 201, contact)
  })

  service.on('GET', '/crm/v3/objects/contacts', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const contacts = [...service.state.contacts.values()].slice(0, limit)
    json(res, 200, { results: contacts, total: contacts.length })
  })

  service.on('GET', '/crm/v3/objects/contacts/:id', (req, res) => {
    const id = String(req.params.id)
    const contact = service.state.contacts.get(id)

    if (!contact) {
      json(res, 404, { status: 'error', message: 'Contact not found', correlationId: 'mock' })
      return
    }

    json(res, 200, contact)
  })

  // Companies
  service.on('POST', '/crm/v3/objects/companies', (req, res) => {
    const body = req.json ?? {}
    const properties = body.properties ?? {}
    const name = properties.name

    if (!name) {
      json(res, 400, { status: 'error', message: 'name is required', correlationId: 'mock' })
      return
    }

    const isFailed = failed(name)
    const id = String(nextCompanyId())

    const company = {
      id,
      properties: {
        ...properties,
        createdate: new Date().toISOString(),
        hs_object_id: id,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: isFailed,
    }

    service.state.companies.set(id, company)

    if (isFailed) {
      json(res, 400, { status: 'error', message: 'Failed to create company', correlationId: 'mock' })
      return
    }

    json(res, 201, company)
  })

  service.on('GET', '/crm/v3/objects/companies', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const companies = [...service.state.companies.values()].slice(0, limit)
    json(res, 200, { results: companies, total: companies.length })
  })

  // Deals
  service.on('POST', '/crm/v3/objects/deals', (req, res) => {
    const body = req.json ?? {}
    const properties = body.properties ?? {}
    const dealname = properties.dealname

    if (!dealname) {
      json(res, 400, { status: 'error', message: 'dealname is required', correlationId: 'mock' })
      return
    }

    const isFailed = failed(dealname)
    const id = String(nextDealId())

    const deal = {
      id,
      properties: {
        ...properties,
        createdate: new Date().toISOString(),
        hs_object_id: id,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: isFailed,
    }

    service.state.deals.set(id, deal)

    if (isFailed) {
      json(res, 400, { status: 'error', message: 'Failed to create deal', correlationId: 'mock' })
      return
    }

    json(res, 201, deal)
  })

  service.on('GET', '/crm/v3/objects/deals', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const deals = [...service.state.deals.values()].slice(0, limit)
    json(res, 200, { results: deals, total: deals.length })
  })

  // Tickets
  service.on('POST', '/crm/v3/objects/tickets', (req, res) => {
    const body = req.json ?? {}
    const properties = body.properties ?? {}
    const subject = properties.subject

    if (!subject) {
      json(res, 400, { status: 'error', message: 'subject is required', correlationId: 'mock' })
      return
    }

    const isFailed = failed(subject)
    const id = String(nextTicketId())

    const ticket = {
      id,
      properties: {
        ...properties,
        createdate: new Date().toISOString(),
        hs_object_id: id,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: isFailed,
    }

    service.state.tickets.set(id, ticket)

    if (isFailed) {
      json(res, 400, { status: 'error', message: 'Failed to create ticket', correlationId: 'mock' })
      return
    }

    json(res, 201, ticket)
  })

  service.on('GET', '/crm/v3/objects/tickets', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const tickets = [...service.state.tickets.values()].slice(0, limit)
    json(res, 200, { results: tickets, total: tickets.length })
  })

  return service
}

/**
 * Salesforce.
 *
 * The Salesforce REST API: sObjects, query, and bulk API.
 * The shapes match Salesforce's API.
 *
 * The reference decides: a record with `success` succeeds, `failed` fails.
 */
export function createSalesforceMock() {
  const service = new MockService('salesforce')

  service.state.objects = new Map()
  service.state.queryResults = []

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'salesforce-mock' })
  })

  // OAuth token endpoint
  service.on('POST', '/services/oauth2/token', (req, res) => {
    json(res, 200, {
      access_token: 'mock_salesforce_token',
      instance_url: 'https://mock.salesforce.com',
      id: 'https://login.salesforce.com/id/00Dxx/005xx',
      token_type: 'Bearer',
      issued_at: String(Date.now()),
      signature: 'mock_signature',
    })
  })

  // SObject - Create
  service.on('POST', '/services/data/v58.0/sobjects/:objectName', (req, res) => {
    const objectName = String(req.params.objectName)
    const body = req.json ?? {}

    const isFailed = failed(JSON.stringify(body))
    const id = `${objectName}_${Date.now()}`

    const record = {
      id,
      success: !isFailed,
      errors: isFailed ? [{ statusCode: 'ERROR', message: 'Failed to create record', fields: [] }] : [],
    }

    if (!service.state.objects.has(objectName)) {
      service.state.objects.set(objectName, new Map())
    }
    service.state.objects.get(objectName).set(id, { ...body, Id: id })

    if (isFailed) {
      json(res, 400, record)
      return
    }

    json(res, 201, record)
  })

  // SObject - Get
  service.on('GET', '/services/data/v58.0/sobjects/:objectName/:id', (req, res) => {
    const objectName = String(req.params.objectName)
    const id = String(req.params.id)

    const objectMap = service.state.objects.get(objectName)
    if (!objectMap || !objectMap.has(id)) {
      json(res, 404, [{ errorCode: 'NOT_FOUND', message: 'The requested resource does not exist' }])
      return
    }

    json(res, 200, objectMap.get(id))
  })

  // SObject - Update
  service.on('PATCH', '/services/data/v58.0/sobjects/:objectName/:id', (req, res) => {
    const objectName = String(req.params.objectName)
    const id = String(req.params.id)
    const body = req.json ?? {}

    const objectMap = service.state.objects.get(objectName)
    if (!objectMap || !objectMap.has(id)) {
      json(res, 404, [{ errorCode: 'NOT_FOUND', message: 'The requested resource does not exist' }])
      return
    }

    const updated = { ...objectMap.get(id), ...body }
    objectMap.set(id, updated)
    json(res, 204, '')
  })

  // Query
  service.on('GET', '/services/data/v58.0/query', (req, res) => {
    const q = String(req.query.q ?? '')
    const isFailed = failed(q)

    const records = isFailed
      ? []
      : [
          {
            attributes: { type: 'Account', url: '/services/data/v58.0/sobjects/Account/001xx' },
            Id: '001xx',
            Name: 'Test Account',
          },
        ]

    json(res, 200, {
      totalSize: records.length,
      done: true,
      records,
    })
  })

  // Query All
  service.on('GET', '/services/data/v58.0/queryAll', (req, res) => {
    const q = String(req.query.q ?? '')
    const isFailed = failed(q)

    const records = isFailed
      ? []
      : [
          {
            attributes: { type: 'Account', url: '/services/data/v58.0/sobjects/Account/001xx' },
            Id: '001xx',
            Name: 'Test Account',
          },
        ]

    json(res, 200, {
      totalSize: records.length,
      done: true,
      records,
    })
  })

  // Composite (batch)
  service.on('POST', '/services/data/v58.0/composite', (req, res) => {
    const body = req.json ?? {}
    const compositeRequest = body.compositeRequest ?? []

    const compositeResponse = compositeRequest.map((req, i) => {
      const isFailed = failed(JSON.stringify(req))
      return {
        httpStatusCode: isFailed ? 400 : 201,
        body: isFailed
          ? [{ errorCode: 'ERROR', message: 'Failed' }]
          : { id: `rec_${i}`, success: true },
        referenceId: req.referenceId ?? `ref${i}`,
      }
    })

    json(res, 200, { compositeResponse })
  })

  return service
}

/**
 * Pipedrive.
 *
 * The Pipedrive API: persons, organizations, deals, and activities.
 * The shapes match Pipedrive's API.
 *
 * The reference decides: a person with `success` succeeds, `failed` fails.
 */
export function createPipedriveMock() {
  const service = new MockService('pipedrive')

  service.state.persons = new Map()
  service.state.organizations = new Map()
  service.state.deals = new Map()
  service.state.activities = new Map()

  let personId = 1000
  let orgId = 2000
  let dealId = 3000
  let activityId = 4000

  const nextPersonId = () => personId++
  const nextOrgId = () => orgId++
  const nextDealId = () => dealId++
  const nextActivityId = () => activityId++

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'pipedrive-mock' })
  })

  // Persons
  service.on('POST', '/v1/persons', (req, res) => {
    const body = req.json ?? {}
    const name = body.name

    if (!name) {
      json(res, 400, { success: false, error: 'name is required', error_info: 'name is required' })
      return
    }

    const isFailed = failed(name)
    const id = nextPersonId()

    const person = {
      id,
      name,
      owner_id: body.owner_id ?? 1,
      org_id: body.org_id ?? null,
      email: body.email ?? [{ value: 'test@example.com', primary: true }],
      phone: body.phone ?? [{ value: '555-1234', primary: true }],
      add_time: new Date().toISOString(),
      update_time: new Date().toISOString(),
      active_flag: !isFailed,
    }

    service.state.persons.set(id, person)

    if (isFailed) {
      json(res, 400, { success: false, error: 'Failed to create person', error_info: 'Failed to create person' })
      return
    }

    json(res, 201, { success: true, data: person })
  })

  service.on('GET', '/v1/persons', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const persons = [...service.state.persons.values()].slice(0, limit)
    json(res, 200, { success: true, data: persons, additional_data: { pagination: { start: 0, limit, more_items_in_collection: false } } })
  })

  service.on('GET', '/v1/persons/:id', (req, res) => {
    const id = String(req.params.id)
    const person = service.state.persons.get(id)

    if (!person) {
      json(res, 404, { success: false, error: 'Person not found', error_info: 'Person not found' })
      return
    }

    json(res, 200, { success: true, data: person })
  })

  // Organizations
  service.on('POST', '/v1/organizations', (req, res) => {
    const body = req.json ?? {}
    const name = body.name

    if (!name) {
      json(res, 400, { success: false, error: 'name is required', error_info: 'name is required' })
      return
    }

    const isFailed = failed(name)
    const id = nextOrgId()

    const org = {
      id,
      name,
      owner_id: body.owner_id ?? 1,
      address: body.address ?? '123 Main St',
      add_time: new Date().toISOString(),
      update_time: new Date().toISOString(),
      active_flag: !isFailed,
    }

    service.state.organizations.set(id, org)

    if (isFailed) {
      json(res, 400, { success: false, error: 'Failed to create organization', error_info: 'Failed to create organization' })
      return
    }

    json(res, 201, { success: true, data: org })
  })

  service.on('GET', '/v1/organizations', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const orgs = [...service.state.organizations.values()].slice(0, limit)
    json(res, 200, { success: true, data: orgs, additional_data: { pagination: { start: 0, limit, more_items_in_collection: false } } })
  })

  // Deals
  service.on('POST', '/v1/deals', (req, res) => {
    const body = req.json ?? {}
    const title = body.title

    if (!title) {
      json(res, 400, { success: false, error: 'title is required', error_info: 'title is required' })
      return
    }

    const isFailed = failed(title)
    const id = nextDealId()

    const deal = {
      id,
      title,
      value: body.value ?? 1000,
      currency: body.currency ?? 'USD',
      user_id: body.user_id ?? 1,
      person_id: body.person_id ?? null,
      org_id: body.org_id ?? null,
      stage_id: body.stage_id ?? 1,
      status: isFailed ? 'lost' : 'open',
      add_time: new Date().toISOString(),
      update_time: new Date().toISOString(),
      active_flag: !isFailed,
    }

    service.state.deals.set(id, deal)

    if (isFailed) {
      json(res, 400, { success: false, error: 'Failed to create deal', error_info: 'Failed to create deal' })
      return
    }

    json(res, 201, { success: true, data: deal })
  })

  service.on('GET', '/v1/deals', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const deals = [...service.state.deals.values()].slice(0, limit)
    json(res, 200, { success: true, data: deals, additional_data: { pagination: { start: 0, limit, more_items_in_collection: false } } })
  })

  // Activities
  service.on('POST', '/v1/activities', (req, res) => {
    const body = req.json ?? {}
    const subject = body.subject

    if (!subject) {
      json(res, 400, { success: false, error: 'subject is required', error_info: 'subject is required' })
      return
    }

    const isFailed = failed(subject)
    const id = nextActivityId()

    const activity = {
      id,
      subject,
      type: body.type ?? 'task',
      due_date: body.due_date ?? new Date().toISOString().split('T')[0],
      due_time: body.due_time ?? '10:00',
      duration: body.duration ?? '01:00',
      user_id: body.user_id ?? 1,
      deal_id: body.deal_id ?? null,
      person_id: body.person_id ?? null,
      org_id: body.org_id ?? null,
      done: false,
      add_time: new Date().toISOString(),
      update_time: new Date().toISOString(),
      active_flag: !isFailed,
    }

    service.state.activities.set(id, activity)

    if (isFailed) {
      json(res, 400, { success: false, error: 'Failed to create activity', error_info: 'Failed to create activity' })
      return
    }

    json(res, 201, { success: true, data: activity })
  })

  return service
}

/**
 * Attio.
 *
 * The Attio API: objects, records, lists, and entries.
 * The shapes match Attio's API.
 *
 * The reference decides: a record with `success` succeeds, `failed` fails.
 */
export function createAttioMock() {
  const service = new MockService('attio')

  service.state.objects = new Map()
  service.state.records = new Map()
  service.state.lists = new Map()
  service.state.entries = new Map()

  let objectId = 1000
  let recordId = 2000
  let listId = 3000
  let entryId = 4000

  const nextObjectId = () => `object_${objectId++}`
  const nextRecordId = () => `record_${recordId++}`
  const nextListId = () => `list_${listId++}`
  const nextEntryId = () => `entry_${entryId++}`

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'attio-mock' })
  })

  // OAuth token endpoint
  service.on('POST', '/oauth/token', (req, res) => {
    json(res, 200, {
      access_token: 'mock_attio_token',
      token_type: 'Bearer',
      expires_in: 3600,
    })
  })

  // Objects
  service.on('POST', '/v2/objects', (req, res) => {
    const body = req.json ?? {}
    const apiSlug = body.api_slug ?? `object_${nextObjectId()}`

    const isFailed = failed(apiSlug)

    const object = {
      api_slug: apiSlug,
      name: body.name ?? `Object ${apiSlug}`,
      description: body.description ?? '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_system: false,
      icon: body.icon ?? 'default',
    }

    service.state.objects.set(apiSlug, object)

    if (isFailed) {
      json(res, 400, { error: 'Failed to create object', code: 'CREATE_FAILED' })
      return
    }

    json(res, 201, { data: object })
  })

  service.on('GET', '/v2/objects', (req, res) => {
    const objects = [...service.state.objects.values()]
    json(res, 200, { data: objects })
  })

  // Records
  service.on('POST', '/v2/objects/:objectSlug/records', (req, res) => {
    const objectSlug = String(req.params.objectSlug)
    const body = req.json ?? {}
    const values = body.values ?? {}

    const isFailed = failed(JSON.stringify(values))
    const id = nextRecordId()

    const record = {
      id,
      object: objectSlug,
      values,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by_actor: { type: 'user', id: 'user_1' },
    }

    const objectRecords = service.state.records.get(objectSlug) ?? new Map()
    objectRecords.set(id, record)
    service.state.records.set(objectSlug, objectRecords)

    if (isFailed) {
      json(res, 400, { error: 'Failed to create record', code: 'CREATE_FAILED' })
      return
    }

    json(res, 201, { data: record })
  })

  service.on('GET', '/v2/objects/:objectSlug/records', (req, res) => {
    const objectSlug = String(req.params.objectSlug)
    const objectRecords = service.state.records.get(objectSlug) ?? new Map()
    const limit = Number(req.query.limit ?? 100)
    const records = [...objectRecords.values()].slice(0, limit)
    json(res, 200, { data: records, next_cursor: null })
  })

  service.on('GET', '/v2/objects/:objectSlug/records/:id', (req, res) => {
    const objectSlug = String(req.params.objectSlug)
    const id = String(req.params.id)
    const objectRecords = service.state.records.get(objectSlug) ?? new Map()
    const record = objectRecords.get(id)

    if (!record) {
      json(res, 404, { error: 'Record not found', code: 'NOT_FOUND' })
      return
    }

    json(res, 200, { data: record })
  })

  // Lists
  service.on('POST', '/v2/lists', (req, res) => {
    const body = req.json ?? {}
    const id = nextListId()

    const list = {
      id,
      name: body.name ?? `List ${id}`,
      description: body.description ?? '',
      object: body.object ?? 'company',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    service.state.lists.set(id, list)
    json(res, 201, { data: list })
  })

  // Entries
  service.on('POST', '/v2/lists/:listId/entries', (req, res) => {
    const listId = String(req.params.listId)
    const body = req.json ?? {}
    const recordId = body.record_id ?? nextRecordId()

    const isFailed = failed(recordId)

    const entry = {
      id: nextEntryId(),
      list_id: listId,
      record_id: recordId,
      parent_entry_id: body.parent_entry_id ?? null,
      values: body.values ?? {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const listEntries = service.state.entries.get(listId) ?? new Map()
    listEntries.set(recordId, entry)
    service.state.entries.set(listId, listEntries)

    if (isFailed) {
      json(res, 400, { error: 'Failed to create entry', code: 'CREATE_FAILED' })
      return
    }

    json(res, 201, { data: entry })
  })

  return service
}
