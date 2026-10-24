import { MockService, json, counter } from '../harness.js'

/**
 * SendGrid.
 *
 * The SendGrid Web API v3: send emails, manage contacts, and handle
 * suppression lists. The shapes match SendGrid's API.
 *
 * The reference decides: an email with `success` sends, `failed` fails.
 */
export function createSendGridMock() {
  const service = new MockService('sendgrid')

  service.state.emails = []
  service.state.contacts = new Map()
  service.state.suppressions = new Map()

  const nextEmail = counter('email')
  const nextContact = counter('contact')

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'sendgrid-mock' })
  })

  // Mail Send
  service.on('POST', '/v3/mail/send', (req, res) => {
    const body = req.json ?? {}
    const isFailed = failed(JSON.stringify(body))

    const email = {
      id: nextEmail(),
      from: body.from ?? { email: 'from@example.com', name: 'Sender' },
      to: body.personalizations?.[0]?.to ?? [{ email: 'to@example.com', name: 'Recipient' }],
      subject: body.subject ?? 'Test Subject',
      content: body.content ?? [{ type: 'text/plain', value: 'Test content' }],
      status: isFailed ? 'blocked' : 'sent',
      created_at: new Date().toISOString(),
    }

    service.state.emails.push(email)

    if (isFailed) {
      json(res, 400, {
        errors: [
          {
            message: 'Failed to send email',
            field: null,
            help: null,
          },
        ],
      })
      return
    }

    res.statusCode = 202
    res.setHeader('x-message-id', email.id)
    res.end()
  })

  // Contacts
  service.on('POST', '/v3/marketing/contacts', (req, res) => {
    const body = req.json ?? {}
    const contacts = body.contacts ?? []
    const added = []

    for (const contact of contacts) {
      const id = nextContact()
      const email = contact.email

      if (!email) continue

      const isFailed = failed(email)

      const c = {
        id,
        email,
        first_name: contact.first_name ?? '',
        last_name: contact.last_name ?? '',
        custom_fields: contact.custom_fields ?? {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      if (!isFailed) {
        service.state.contacts.set(email, c)
        added.push({ email, id })
      }
    }

    if (added.length === 0 && contacts.length > 0) {
      json(res, 400, { errors: [{ message: 'Failed to add contacts' }] })
      return
    }

    json(res, 201, { job_id: `job_${nextEmail()}`, added })
  })

  service.on('GET', '/v3/marketing/contacts', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const contacts = [...service.state.contacts.values()].slice(0, limit)
    json(res, 200, { contacts, total_count: service.state.contacts.size })
  })

  // Suppression lists
  service.on('GET', '/v3/suppression/bounces', (req, res) => {
    const limit = Number(req.query.limit ?? 100)
    const bounces = [...service.state.suppressions.values()].filter((s) => s.type === 'bounce').slice(0, limit)
    json(res, 200, bounces.map((s) => ({ email: s.email, created: s.created, reason: s.reason })))
  })

  service.on('POST', '/v3/suppression/bounces', (req, res) => {
    const body = req.json ?? {}
    const emails = body.emails ?? []

    for (const email of emails) {
      service.state.suppressions.set(email, { email, type: 'bounce', created: Date.now(), reason: 'bounced' })
    }

    json(res, 201, { deleted: emails.length })
  })

  service.on('DELETE', '/v3/suppression/bounces', (req, res) => {
    const body = req.json ?? {}
    const emails = body.emails ?? []

    for (const email of emails) {
      service.state.suppressions.delete(email)
    }

    json(res, 200, { deleted: emails.length })
  })

  // Stats
  service.on('GET', '/v3/stats', (req, res) => {
    json(res, 200, [
      {
        date: new Date().toISOString().split('T')[0],
        stats: [
          { type: 'requests', count: service.state.emails.length },
          { type: 'delivered', count: service.state.emails.filter((e) => e.status === 'sent').length },
          { type: 'bounces', count: 0 },
          { type: 'opens', count: 0 },
          { type: 'clicks', count: 0 },
        ],
      },
    ])
  })

  return service
}

