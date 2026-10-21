import { createStripeMock, createResendMock, createXeroMock, createCloudflareMock } from './providers/commerce.js'
import {
  createPaystackMock,
  createInterswitchMock,
  createYouVerifyMock,
  createOneSignalMock,
  createTwilioMock,
} from './providers/nigeria.js'

/**
 * api-mock-services
 *
 * Stand-ins for the outside world: the payment gateways, the email provider,
 * the accounting service, the DNS provider, the messaging and the identity
 * checks.
 *
 * One implementation, used by every project. A test starts the mock it needs,
 * points the app at it, and can then say what was actually asked for.
 */

export { MockService, MockRequest, json, text, readBody, toMatcher } from './harness.js'

/** Every mock this package can start. */
export const MOCKS = {
  stripe: { create: createStripeMock, port: 4001, description: 'The card payments' },
  resend: { create: createResendMock, port: 4002, description: 'The email' },
  xero: { create: createXeroMock, port: 4003, description: 'The accounting' },
  cloudflare: { create: createCloudflareMock, port: 4004, description: 'The DNS' },
  paystack: { create: createPaystackMock, port: 4005, description: 'The card payments (Nigeria)' },
  interswitch: {
    create: createInterswitchMock,
    port: 4006,
    description: 'The card payments (Nigeria, Interswitch)',
  },
  youverify: { create: createYouVerifyMock, port: 4007, description: 'The identity checks' },
  onesignal: { create: createOneSignalMock, port: 4008, description: 'The push notifications' },
  twilio: { create: createTwilioMock, port: 4009, description: 'The SMS' },
}

/**
 * Start a mock.
 *
 * The returned object has the URL it is on, everything it was asked, and the
 * state it keeps — so a test can look at what really happened.
 */
export async function startMock(name, options = {}) {
  const entry = MOCKS[name]

  if (!entry) {
    throw new Error(
      `There is no mock called "${name}". The ones there are: ${Object.keys(MOCKS).join(', ')}.`,
    )
  }

  const service = entry.create(options)

  await service.listen(options.port ?? 0, options.host ?? '127.0.0.1')

  return service
}

/** Start several mocks at once. */
export async function startMocks(names, options = {}) {
  const started = []

  for (const name of names) {
    started.push(await startMock(name, options))
  }

  return started
}

export {
  createStripeMock,
  createResendMock,
  createXeroMock,
  createCloudflareMock,
  createPaystackMock,
  createInterswitchMock,
  createYouVerifyMock,
  createOneSignalMock,
  createTwilioMock,
}
