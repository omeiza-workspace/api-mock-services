/**
 * The types for the mock services.
 *
 * The package itself is plain JavaScript, so it runs anywhere Node runs. The
 * declarations are here so a TypeScript project still gets the shapes.
 */

export interface RecordedRequest {
  method: string
  path: string
  query: Record<string, string>
  headers: Record<string, string | string[] | undefined>
  /** The body as it was sent. */
  body: string
  /** The body, parsed — JSON or a form. */
  json: any
  /** The path parameters, for the routes that have them. */
  params: Record<string, string>
}

export interface MockOptions {
  /** The port to listen on. 0 means any free port. */
  port?: number
  /** The address to listen on. */
  host?: string
  /** Anything the provider needs — the NTFY address, for instance. */
  [key: string]: unknown
}

/** What a checkout page needs to show a payment. */
export interface CheckoutPayment {
  reference: string
  amount: string
  merchant?: string
}

/** The checkout a mock declares. The browser layer mounts it. */
export interface Checkout {
  /** The title the page says. */
  title?: string
  /** Where the page is, e.g. '/checkout/:reference'. */
  path?: string
  /** Given the reference, what is being paid. */
  find: (reference: string) => CheckoutPayment | null
  /** Given the reference and the outcome, what to record. */
  onDone?: (reference: string, outcome: 'success' | 'failed' | 'cancelled', body?: any) => void
}

export class MockRequest {
  method: string
  path: string
  query: Record<string, string>
  headers: Record<string, string | string[] | undefined>
  body: string
  raw: string
  json: any
  params: Record<string, string>
}

export class MockService {
  constructor(name: string)

  name: string
  routes: { method: string; path: string | RegExp; handler: Function }[]
  requests: RecordedRequest[]
  /** Whatever the service keeps. */
  state: Record<string, any>
  /** The checkout, if this mock has one. */
  checkout: Checkout | null
  url: string
  port: number

  on(method: string, path: string | RegExp, handler: Function): this
  any(path: string | RegExp, handler: Function): this
  /** Make the next call fail — server, unauthorised, unavailable, timeout or network. */
  failNext(kind?: string, times?: number): this
  /** Choose how the next payment goes — success, failed or cancelled. */
  setOutcome(outcome?: 'success' | 'failed' | 'cancelled'): this
  /** Forget everything, so the next test starts clean. */
  reset(): this
  last(): RecordedRequest | undefined
  requestsFor(method?: string, path?: string): RecordedRequest[]
  listen(port?: number, host?: string): Promise<string>
  /** Send the webhook, as the settings say it should be sent. */
  sendWebhook(event?: any): Promise<{ sent: boolean; status?: number; reason?: string }>
  close(): Promise<void>
  forceClose(): Promise<void>
}

export function json(res: any, status: number, body: unknown): void
export function text(res: any, status: number, body: string): void
export function readBody(req: any): Promise<{ raw: string; json: any }>
export function readControlForm(body: string): Record<string, string>
export function toMatcher(path: string | RegExp): string | RegExp

/** The categories the mocks are grouped into. */
export const CATEGORIES: Record<string, { title: string; description: string }>

export const MOCKS: Record<
  string,
  {
    create: (options?: MockOptions) => MockService
    port: number
    category: string
    description: string
  }
>

export function startMock(name: string, options?: MockOptions): Promise<MockService>
export function startMocks(names: string[], options?: MockOptions): Promise<MockService[]>

/** Put the browser layer — the panel and the checkout — on a mock. */
export function attachViews(service: MockService): MockService

// Payment providers
export function createStripeMock(options?: MockOptions): MockService
export function createPaypalMock(options?: MockOptions): MockService
export function createSquareMock(options?: MockOptions): MockService
export function createAdyenMock(options?: MockOptions): MockService
export function createPaystackMock(options?: MockOptions): MockService
export function createInterswitchMock(options?: MockOptions): MockService
export function createYouVerifyMock(options?: MockOptions): MockService
export function createFlutterwaveMock(options?: MockOptions): MockService
export function createMonnifyMock(options?: MockOptions): MockService

// Email/Marketing providers
export function createResendMock(options?: MockOptions): MockService
export function createSendGridMock(options?: MockOptions): MockService
export function createMailchimpMock(options?: MockOptions): MockService
export function createKlaviyoMock(options?: MockOptions): MockService
export function createPostmarkMock(options?: MockOptions): MockService

// Accounting providers
export function createXeroMock(options?: MockOptions): MockService
export function createQuickBooksMock(options?: MockOptions): MockService
export function createNetSuiteMock(options?: MockOptions): MockService
export function createSageMock(options?: MockOptions): MockService

// DNS/Cloud
export function createCloudflareMock(options?: MockOptions): MockService

// Identity providers
export function createYouVerifyMock(options?: MockOptions): MockService
export function createSmileIdMock(options?: MockOptions): MockService
export function createIdentityPassMock(options?: MockOptions): MockService

