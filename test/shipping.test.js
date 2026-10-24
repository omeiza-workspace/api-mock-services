import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MOCKS } from '../src/index.js'

const post = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  return { status: res.status, json: await res.json() }
}

const get = async (url) => {
  const res = await fetch(url)
  return { status: res.status, json: await res.json() }
}

test('shippo creates an address', async () => {
  const service = MOCKS.shippo.create()
  await service.listen(0, '127.0.0.1')

  const address = await post(`${service.url}/v1/addresses`, {
    name: 'John Doe',
    street1: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105',
    country: 'US',
  })

  assert.equal(address.status, 201)
  assert.ok(address.json.object_id)
  assert.equal(address.json.name, 'John Doe')

  await service.close()
})

test('shippo creates a parcel', async () => {
  const service = MOCKS.shippo.create()
  await service.listen(0, '127.0.0.1')

  const parcel = await post(`${service.url}/v1/parcels`, {
    length: '10',
    width: '5',
    height: '4',
    distance_unit: 'in',
    weight: '2',
    mass_unit: 'lb',
  })

  assert.equal(parcel.status, 201)
  assert.ok(parcel.json.object_id)
  assert.equal(parcel.json.weight, '2')

  await service.close()
})

test('shippo creates a shipment with rates', async () => {
  const service = MOCKS.shippo.create()
  await service.listen(0, '127.0.0.1')

  const shipment = await post(`${service.url}/v1/shipments`, {
    address_to: 'addr_1',
    address_from: 'addr_2',
    parcel: 'parcel_1',
  })

  assert.equal(shipment.status, 201)
  assert.ok(shipment.json.object_id)
  assert.equal(shipment.json.status, 'SUCCESS')
  assert.ok(shipment.json.rates.length >= 2)
  assert.ok(shipment.json.rates.some((r) => r.provider === 'USPS'))
  assert.ok(shipment.json.rates.some((r) => r.provider === 'UPS'))

  await service.close()
})

test('shippo fails shipment when reference says failed', async () => {
  const service = MOCKS.shippo.create()
  await service.listen(0, '127.0.0.1')

  const shipment = await post(`${service.url}/v1/shipments`, {
    address_to: 'addr_1',
    address_from: 'addr_2',
    parcel: 'parcel_1',
    reference: 'failed_shipment',
  })

  assert.equal(shipment.status, 201)
  assert.equal(shipment.json.status, 'ERROR')
  assert.ok(shipment.json.messages.some((m) => m.code === 'RATE_ERROR'))

  await service.close()
})

test('shippo purchases a label', async () => {
  const service = MOCKS.shippo.create()
  await service.listen(0, '127.0.0.1')

  const shipment = await post(`${service.url}/v1/shipments`, {
    address_to: 'addr_1',
    address_from: 'addr_2',
    parcel: 'parcel_1',
  })

  const transaction = await post(`${service.url}/v1/transactions`, {
    shipment: shipment.json.object_id,
    rate: shipment.json.rates[0].object_id,
  })

  assert.equal(transaction.status, 201)
  assert.ok(transaction.json.object_id)
  assert.equal(transaction.json.status, 'SUCCESS')
  assert.ok(transaction.json.label_url)
  assert.ok(transaction.json.tracking_number)

  await service.close()
})

test('shippo tracks a shipment', async () => {
  const service = MOCKS.shippo.create()
  await service.listen(0, '127.0.0.1')

  const track = await get(`${service.url}/v1/tracks/USPS/1Z999AA1234567890`)
  assert.equal(track.status, 200)
  assert.equal(track.json.tracking_number, '1Z999AA1234567890')
  assert.equal(track.json.status, 'DELIVERED')

  await service.close()
})

test('easypost creates a shipment', async () => {
  const service = MOCKS.easypost.create()
  await service.listen(0, '127.0.0.1')

  const shipment = await post(`${service.url}/v2/shipments`, {
    to_address: {
      name: 'John Doe',
      street1: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94105',
      country: 'US',
    },
    from_address: {
      name: 'Jane Smith',
      street1: '456 Market St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94102',
      country: 'US',
    },
    parcel: {
      length: 10,
      width: 5,
      height: 4,
      weight: 16,
    },
  })

  assert.equal(shipment.status, 201)
  assert.ok(shipment.json.id)
  assert.equal(shipment.json.object, 'Shipment')
  assert.ok(shipment.json.rates.length >= 2)

  await service.close()
})

test('easypost buys a label', async () => {
  const service = MOCKS.easypost.create()
  await service.listen(0, '127.0.0.1')

  const shipment = await post(`${service.url}/v2/shipments`, {
    to_address: { name: 'John Doe', street1: '123 Main St', city: 'San Francisco', state: 'CA', zip: '94105', country: 'US' },
    from_address: { name: 'Jane Smith', street1: '456 Market St', city: 'San Francisco', state: 'CA', zip: '94102', country: 'US' },
    parcel: { length: 10, width: 5, height: 4, weight: 16 },
  })

  const bought = await post(`${service.url}/v2/shipments/${shipment.json.id}/buy`, {
    rate: shipment.json.rates[0].id,
  })

  assert.equal(bought.status, 200)
  assert.equal(bought.json.status, 'purchased')
  assert.ok(bought.json.postage_label)
  assert.ok(bought.json.postage_label.label_url)

  await service.close()
})