/**
 * Mailchimp.
 *
 * The Mailchimp Marketing API: audiences, campaigns, and contacts.
 * The shapes match Mailchimp's API.
 *
 * The reference decides: a contact with `success` subscribes, `failed` fails.
 */
export function createMailchimpMock() {
  const service = new MockService('mailchimp')

  service.state.lists = new Map()
  service.state.members = new Map()
  service.state.campaigns = new Map()

  let listId = 1000
  let memberId = 2000
  let campaignId = 3000

  const nextListId = () => listId++
  const nextMemberId = () => memberId++
  const nextCampaignId = () => campaignId++

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'mailchimp-mock' })
  })

  // OAuth token endpoint
  service.on('POST', '/oauth2/token', (req, res) => {
    json(res, 200, {
      access_token: 'mock_mailchimp_token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'openid profile email',
    })
  })

  // Lists (audiences)
  service.on('GET', '/3.0/lists', (req, res) => {
    const limit = Number(req.query.count ?? 100)
    const lists = [...service.state.lists.values()].slice(0, limit)
    json(res, 200, { lists, total_items: lists.length })
  })

  service.on('POST', '/3.0/lists', (req, res) => {
    const body = req.json ?? {}
    const id = String(nextListId())

    const list = {
      id,
      name: body.name ?? `List ${id}`,
      contact: {
        company: body.company ?? 'Test Company',
        address1: body.address1 ?? '123 Main St',
        city: body.city ?? 'San Francisco',
        state: body.state ?? 'CA',
        zip: body.zip ?? '94105',
        country: body.country ?? 'US',
      },
      permission_reminder: body.permission_reminder ?? 'You signed up for updates.',
      campaign_defaults: {
        from_name: body.from_name ?? 'Test Sender',
        from_email: body.from_email ?? 'from@example.com',
        subject: body.subject ?? 'Test Subject',
        language: body.language ?? 'en',
      },
      email_type_option: true,
      stats: { member_count: 0, unsubscribe_count: 0, cleaned_count: 0 },
      created_at: new Date().toISOString(),
    }

    service.state.lists.set(id, list)
    json(res, 201, list)
  })

  // Members (contacts)
  service.on('POST', '/3.0/lists/:listId/members', (req, res) => {
    const listId = String(req.params.listId)
    const body = req.json ?? {}
    const email = body.email_address ?? body.email

    if (!email) {
      json(res, 400, { title: 'Invalid Resource', detail: 'email_address is required', status: 400 })
      return
    }

    const isFailed = failed(email)

    const member = {
      id: nextMemberId(),
      email_address: email,
      unique_email_id: `ueid_${nextMemberId()}`,
      status: isFailed ? 'unsubscribed' : 'subscribed',
      merge_fields: body.merge_fields ?? { FNAME: 'John', LNAME: 'Doe' },
      stats: { avg_open_rate: 0, avg_click_rate: 0 },
      ip_signup: '127.0.0.1',
      timestamp_signup: new Date().toISOString(),
      tags: body.tags ?? [],
      list_id: listId,
    }

    const listKey = `${listId}:${email}`
    service.state.members.set(listKey, member)

    if (isFailed) {
      json(res, 400, { title: 'Invalid Resource', detail: 'Failed to subscribe', status: 400 })
      return
    }

    json(res, 201, member)
  })

  service.on('GET', '/3.0/lists/:listId/members', (req, res) => {
    const listId = String(req.params.listId)
    const limit = Number(req.query.count ?? 100)
    const members = [...service.state.members.values()].filter((m) => m.list_id === listId).slice(0, limit)
    json(res, 200, { members, total_items: members.length })
  })

  // Campaigns
  service.on('POST', '/3.0/campaigns', (req, res) => {
    const body = req.json ?? {}
    const id = String(nextCampaignId())

    const campaign = {
      id,
      type: body.type ?? 'regular',
      create_time: new Date().toISOString(),
      archive_url: `https://example.com/campaign/${id}`,
      status: 'save',
      emails_sent: 0,
      send_time: null,
      content_type: 'template',
      recipients: {
        list_id: body.recipients?.list_id ?? '1',
        segment_opts: body.recipients?.segment_opts ?? null,
      },
      settings: {
        subject_line: body.settings?.subject_line ?? 'Test Campaign',
        preview_text: body.settings?.preview_text ?? '',
        title: body.settings?.title ?? `Campaign ${id}`,
        from_name: body.settings?.from_name ?? 'Test Sender',
        reply_to: body.settings?.reply_to ?? 'reply@example.com',
        to_name: body.settings?.to_name ?? '*|FNAME|*',
        folder_id: body.settings?.folder_id ?? null,
        tracking_opens: true,
        tracking_html_clicks: true,
        tracking_text_clicks: true,
      },
      template_id: body.template_id ?? null,
    }

    service.state.campaigns.set(id, campaign)
    json(res, 201, campaign)
  })

  service.on('GET', '/3.0/campaigns', (req, res) => {
    const limit = Number(req.query.count ?? 100)
    const campaigns = [...service.state.campaigns.values()].slice(0, limit)
    json(res, 200, { campaigns, total_items: campaigns.length })
  })

  return service
}

