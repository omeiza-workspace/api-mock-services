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
  url: string
  port: number

  on(method: string, path: string | RegExp, handler: Function): this
  any(path: string | RegExp, handler: Function): this
  last(): RecordedRequest | undefined
  requestsFor(method?: string, path?: string): RecordedRequest[]
  listen(port?: number, host?: string): Promise<string>
  close(): Promise<void>
}

export function json(res: any, status: number, body: unknown): void
export function text(res: any, status: number, body: string): void
export function readBody(req: any): Promise<{ raw: string; json: any }>
export function toMatcher(path: string | RegExp): string | RegExp

export const MOCKS: Record<
  string,
  { create: (options?: MockOptions) => MockService; port: number; description: string }
>

export function startMock(name: string, options?: MockOptions): Promise<MockService>
export function startMocks(names: string[], options?: MockOptions): Promise<MockService[]>

export function createStripeMock(): MockService
export function createResendMock(): MockService
export function createXeroMock(): MockService
export function createCloudflareMock(): MockService
export function createPaystackMock(): MockService
export function createInterswitchMock(): MockService
export function createYouVerifyMock(): MockService
export function createOneSignalMock(options?: MockOptions): MockService
export function createTwilioMock(): MockService
