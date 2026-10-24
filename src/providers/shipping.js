import { MockService, json, counter } from '../harness.js'

/**
 * Shippo.
 *
 * The Shippo API: create a shipment, get rates, purchase a label, and track it.
 * The shapes match Shippo's API: the same field names, the same object types,
 * and the same status transitions.
 *
 * The reference decides: a shipment with `success` in the reference gets a
 * purchased label, one with `failed` fails.
 */
export function createShippoMock() {
  const service = new MockService('shippo')

  service.state.shipments = new Map()
  service.state.transactions = new Map()
  service.state.addresses = new Map()
  service.state.parcels = new Map()
  service.state.customs = new Map()

  const nextShipment = counter('shp')
  const nextTransaction = counter('trans')
  const nextAddress = counter('addr')
  const nextParcel = counter('parcel')
  const nextCustoms = counter('customs')

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'shippo-mock' })
  })

  service.on('POST', '/v1/addresses', (req, res) => {
    const body = req.json ?? {}
    const id = nextAddress()

    const address = {
      object_id: id,
      object_owner: 'mock',
      object_created: new Date().toISOString(),
      object_updated: new Date().toISOString(),
      name: body.name ?? 'John Doe',
      company: body.company ?? '',
      street1: body.street1 ?? '123 Main St',
      street2: body.street2 ?? '',
      street3: body.street3 ?? '',
      city: body.city ?? 'San Francisco',
      state: body.state ?? 'CA',
      zip: body.zip ?? '94105',
      country: body.country ?? 'US',
      phone: body.phone ?? '+1 555 123 4567',
      email: body.email ?? 'john@example.com',
      is_residential: body.is_residential ?? true,
      metadata: body.metadata ?? '',
      test: body.test ?? true,
    }

    service.state.addresses.set(id, address)
    json(res, 201, address)
  })

  service.on('GET', '/v1/addresses/:id', (req, res) => {
    const id = String(req.params.id)
    const address = service.state.addresses.get(id)

    if (!address) {
      json(res, 404, { detail: 'Not found.' })
      return
    }

    json(res, 200, address)
  })

  service.on('POST', '/v1/parcels', (req, res) => {
    const body = req.json ?? {}
    const id = nextParcel()

    const parcel = {
      object_id: id,
      object_owner: 'mock',
      object_created: new Date().toISOString(),
      object_updated: new Date().toISOString(),
      length: body.length ?? '10',
      width: body.width ?? '5',
      height: body.height ?? '4',
      distance_unit: body.distance_unit ?? 'in',
      weight: body.weight ?? '2',
      mass_unit: body.mass_unit ?? 'lb',
      metadata: body.metadata ?? '',
      test: body.test ?? true,
    }

    service.state.parcels.set(id, parcel)
    json(res, 201, parcel)
  })

  service.on('POST', '/v1/customs_declarations', (req, res) => {
    const body = req.json ?? {}
    const id = nextCustoms()

    const customs = {
      object_id: id,
      object_owner: 'mock',
      object_created: new Date().toISOString(),
      object_updated: new Date().toISOString(),
      contents_type: body.contents_type ?? 'merchandise',
      contents_explanation: body.contents_explanation ?? '',
      customs_items: body.customs_items ?? [],
      non_delivery_option: body.non_delivery_option ?? 'return',
      certify: body.certify ?? true,
      signer: body.signer ?? 'John Doe',
      metadata: body.metadata ?? '',
      test: body.test ?? true,
    }

    service.state.customs.set(id, customs)
    json(res, 201, customs)
  })

  service.on('POST', '/v1/shipments', (req, res) => {
    const body = req.json ?? {}
    const id = nextShipment()

    const isFailed = failed(body.reference ?? id)

    const shipment = {
      object_id: id,
      object_owner: 'mock',
      object_created: new Date().toISOString(),
      object_updated: new Date().toISOString(),
      status: isFailed ? 'ERROR' : 'SUCCESS',
      to_address: service.state.addresses.get(body.address_to ?? 'addr_1') ?? {
        object_id: 'addr_1',
        name: 'John Doe',
        street1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        country: 'US',
      },
      from_address: service.state.addresses.get(body.address_from ?? 'addr_2') ?? {
        object_id: 'addr_2',
        name: 'Jane Smith',
        street1: '456 Market St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
        country: 'US',
      },
      parcel: service.state.parcels.get(body.parcel ?? 'parcel_1') ?? {
        object_id: 'parcel_1',
        length: '10',
        width: '5',
        height: '4',
        distance_unit: 'in',
        weight: '2',
        mass_unit: 'lb',
      },
      customs_declaration: body.customs_declaration
        ? service.state.customs.get(body.customs_declaration)
        : undefined,
      rates: [
        {
          object_id: 'rate_1',
          amount: '10.00',
          currency: 'USD',
          duration_terms: '2-5 business days',
          provider: 'USPS',
          servicelevel: { name: 'Priority Mail', token: 'usps_priority' },
        },
        {
          object_id: 'rate_2',
          amount: '25.00',
          currency: 'USD',
          duration_terms: '1 business day',
          provider: 'UPS',
          servicelevel: { name: 'Next Day Air', token: 'ups_next_day_air' },
        },
      ],
      metadata: body.metadata ?? '',
      test: body.test ?? true,
      messages: isFailed
        ? [
            {
              code: 'RATE_ERROR',
              source: 'provider',
              text: 'Failed to get rates from carrier.',
            },
          ]
        : [],
    }

    service.state.shipments.set(id, shipment)
    json(res, 201, shipment)
  })

  service.on('GET', '/v1/shipments/:id', (req, res) => {
    const id = String(req.params.id)
    const shipment = service.state.shipments.get(id)

    if (!shipment) {
      json(res, 404, { detail: 'Not found.' })
      return
    }

    json(res, 200, shipment)
  })

  service.on('POST', '/v1/transactions', (req, res) => {
    const body = req.json ?? {}
    const id = nextTransaction()

    const shipmentId = body.shipment
    const shipment = service.state.shipments.get(shipmentId)

    const isFailed = failed(shipmentId)

    const transaction = {
      object_id: id,
      object_owner: 'mock',
      object_created: new Date().toISOString(),
      object_updated: new Date().toISOString(),
      status: isFailed ? 'FAILED' : 'SUCCESS',
      shipment_id: shipmentId,
      rate: body.rate ?? 'rate_1',
      label_url: isFailed ? null : `${service.url}/labels/${id}.pdf`,
      tracking_number: isFailed ? null : `1Z${id}1234567890`,
      tracking_status: isFailed ? null : 'Label Created',
      tracking_url_provider: isFailed ? null : `https://track.carrier.com/${id}`,
      test: body.test ?? true,
      messages: isFailed
        ? [
            {
              code: 'PURCHASE_ERROR',
              source: 'provider',
              text: 'Failed to purchase label from carrier.',
            },
          ]
        : [],
    }

    service.state.transactions.set(id, transaction)

    if (shipment) {
      shipment.object_updated = new Date().toISOString()
      service.state.shipments.set(shipmentId, shipment)
    }

    json(res, 201, transaction)
  })

  service.on('GET', '/v1/transactions/:id', (req, res) => {
    const id = String(req.params.id)
    const transaction = service.state.transactions.get(id)

    if (!transaction) {
      json(res, 404, { detail: 'Not found.' })
      return
    }

    json(res, 200, transaction)
  })

  service.on('GET', '/v1/tracks/:carrier/:tracking_number', (req, res) => {
    const carrier = String(req.params.carrier)
    const trackingNumber = String(req.params.tracking_number)

    const isFailed = failed(trackingNumber)

    json(res, 200, {
      tracking_number: trackingNumber,
      carrier: carrier,
      status: isFailed ? 'EXCEPTION' : 'DELIVERED',
      tracking_details: [
        {
          status: isFailed ? 'EXCEPTION' : 'DELIVERED',
          status_details: isFailed ? 'Delivery exception' : 'Package delivered',
          datetime: new Date().toISOString(),
          location: { city: 'San Francisco', state: 'CA', country: 'US', zip: '94105' },
        },
        {
          status: 'IN_TRANSIT',
          status_details: 'In transit',
          datetime: new Date(Date.now() - 86400000).toISOString(),
          location: { city: 'Los Angeles', state: 'CA', country: 'US', zip: '90001' },
        },
      ],
      eta: isFailed ? null : new Date().toISOString(),
      test: true,
    })
  })

  return service
}

