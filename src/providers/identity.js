import { MockService, json, counter } from '../harness.js'

/**
 * The identity checks.
 *
 * Smile ID and Identity Pass are what an app in Nigeria asks when it needs to
 * know who someone is. Both are asked for a BVN or a NIN, and both answer
 * with a name, a date of birth and a status.
 *
 * The reference decides the outcome: one that says `fail` comes back
 * failed, one that says `success` comes back successful — so a test can ask
 * for either without a special flag.
 */

/**
 * Smile ID.
 *
 * The version 2 shape, where the checks are named — `bvn`, `nin`,
 * `drivers_licence`, `passport` — and the version 1 shape, where the fields
 * are flat. A status code of `01` means it worked, and `02` means the
 * person is not who they say they are.
 */
export function createSmileIdMock() {
  const service = new MockService('smileid')

  service.state.verifications = new Map()

  const nextId = counter('sid')
  const nextService = counter('ps')

  const failed = (reference) => String(reference ?? '').includes('fail')

  service.on('POST', '/v2/verification', (req, res) => {
    const body = req.json ?? {}
    const checks = body.checks ?? {}

    if (!body.partner_id || !Object.keys(checks).length) {
      json(res, 400, {
        partner_id: body.partner_id ?? null,
        status_code: '400',
        message: 'partner_id and at least one check are required',
      })
      return
    }

    const id = `sid_${nextId()}_${Date.now()}`
    const outcome = failed(id) ? '02' : '01'

    const results = {}

    for (const [name, check] of Object.entries(checks)) {
      results[name] = {
        status_code: outcome,
        status: outcome === '01' ? 'Successful' : 'Failed',
        ...check,
      }
    }

    const verification = {
      smile_id_id: id,
      partner_id: body.partner_id,
      partner_service_id: `${body.partner_id}_${nextService()}`,
      template_id: body.template_id ?? null,
      status_code: outcome,
      message: outcome === '01' ? 'Verification Successful' : 'Verification Failed',
      checks: results,
      created_at: new Date().toISOString(),
    }

    service.state.verifications.set(id, verification)

    json(res, 200, verification)
  })

  service.on('POST', '/v1/verification', (req, res) => {
    const body = req.json ?? {}

    if (!body.partner_id) {
      json(res, 400, {
        partner_id: null,
        status_code: '400',
        message: 'partner_id is required',
      })
      return
    }

    const id = `sid_${nextId()}_${Date.now()}`
    const outcome = failed(id) ? '02' : '01'

    const verification = {
      smile_id_id: id,
      partner_id: body.partner_id,
      partner_service_id: `${body.partner_id}_${nextService()}`,
      template_id: body.template_id ?? null,
      status_code: outcome,
      message: outcome === '01' ? 'Verification Successful' : 'Verification Failed',
      first_name: body.first_name ?? null,
      last_name: body.last_name ?? null,
      middle_name: body.middle_name ?? null,
      gender: body.gender ?? null,
      date_of_birth: body.date_of_birth ?? null,
      nationality: body.nationality ?? 'Nigerian',
      id_number: body.id_number ?? null,
      created_at: new Date().toISOString(),
    }

    service.state.verifications.set(id, verification)

    json(res, 200, verification)
  })

  service.on('GET', '/v2/verification/:smile_id_id', (req, res) => {
    const verification = service.state.verifications.get(String(req.params.smile_id_id))

    if (!verification) {
      json(res, 404, {
        status_code: '404',
        message: 'Verification not found',
      })
      return
    }

    json(res, 200, verification)
  })

  return service
}

/**
 * Identity Pass.
 *
 * A person is verified, or a business is. The answers carry the fields an
 * onboarding form asks for, so a test can check that what came back is what
 * went in.
 */
export function createIdentityPassMock() {
  const service = new MockService('identitypass')

  service.state.verifications = []
  service.state.businesses = []

  const nextReference = counter('ipass')

  service.on('POST', '/v1/verification', (req, res) => {
    const body = req.json ?? {}

    if (!body.identity_number || !body.identity_type) {
      json(res, 400, {
        status: 'error',
        message: 'identity_number and identity_type are required',
        data: null,
      })
      return
    }

    const reference = `ref_${nextReference()}`
    const failed = String(body.identity_number).includes('fail')

    const verification = {
      reference_number: reference,
      identity_number: body.identity_number,
      identity_type: body.identity_type,
      first_name: body.first_name ?? 'Ada',
      last_name: body.last_name ?? 'Nwosu',
      middle_name: body.middle_name ?? null,
      gender: body.gender ?? 'female',
      date_of_birth: body.date_of_birth ?? '1990-04-12',
      nationality: 'Nigerian',
      address: body.address ?? '12 Example Street',
      city: body.city ?? 'Lagos',
      state: body.state ?? 'Lagos',
      phone: body.phone ?? null,
      email: body.email ?? null,
      photo: body.photo ?? null,
      status: failed ? 'failed' : 'success',
      created_at: new Date().toISOString(),
    }

    service.state.verifications.push(verification)

    json(res, 200, {
      status: verification.status,
      message: failed ? 'Verification failed' : 'Verification successful',
      data: verification,
      reference_number: reference,
    })
  })

  service.on('POST', '/v1/business', (req, res) => {
    const body = req.json ?? {}

    if (!body.business_name && !body.company_name) {
      json(res, 400, {
        status: 'error',
        message: 'business_name is required',
        data: null,
      })
      return
    }

    const business = {
      reference_number: `ref_${nextReference()}`,
      company_name: body.business_name ?? body.company_name,
      registration_number: body.registration_number ?? 'RC 1234567',
      company_status: 'ACTIVE',
      incorporation_date: body.incorporation_date ?? '2018-02-11',
      country: body.country ?? 'NG',
      address: body.address ?? '1 Business Way, Lagos',
      email: body.email ?? null,
      phone: body.phone ?? null,
      directors: body.directors ?? [],
      status: 'success',
      created_at: new Date().toISOString(),
    }

    service.state.businesses.push(business)

    json(res, 200, {
      status: 'success',
      message: 'Business verification successful',
      data: business,
      reference_number: business.reference_number,
    })
  })

  return service
}