/**
 * Klaviyo.
 *
 * The Klaviyo API: profiles, lists, segments, and campaigns.
 * The shapes match Klaviyo's API.
 *
 * The reference decides: a profile with `success` subscribes, `failed` fails.
 */
export function createKlaviyoMock() {
  const service = new MockService('klaviyo')

  service.state.profiles = new Map()
  service.state.lists = new Map()
  service.state.segments = new Map()
  service.state.campaigns = new Map()

  let profileId = 1000
  let listId = 2000
  let campaignId = 3000

  const nextProfileId = () => `profile_${profileId++}`
  const nextListId = () => `list_${listId++}`
  const nextCampaignId = () => `campaign_${campaignId++}`

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'klaviyo-mock' })
  })

  // Profiles
  service.on('POST', '/api/profiles', (req, res) => {
    const body = req.json ?? {}
    const email = body.data?.attributes?.email ?? body.email

    if (!email) {
      json(res, 400, { errors: [{ detail: 'email is required', source: { pointer: '/data/attributes/email' } }] })
      return
    }

    const isFailed = failed(email)

    const profile = {
      type: 'profile',
      id: nextProfileId(),
      attributes: {
        email,
        phone_number: body.data?.attributes?.phone_number ?? null,
        first_name: body.data?.attributes?.first_name ?? 'John',
        last_name: body.data?.attributes?.last_name ?? 'Doe',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      },
    }

    service.state.profiles.set(email, profile)

    if (isFailed) {
      json(res, 400, { errors: [{ detail: 'Failed to create profile', source: { pointer: '/data/attributes/email' } }] })
      return
    }

    json(res, 201, { data: profile })
  })

  service.on('GET', '/api/profiles', (req, res) => {
    const limit = Number(req.query['page[size]'] ?? 100)
    const profiles = [...service.state.profiles.values()].slice(0, limit)
    json(res, 200, { data: profiles })
  })

  // Lists
  service.on('POST', '/api/lists', (req, res) => {
    const body = req.json ?? {}
    const id = nextListId()

    const list = {
      type: 'list',
      id,
      attributes: {
        name: body.data?.attributes?.name ?? `List ${id}`,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      },
    }

    service.state.lists.set(id, list)
    json(res, 201, { data: list })
  })

  service.on('GET', '/api/lists', (req, res) => {
    const limit = Number(req.query['page[size]'] ?? 100)
    const lists = [...service.state.lists.values()].slice(0, limit)
    json(res, 200, { data: lists })
  })

  // Campaigns
  service.on('POST', '/api/campaigns', (req, res) => {
    const body = req.json ?? {}
    const id = nextCampaignId()

    const campaign = {
      type: 'campaign',
      id,
      attributes: {
        name: body.data?.attributes?.name ?? `Campaign ${id}`,
        subject: body.data?.attributes?.subject ?? 'Test Subject',
        from_email: body.data?.attributes?.from_email ?? 'from@example.com',
        from_name: body.data?.attributes?.from_name ?? 'Test Sender',
        status: 'draft',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      },
    }

    service.state.campaigns.set(id, campaign)
    json(res, 201, { data: campaign })
  })

  service.on('GET', '/api/campaigns', (req, res) => {
    const limit = Number(req.query['page[size]'] ?? 100)
    const campaigns = [...service.state.campaigns.values()].slice(0, limit)
    json(res, 200, { data: campaigns })
  })

  return service
}