/**
 * EasyPost.
 *
 * The EasyPost API: create a shipment, buy a label, track it, and handle
 * webhooks. The shapes match EasyPost's API.
 *
 * The reference decides: a shipment with `success` gets a label, `failed` fails.
 */
export function createEasyPostMock() {
  const service = new MockService('easypost')

  service.state.shipments = new Map()
  service.state.trackers = new Map()
  service.state.webhooks = []

  const nextShipment = counter('shp')
  const nextTracker = counter('trk')

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'easypost-mock' })
  })

  service.on('POST', '/v2/shipments', (req, res) => {
    const body = req.json ?? {}
    const id = nextShipment()

    const isFailed = failed(body.reference ?? id)

    const shipment = {
      id,
      object: 'Shipment',
      mode: body.mode ?? 'test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reference: body.reference ?? null,
      status: isFailed ? 'error' : 'created',
      tracking_code: null,
      usps_zone: 4,
      to_address: {
        id: `adr_${nextShipment()}`,
        object: 'Address',
        name: 'John Doe',
        company: null,
        street1: '123 Main St',
        street2: '',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        country: 'US',
        phone: '5551234567',
        email: 'john@example.com',
        mode: 'test',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      from_address: {
        id: `adr_${nextShipment()}`,
        object: 'Address',
        name: 'Jane Smith',
        company: null,
        street1: '456 Market St',
        street2: '',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
        country: 'US',
        phone: '5551234567',
        email: 'jane@example.com',
        mode: 'test',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      parcel: {
        id: `prcl_${nextShipment()}`,
        object: 'Parcel',
        length: 10,
        width: 5,
        height: 4,
        weight: 16,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      customs_info: body.customs_info
        ? {
            id: `cstinfo_${nextShipment()}`,
            object: 'CustomsInfo',
            contents_type: 'merchandise',
            contents_explanation: '',
            customs_certify: true,
            customs_signer: 'John Doe',
            eel_pfc: 'NOEEI 30.37(a)',
            non_delivery_option: 'return',
            restriction_type: 'none',
            restriction_comments: null,
            customs_items: body.customs_info.customs_items ?? [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        : null,
      rates: [
        {
          id: `rate_${nextShipment()}`,
          object: 'Rate',
          carrier: 'USPS',
          service: 'Priority',
          rate: '10.00',
          currency: 'USD',
          delivery_days: 2,
          delivery_date: new Date(Date.now() + 172800000).toISOString(),
          delivery_date_guaranteed: false,
        },
        {
          id: `rate_${nextShipment()}`,
          object: 'Rate',
          carrier: 'UPS',
          service: 'NextDayAir',
          rate: '25.00',
          currency: 'USD',
          delivery_days: 1,
          delivery_date: new Date(Date.now() + 86400000).toISOString(),
          delivery_date_guaranteed: true,
        },
      ],
      selected_rate: null,
      postage_label: null,
      tracker: null,
      forms: [],
      fees: [
        { object: 'Fee', type: 'LabelFee', amount: '0.00', currency: 'USD' },
        { object: 'Fee', type: 'InsuranceFee', amount: '0.00', currency: 'USD' },
      ],
      refund_status: null,
      scan_form: null,
      insurance: null,
      options: {},
      messages: isFailed
        ? [
            {
              object: 'Message',
              carrier: 'USPS',
              type: 'error',
              message: 'Failed to create shipment.',
              carrier_account_id: null,
            },
          ]
        : [],
    }

    service.state.shipments.set(id, shipment)
    json(res, 201, shipment)
  })

  service.on('GET', '/v2/shipments/:id', (req, res) => {
    const id = String(req.params.id)
    const shipment = service.state.shipments.get(id)

    if (!shipment) {
      json(res, 404, { error: { code: 'NOT_FOUND', message: 'Unable to find shipment.' } })
      return
    }

    json(res, 200, shipment)
  })

  service.on('POST', '/v2/shipments/:id/buy', (req, res) => {
    const id = String(req.params.id)
    const body = req.json ?? {}
    const shipment = service.state.shipments.get(id)

    if (!shipment) {
      json(res, 404, { error: { code: 'NOT_FOUND', message: 'Unable to find shipment.' } })
      return
    }

    const isFailed = failed(id)

    shipment.status = isFailed ? 'error' : 'purchased'
    shipment.selected_rate = body.rate ?? shipment.rates[0]
    shipment.postage_label = isFailed
      ? null
      : {
          id: `pl_${nextShipment()}`,
          object: 'PostageLabel',
          label_url: `${service.url}/labels/${id}.pdf`,
          label_file_type: 'application/pdf',
          label_resolution: 200,
          label_size: '4x6',
          created_at: new Date().toISOString(),
        }
    shipment.tracking_code = isFailed ? null : `1Z${id}1234567890`
    shipment.tracker = isFailed
      ? null
      : {
          id: `trk_${nextTracker()}`,
          object: 'Tracker',
          tracking_code: shipment.tracking_code,
          status: 'pre_transit',
          status_detail: 'Label Created',
          carrier: 'UPS',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

    service.state.shipments.set(id, shipment)
    json(res, 200, shipment)
  })

  service.on('POST', '/v2/trackers', (req, res) => {
    const body = req.json ?? {}
    const id = nextTracker()
    const trackingCode = body.tracking_code ?? `1Z${id}1234567890`

    const isFailed = failed(trackingCode)

    const tracker = {
      id,
      object: 'Tracker',
      tracking_code: trackingCode,
      status: isFailed ? 'exception' : 'delivered',
      status_detail: isFailed ? 'Delivery exception' : 'Delivered',
      carrier: body.carrier ?? 'UPS',
      tracking_details: [
        {
          object: 'TrackingDetail',
          message: isFailed ? 'Delivery exception' : 'Delivered',
          status: isFailed ? 'exception' : 'delivered',
          datetime: new Date().toISOString(),
          carrier: body.carrier ?? 'UPS',
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    service.state.trackers.set(id, tracker)
    json(res, 201, tracker)
  })

  service.on('GET', '/v2/trackers/:id', (req, res) => {
    const id = String(req.params.id)
    const tracker = service.state.trackers.get(id)

    if (!tracker) {
      json(res, 404, { error: { code: 'NOT_FOUND', message: 'Unable to find tracker.' } })
      return
    }

    json(res, 200, tracker)
  })

  service.on('POST', '/v2/webhooks', (req, res) => {
    const body = req.json ?? {}
    service.state.webhooks.push(body)
    json(res, 201, { id: `hook_${service.state.webhooks.length}`, object: 'Webhook', ...body })
  })

  return service
}

/**
 * FedEx.
 *
 * The FedEx REST API: create a shipment, get rates, create a label, and track.
 * This is a simplified mock covering the key endpoints.
 *
 * The reference decides: a shipment with `success` succeeds, `failed` fails.
 */
export function createFedexMock() {
  const service = new MockService('fedex')

  service.state.shipments = new Map()
  service.state.tracking = new Map()

  const nextShipment = counter('fedex')

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'fedex-mock' })
  })

  // OAuth token endpoint
  service.on('POST', '/oauth/token', (req, res) => {
    json(res, 200, {
      access_token: 'mock_fedex_token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'all',
    })
  })

  service.on('POST', '/ship/v1/shipments', (req, res) => {
    const body = req.json ?? {}
    const id = nextShipment()

    const isFailed = failed(body.reference ?? id)

    const shipment = {
      output: {
        transactionShipments: [
          {
            pieceResponses: [
              {
                trackingNumber: isFailed ? null : `${id}12345678`,
                packageDocuments: isFailed
                  ? null
                  : {
                      contentType: 'PDF',
                      fileName: `label_${id}.pdf`,
                      docId: id,
                    },
              },
            ],
            masterTrackingNumber: isFailed ? null : `${id}12345678`,
          },
        ],
        completedShipmentDetail: {
          completedPackageDetails: [
            {
              trackingNumbers: isFailed ? null : [`${id}12345678`],
              packageDocuments: isFailed
                ? null
                : [
                    {
                      contentType: 'PDF',
                      fileName: `label_${id}.pdf`,
                    },
                  ],
            },
          ],
        },
      },
      alerts: isFailed
        ? [
            {
              code: 'SHIPMENT.ERROR',
              message: 'Failed to create shipment.',
            },
          ]
        : [],
    }

    service.state.shipments.set(id, shipment)
    json(res, 200, shipment)
  })

  service.on('POST', '/rate/v1/rates/quotes', (req, res) => {
    const body = req.json ?? {}
    const id = nextShipment()

    json(res, 200, {
      output: {
        rateReplyDetails: [
          {
            serviceType: 'PRIORITY_OVERNIGHT',
            ratedShipmentDetails: [
              {
                shipmentRateDetail: {
                  totalNetCharge: { amount: '25.00', currency: 'USD' },
                  totalBaseCharge: { amount: '25.00', currency: 'USD' },
                },
              },
            ],
          },
          {
            serviceType: 'STANDARD_OVERNIGHT',
            ratedShipmentDetails: [
              {
                shipmentRateDetail: {
                  totalNetCharge: { amount: '20.00', currency: 'USD' },
                  totalBaseCharge: { amount: '20.00', currency: 'USD' },
                },
              },
            ],
          },
        ],
      },
    })
  })

  service.on('GET', '/track/v1/trackingnumbers/:trackingNumber', (req, res) => {
    const trackingNumber = String(req.params.trackingNumber)
    const isFailed = failed(trackingNumber)

    json(res, 200, {
      output: {
        completeTrackResults: [
          {
            trackingNumber,
            trackingNumberUniqueIdentifier: trackingNumber,
            trackResults: [
              {
                trackingNumber,
                trackingNumberUniqueIdentifier: trackingNumber,
                statusByLocale: isFailed ? 'EXCEPTION' : 'DELIVERED',
                statusCategory: isFailed ? 'EXCEPTION' : 'DELIVERED',
                statusDescription: isFailed ? 'Delivery exception' : 'Delivered',
                statusDetails: [
                  {
                    trackingNumber,
                    date: new Date().toISOString(),
                    statusByLocale: isFailed ? 'EXCEPTION' : 'DELIVERED',
                    statusDescription: isFailed ? 'Delivery exception' : 'Delivered',
                    scanLocation: 'Memphis, TN, US',
                  },
                  {
                    trackingNumber,
                    date: new Date(Date.now() - 86400000).toISOString(),
                    statusByLocale: 'IN_TRANSIT',
                    statusDescription: 'In transit',
                    scanLocation: 'Los Angeles, CA, US',
                  },
                ],
              },
            ],
          },
        ],
      },
    })
  })

  return service
}

/**
 * UPS.
 *
 * The UPS REST API: create a shipment, get rates, and track.
 * This is a simplified mock covering the key endpoints.
 *
 * The reference decides: a shipment with `success` succeeds, `failed` fails.
 */
export function createUpsMock() {
  const service = new MockService('ups')

  service.state.shipments = new Map()
  service.state.tracking = new Map()

  const nextShipment = counter('ups')

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'ups-mock' })
  })

  // OAuth token endpoint
  service.on('POST', '/security/v1/oauth/token', (req, res) => {
    json(res, 200, {
      access_token: 'mock_ups_token',
      token_type: 'Bearer',
      expires_in: 3600,
    })
  })

  service.on('POST', '/api/shipments/v1/ship', (req, res) => {
    const body = req.json ?? {}
    const id = nextShipment()

    const isFailed = failed(body.shipmentReference ?? id)

    json(res, 200, {
      shipmentResponse: {
        shipmentIdentificationNumber: isFailed ? null : `1Z${id}12345678`,
        packageResults: [
          {
            trackingNumber: isFailed ? null : `1Z${id}12345678`,
            serviceOptionsCharges: {
              insuranceCharges: { monetaryValue: '0.00', currencyCode: 'USD' },
            },
            shippingLabel: isFailed
              ? null
              : {
                  imageFormat: { code: 'PDF' },
                  graphicImage: 'base64encodedlabel',
                  htmlImage: 'html_label_url',
                },
          },
        ],
      },
      response: {
        responseStatus: { code: '1', description: 'Success' },
        transactionReference: { customerContext: 'test' },
      },
    })
  })

  service.on('POST', '/api/rating/v1/rate', (req, res) => {
    json(res, 200, {
      rateResponse: {
        ratedShipment: [
          {
            service: { code: '01', description: 'UPS Next Day Air' },
            billingWeight: { unitOfMeasurement: { code: 'LBS' }, weight: '10' },
            transportationCharges: { currencyCode: 'USD', monetaryValue: '25.00' },
            serviceOptionsCharges: { currencyCode: 'USD', monetaryValue: '0.00' },
            totalCharges: { currencyCode: 'USD', monetaryValue: '25.00' },
            guaranteedDaysToDelivery: 1,
            scheduledDeliveryTime: '10:30',
          },
          {
            service: { code: '03', description: 'UPS Ground' },
            billingWeight: { unitOfMeasurement: { code: 'LBS' }, weight: '10' },
            transportationCharges: { currencyCode: 'USD', monetaryValue: '15.00' },
            serviceOptionsCharges: { currencyCode: 'USD', monetaryValue: '0.00' },
            totalCharges: { currencyCode: 'USD', monetaryValue: '15.00' },
            guaranteedDaysToDelivery: 3,
          },
        ],
      },
    })
  })

  service.on('GET', '/api/track/v1/details/:trackingNumber', (req, res) => {
    const trackingNumber = String(req.params.trackingNumber)
    const isFailed = failed(trackingNumber)

    json(res, 200, {
      trackResponse: {
        shipment: [
          {
            package: [
              {
                trackingNumber,
                activity: [
                  {
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toTimeString().split(' ')[0],
                    status: { code: isFailed ? 'EXCEPTION' : 'DELIVERED', description: isFailed ? 'Exception' : 'Delivered' },
                    activityLocation: {
                      address: { city: 'Memphis', stateProvinceCode: 'TN', countryCode: 'US' },
                    },
                  },
                  {
                    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
                    time: new Date(Date.now() - 86400000).toTimeString().split(' ')[0],
                    status: { code: 'IN_TRANSIT', description: 'In Transit' },
                    activityLocation: {
                      address: { city: 'Los Angeles', stateProvinceCode: 'CA', countryCode: 'US' },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    })
  })

  return service
}

/**
 * DHL.
 *
 * The DHL Express API: create a shipment, get rates, and track.
 * This is a simplified mock covering the key endpoints.
 *
 * The reference decides: a shipment with `success` succeeds, `failed` fails.
 */
export function createDhlMock() {
  const service = new MockService('dhl')

  service.state.shipments = new Map()
  service.state.tracking = new Map()

  const nextShipment = counter('dhl')

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'dhl-mock' })
  })

  // OAuth token endpoint
  service.on('POST', '/oauth/token', (req, res) => {
    json(res, 200, {
      access_token: 'mock_dhl_token',
      token_type: 'Bearer',
      expires_in: 3600,
    })
  })

  service.on('POST', '/express/shipments', (req, res) => {
    const body = req.json ?? {}
    const id = nextShipment()

    const isFailed = failed(body.shipmentReference ?? id)

    json(res, 200, {
      shipmentId: isFailed ? null : `DHL${id}123`,
      pieces: [
        {
          pieceId: id,
          trackingNumber: isFailed ? null : `JD${id}123456789`,
          label: isFailed
            ? null
            : {
                imageFormat: 'PDF',
                graphicImage: 'base64encodedlabel',
              },
        },
      ],
      errors: isFailed
        ? [
            {
              code: 'SHIPMENT_ERROR',
              message: 'Failed to create shipment.',
            },
          ]
        : [],
    })
  })

  service.on('POST', '/express/rates', (req, res) => {
    json(res, 200, {
      products: [
        {
          productCode: 'P',
          productName: 'DHL Express Worldwide',
          localProductCode: 'P',
          localProductName: 'DHL Express Worldwide',
          networkTypeCode: 'EXPRESS',
          price: [
            {
              priceCurrency: 'USD',
              priceValue: '30.00',
            },
          ],
        },
        {
          productCode: 'N',
          productName: 'DHL Express Domestic',
          localProductCode: 'N',
          localProductName: 'DHL Express Domestic',
          networkTypeCode: 'EXPRESS',
          price: [
            {
              priceCurrency: 'USD',
              priceValue: '15.00',
            },
          ],
        },
      ],
    })
  })

  service.on('GET', '/express/tracking/:trackingNumber', (req, res) => {
    const trackingNumber = String(req.params.trackingNumber)
    const isFailed = failed(trackingNumber)

    json(res, 200, {
      shipments: [
        {
          id: trackingNumber,
          service: 'DHL Express Worldwide',
          status: {
            code: isFailed ? 'EXCEPTION' : 'DELIVERED',
            description: isFailed ? 'Delivery exception' : 'Delivered',
            timestamp: new Date().toISOString(),
            location: { address: { addressLocality: 'Cincinnati', countryCode: 'US' } },
          },
          events: [
            {
              timestamp: new Date().toISOString(),
              status: { code: isFailed ? 'EXCEPTION' : 'DELIVERED', description: isFailed ? 'Delivery exception' : 'Delivered' },
              location: { address: { addressLocality: 'Cincinnati', countryCode: 'US' } },
            },
            {
              timestamp: new Date(Date.now() - 86400000).toISOString(),
              status: { code: 'IN_TRANSIT', description: 'In transit' },
              location: { address: { addressLocality: 'Los Angeles', countryCode: 'US' } },
            },
          ],
        },
      ],
    })
  })

  return service
}