// Messaging providers
export function createTwilioMock(options?: MockOptions): MockService
export function createTermiiMock(options?: MockOptions): MockService
export function createWhatsAppMock(options?: MockOptions): MockService
export function createFcmMock(options?: MockOptions): MockService
export function createOneSignalMock(options?: MockOptions): MockService

// AI providers
export function createOpenAIMock(options?: MockOptions): MockService

// Storage providers
export function createS3Mock(options?: MockOptions): MockService

// Social providers
export function createFacebookMock(options?: MockOptions): MockService
export function createInstagramMock(options?: MockOptions): MockService
export function createXMock(options?: MockOptions): MockService
export function createBlueskyMock(options?: MockOptions): MockService
export function createTelegramMock(options?: MockOptions): MockService
export function createRedditMock(options?: MockOptions): MockService
export function createLinkedinMock(options?: MockOptions): MockService
export function createTiktokMock(options?: MockOptions): MockService
export function createYoutubeMock(options?: MockOptions): MockService

// Shipping providers
export function createShippoMock(options?: MockOptions): MockService
export function createEasyPostMock(options?: MockOptions): MockService
export function createFedexMock(options?: MockOptions): MockService
export function createUpsMock(options?: MockOptions): MockService
export function createDhlMock(options?: MockOptions): MockService

// Marketplace providers
export function createAmazonSpApiMock(options?: MockOptions): MockService
export function createShopifyMock(options?: MockOptions): MockService
export function createEbayMock(options?: MockOptions): MockService
export function createEtsyMock(options?: MockOptions): MockService
export function createWalmartMock(options?: MockOptions): MockService

// CRM providers
export function createHubspotMock(options?: MockOptions): MockService
export function createSalesforceMock(options?: MockOptions): MockService
export function createPipedriveMock(options?: MockOptions): MockService
export function createAttioMock(options?: MockOptions): MockService

// ERP/Inventory providers
export function createCin7Mock(options?: MockOptions): MockService
export function createDearMock(options?: MockOptions): MockService
export function createTradeGeckoMock(options?: MockOptions): MockService
export function createKatanaMock(options?: MockOptions): MockService

// Tax providers
export function createAvalaraMock(options?: MockOptions): MockService
export function createTaxJarMock(options?: MockOptions): MockService
export function createVertexMock(options?: MockOptions): MockService

// POS providers
export function createSquareTerminalMock(options?: MockOptions): MockService
export function createCloverMock(options?: MockOptions): MockService
export function createToastMock(options?: MockOptions): MockService
export function createLightspeedMock(options?: MockOptions): MockService

// Analytics providers
export function createSegmentMock(options?: MockOptions): MockService
export function createMixpanelMock(options?: MockOptions): MockService
export function createAmplitudeMock(options?: MockOptions): MockService
export function createRudderStackMock(options?: MockOptions): MockService

// Message Queue providers
export function createRabbitmqMock(options?: MockOptions): MockService
export function createKafkaMock(options?: MockOptions): MockService
export function createSqsMock(options?: MockOptions): MockService
export function createPubsubMock(options?: MockOptions): MockService
export function createRedisStreamsMock(options?: MockOptions): MockService

// Database providers
export function createPostgresMock(options?: MockOptions): MockService
export function createMysqlMock(options?: MockOptions): MockService
export function createMongodbMock(options?: MockOptions): MockService
export function createRedisMock(options?: MockOptions): MockService
export function createDynamodbMock(options?: MockOptions): MockService
export function createFirestoreMock(options?: MockOptions): MockService

// Spec-based mocks
export function createSpecMock(definition: {
  name?: string
  state?: Record<string, unknown>
  routes?: {
    method?: string
    path: string
    status?: number
    body?: unknown
    raw?: boolean
    headers?: Record<string, string>
  }[]
}): MockService

export function createSpecMockFromFile(path: string): Promise<MockService>

// Graceful shutdown
export function trackServer(server: any): void
export function untrackServer(server: any): void
export function closeAllServers(): Promise<void>
export function forceCloseAllServers(): Promise<void>
export function installSignalHandlers(): void

// Cassette recorder
export class Cassette {
  constructor(name: string)
  name: string
  interactions: any[]
  loaded: boolean
  playbackIndex: number
  load(): Promise<void>
  save(): Promise<void>
  record(fn: () => Promise<any>): Promise<any>
  play(fn: () => Promise<any>): Promise<any>
  nextResponse(): any
  reset(): void
  count: number
}
export function createCassette(name: string): Cassette
export async function withCassette(name: string, fn: (cassette: Cassette) => Promise<any>): Promise<any>
export function cassetteMiddleware(cassette: Cassette): { restore: () => void }
export { RECORD_MODE, PLAYBACK_MODE, cassettePath, loadCassette, saveCassette }
export { Cassette, createCassette, withCassette, cassetteMiddleware }

// Re-export from harness
export { MockService, MockRequest, json, text, readBody, toMatcher } from './harness.js'
export { Cassette, createCassette, withCassette, cassetteMiddleware, RECORD_MODE, PLAYBACK_MODE } from './cassette.js'