/**
 * Postmark.
 *
 * The Postmark API: send emails, templates, and message streams.
 * The shapes match Postmark's API.
 *
 * The reference decides: an email with `success` sends, `failed` fails.
 */
export function createPostmarkMock() {
  const service = new MockService('postmark')

  service.state.emails = []
  service.state.templates = new Map()
  service.state.messageStreams = new Map()

  let emailId = 1000
  let templateId = 2000

  const nextEmailId = () => emailId++
  const nextTemplateId = () => templateId++

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'postmark-mock' })
  })

  // Email
  service.on('POST', '/email', (req, res) => {
    const body = req.json ?? {}
    const isFailed = failed(JSON.stringify(body))

    const email = {
      MessageID: String(nextEmailId()),
      SubmittedAt: new Date().toISOString(),
      To: body.To ?? 'to@example.com',
      From: body.From ?? 'from@example.com',
      Subject: body.Subject ?? 'Test Subject',
      Tag: body.Tag ?? '',
      ErrorCode: isFailed ? 406 : 0,
      Message: isFailed ? 'Failed to send email' : 'OK',
    }

    service.state.emails.push(email)

    if (isFailed) {
      json(res, 422, { ErrorCode: 406, Message: 'Failed to send email' })
      return
    }

    json(res, 200, email)
  })

  service.on('POST', '/email/batch', (req, res) => {
    const body = req.json ?? []
    const results = body.map((email) => {
      const isFailed = failed(JSON.stringify(email))
      return {
        MessageID: String(nextEmailId()),
        SubmittedAt: new Date().toISOString(),
        To: email.To ?? 'to@example.com',
        From: email.From ?? 'from@example.com',
        Subject: email.Subject ?? 'Test Subject',
        ErrorCode: isFailed ? 406 : 0,
        Message: isFailed ? 'Failed to send email' : 'OK',
      }
    })

    const allFailed = results.every((r) => r.ErrorCode !== 0)

    if (allFailed) {
      json(res, 422, results)
      return
    }

    json(res, 200, results)
  })

  // Templates
  service.on('POST', '/templates', (req, res) => {
    const body = req.json ?? {}
    const id = nextTemplateId()

    const template = {
      TemplateId: id,
      Name: body.Name ?? `Template ${id}`,
      Subject: body.Subject ?? 'Test Subject',
      HtmlBody: body.HtmlBody ?? '<html><body>Test</body></html>',
      TextBody: body.TextBody ?? 'Test',
      AssociatedServerId: 1,
      Active: true,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    }

    service.state.templates.set(id, template)
    json(res, 201, template)
  })

  service.on('GET', '/templates', (req, res) => {
    const limit = Number(req.query.count ?? 100)
    const templates = [...service.state.templates.values()].slice(0, limit)
    json(res, 200, { Templates: templates, TotalCount: templates.length })
  })

  // Message Streams
  service.on('GET', '/message-streams', (req, res) => {
    const streams = [
      { ID: 'outbound', Name: 'Outbound', Description: 'Transactional emails', CreatedAt: new Date().toISOString() },
      { ID: 'broadcast', Name: 'Broadcast', Description: 'Marketing emails', CreatedAt: new Date().toISOString() },
    ]
    json(res, 200, streams)
  })

  // Stats
  service.on('GET', '/stats/outbound', (req, res) => {
    const sent = service.state.emails.filter((e) => e.ErrorCode === 0).length
    const failedCount = service.state.emails.filter((e) => e.ErrorCode !== 0).length

    json(res, 200, {
      Sent: sent,
      Bounced: 0,
      SpamComplaints: 0,
      Opens: 0,
      Tracked: 0,
      WithLink: 0,
      OpensByDevice: { Desktop: 0, Mobile: 0, Unknown: 0 },
    })
  })

  return service
}