test('easypost tracks a shipment', async () => {
  const service = MOCKS.easypost.create()
  await service.listen(0, '127.0.0.1')

  const tracker = await post(`${service.url}/v2/trackers`, {
    tracking_code: '1Z999AA1234567890',
    carrier: 'UPS',
  })

  assert.equal(tracker.status, 201)
  assert.ok(tracker.json.id)
  assert.equal(tracker.json.tracking_code, '1Z999AA1234567890')
  assert.equal(tracker.json.status, 'delivered')

  await service.close()
})

test('fedex creates a shipment', async () => {
  const service = MOCKS.fedex.create()
  await service.listen(0, '127.0.0.1')

  // Get token first
  const token = await post(`${service.url}/oauth/token`, {})
  assert.equal(token.status, 200)
  assert.ok(token.json.access_token)

  const shipment = await post(`${service.url}/ship/v1/shipments`, {
    reference: 'fedex_ship_1',
  })

  assert.equal(shipment.status, 200)
  assert.ok(shipment.json.output.transactionShipments[0].masterTrackingNumber)

  await service.close()
})

test('fedex fails shipment when reference says failed', async () => {
  const service = MOCKS.fedex.create()
  await service.listen(0, '127.0.0.1')

  const shipment = await post(`${service.url}/ship/v1/shipments`, {
    reference: 'failed_fedex',
  })

  assert.equal(shipment.status, 200)
  assert.ok(shipment.json.alerts.some((a) => a.code === 'SHIPMENT.ERROR'))

  await service.close()
})

test('fedex gets rates', async () => {
  const service = MOCKS.fedex.create()
  await service.listen(0, '127.0.0.1')

  const rates = await post(`${service.url}/rate/v1/rates/quotes`, {})
  assert.equal(rates.status, 200)
  assert.ok(rates.json.output.rateReplyDetails.length >= 2)

  await service.close()
})

test('fedex tracks a shipment', async () => {
  const service = MOCKS.fedex.create()
  await service.listen(0, '127.0.0.1')

  const track = await get(`${service.url}/track/v1/trackingnumbers/12345678`)
  assert.equal(track.status, 200)
  assert.ok(track.json.output.completeTrackResults[0].trackResults[0].trackingNumber)

  await service.close()
})

test('ups creates a shipment', async () => {
  const service = MOCKS.ups.create()
  await service.listen(0, '127.0.0.1')

  // Get token first
  const token = await post(`${service.url}/security/v1/oauth/token`, {})
  assert.equal(token.status, 200)
  assert.ok(token.json.access_token)

  const shipment = await post(`${service.url}/api/shipments/v1/ship`, {
    shipmentReference: 'ups_ship_1',
  })

  assert.equal(shipment.status, 200)
  assert.ok(shipment.json.shipmentResponse.shipmentIdentificationNumber)

  await service.close()
})

test('ups gets rates', async () => {
  const service = MOCKS.ups.create()
  await service.listen(0, '127.0.0.1')

  const rates = await post(`${service.url}/api/rating/v1/rate`, {})
  assert.equal(rates.status, 200)
  assert.ok(rates.json.rateResponse.ratedShipment.length >= 2)

  await service.close()
})

test('ups tracks a shipment', async () => {
  const service = MOCKS.ups.create()
  await service.listen(0, '127.0.0.1')

  const track = await get(`${service.url}/api/track/v1/details/1Z999AA1234567890`)
  assert.equal(track.status, 200)
  assert.ok(track.json.trackResponse.shipment[0].package[0].trackingNumber)

  await service.close()
})

test('dhl creates a shipment', async () => {
  const service = MOCKS.dhl.create()
  await service.listen(0, '127.0.0.1')

  // Get token first
  const token = await post(`${service.url}/oauth/token`, {})
  assert.equal(token.status, 200)
  assert.ok(token.json.access_token)

  const shipment = await post(`${service.url}/express/shipments`, {
    shipmentReference: 'dhl_ship_1',
  })

  assert.equal(shipment.status, 200)
  assert.ok(shipment.json.shipmentId)

  await service.close()
})

test('dhl gets rates', async () => {
  const service = MOCKS.dhl.create()
  await service.listen(0, '127.0.0.1')

  const rates = await post(`${service.url}/express/rates`, {})
  assert.equal(rates.status, 200)
  assert.ok(rates.json.products.length >= 2)

  await service.close()
})

test('dhl tracks a shipment', async () => {
  const service = MOCKS.dhl.create()
  await service.listen(0, '127.0.0.1')

  const track = await get(`${service.url}/express/tracking/JD123456789`)
  assert.equal(track.status, 200)
  assert.ok(track.json.shipments[0].id)

  await service.close()
})

test('every new shipping mock answers /_mock', async () => {
  for (const name of ['shippo', 'easypost', 'fedex', 'ups', 'dhl']) {
    const service = MOCKS[name].create()
    await service.listen(0, '127.0.0.1')

    const res = await fetch(`${service.url}/_mock`)
    const json = await res.json()

    assert.equal(json.kind, 'mock')
    assert.equal(json.service, name)
    assert.equal(json.real_service, false)

    await service.close()
  }
})

test('every new shipping mock answers /_openapi', async () => {
  for (const name of ['shippo', 'easypost', 'fedex', 'ups', 'dhl']) {
    const service = MOCKS[name].create()
    await service.listen(0, '127.0.0.1')

    const res = await fetch(`${service.url}/_openapi`)
    const spec = await res.json()

    assert.ok(spec.openapi)
    assert.ok(spec.info.title.includes(name))
    assert.ok(Object.keys(spec.paths).length > 0)

    await service.close()
  }
})
