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

export function createStripeMock(options?: MockOptions): MockService
export function createResendMock(options?: MockOptions): MockService
export function createXeroMock(options?: MockOptions): MockService
export function createCloudflareMock(options?: MockOptions): MockService
export function createPaystackMock(options?: MockOptions): MockService
export function createInterswitchMock(options?: MockOptions): MockService
export function createYouVerifyMock(options?: MockOptions): MockService
export function createOneSignalMock(options?: MockOptions): MockService
export function createTwilioMock(options?: MockOptions): MockService
export function createFlutterwaveMock(options?: MockOptions): MockService
export function createMonnifyMock(options?: MockOptions): MockService
export function createTermiiMock(options?: MockOptions): MockService
export function createSmileIdMock(options?: MockOptions): MockService
export function createIdentityPassMock(options?: MockOptions): MockService
export function createWhatsAppMock(options?: MockOptions): MockService
export function createFcmMock(options?: MockOptions): MockService
export function createOpenAIMock(options?: MockOptions): MockService
export function createS3Mock(options?: MockOptions): MockService

/** A mock written as a route file rather than as code. */
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

/** A mock written as a route file on disk — JSON, or a module. */
export function createSpecMockFromFile(path: string): Promise<MockService>
