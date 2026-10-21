# api-mock-services

Stand-ins for the outside world.

Every project that talks to a payment gateway, an email provider, an
accounting service, a DNS provider, a messaging service or an identity check
needs something to talk to **in a test**. This is that something — one
implementation, shared, instead of a copy in every repository.

There are no dependencies. The mocks are built on Node's own HTTP server, so
they run in a test, in a container and on a laptop without being installed
first.

---

## The mocks there are

| Mock | What it stands in for | Port |
|---|---|---|
| `stripe` | The card payments — PaymentIntents, refunds, the webhook | 4001 |
| `resend` | The email — sending domains, the DNS records, sending | 4002 |
| `xero` | The accounting — tokens, connections, invoices | 4003 |
| `cloudflare` | The DNS — zones, records | 4004 |
| `paystack` | The card payments (Nigeria) | 4005 |
| `interswitch` | The card payments (Nigeria, Interswitch) | 4006 |
| `youverify` | The identity checks | 4007 |
| `onesignal` | The push notifications | 4008 |
| `twilio` | The SMS | 4009 |

---

## Using it in a test

Add it as a dependency:

```json
{
  "devDependencies": {
    "@bytesickle/api-mock-services": "file:../api-mock-services"
  }
}
```

Then start the mock the test needs, and point the app at it:

```js
import { startMock } from '@bytesickle/api-mock-services'

const stripe = await startMock('stripe')

process.env.NUXT_STRIPE_API_BASE = `${stripe.url}/v1`

// ... the test ...

await stripe.close()
```

The mock remembers what it was asked, so the test can say what really
happened:

```js
expect(stripe.last().path).toBe('/v1/refunds')
expect(stripe.state.refunds[0].payment_intent).toBe('pi_test_1')
```

---

## Using it as a container

```bash
docker build -t api-mock-services -f docker/Dockerfile .
docker run --rm -p 4001:4001 api-mock-services stripe
```

Or all of them at once, with the example compose file:

```bash
docker compose -f examples/docker-compose.yml up -d
```

---

## The control panel

Every mock has a page of its own, at `/_panel`:

```
http://127.0.0.1:4001/_panel
```

It shows what the mock was asked, and it lets you decide what happens next:

- **The next payment** succeeds, fails, or is cancelled.
- **The next call** answers 500, is refused, times out, or the connection
  goes with nothing on it.
- **The webhook** is sent again.
- The requests are shown as they come in.

It is server-rendered HTML with a little HTMX on top — no build step, no
framework, no bundle. The buttons are real forms, so the page works even
when the script does not load.

---

## Using it from another project

The package is plain JavaScript with no dependencies, so it works from
anything that runs Node. But it does not have to be Node — the mocks answer
over HTTP, so a project in any language can use them.

### Node, in a test

```js
import { startMock } from '@bytesickle/api-mock-services'

const stripe = await startMock('stripe')

process.env.NUXT_STRIPE_API_BASE = `${stripe.url}/v1`

// ... the test ...

await stripe.close()
```

### Any language, over HTTP

Start the mock in a container, or with the command line, and point the
application at it:

```bash
docker compose -f examples/docker-compose.yml up -d
```

```
PAYSTACK_API_URL=http://localhost:5001
PAYSTACK_API_URL=http://localhost:5002
YOUVERIFY_API_URL=http://localhost:9010
```

### Driving it from the command line

Once a mock is running, it can be told what to do:

```bash
api-mock-services pay stripe failed      # the next payment fails
api-mock-services error stripe 500       # the next call answers 500
api-mock-services webhook stripe resend  # send the webhook again
api-mock-services reset stripe           # forget everything
api-mock-services logs stripe            # watch the requests
```

### A mock written as a file

Most providers are worth a hand-written mock, because their flows have
state. But a service that is only read from does not — and for those, a
route file is enough:

```js
import { createSpecMock } from '@bytesickle/api-mock-services'

const acme = createSpecMock({
  name: 'acme',
  routes: [
    { method: 'GET', path: '/v1/things', body: { things: [] } },
    { method: 'GET', path: '/v1/things/:id', body: { id: '{{params.id}}' } },
  ],
})
```

The placeholders are filled in from the request: `{{params.id}}` from the
path, `{{query.q}}` from the query string, `{{body.email}}` from the body,
`{{header.authorization}}` from a header, and `{{state.anything}}` from
what the mock keeps.

---

## The Makefile

```bash
make          list the targets
make test     the local tests
make pre-ci   the local tests — the step the CI depends on
make ci       the local tests, then the CI gate
make mocks    start the mocks, for a project to point at
make docker   build the container image
make compose  start every mock as a container
```

The local test is the gate: `make ci` runs it first, so nothing reaches a
runner that has not been through the same tests on this machine.

---

```bash
docker build -t api-mock-services .
docker run --rm -p 4001:4001 api-mock-services stripe
```

Or all of them at once, with the example compose file:

```bash
docker compose -f examples/docker-compose.yml up -d
```

---

## The command line

```bash
api-mock-services list                    # what there is
api-mock-services start stripe resend     # start some
api-mock-services start stripe --port 4100
```

Each one prints the URL and the environment variable that points an app at it.

---

## Adding a mock

A mock is a service with routes on it:

```js
import { MockService, json } from '@bytesickle/api-mock-services'

export function createAcmeMock() {
  const service = new MockService('acme')

  service.on('GET', '/things', (req, res) => {
    json(res, 200, { things: [] })
  })

  return service
}
```

Register it in `src/index.js`, give it a port and a description, and it is
ready to use from the command line, from a container and from a test.

The rules the existing mocks keep to:

- **The real shape.** The paths, the fields and the status codes are the
  provider's, so the code under test does not change when it is pointed at a
  mock.
- **The state is kept.** What the service was asked, and what it decided, is
  on `service.state` and `service.requests`.
- **The reference decides.** A Paystack reference with `success` in it comes
  back successful, one with `failed` in it comes back failed — so a test can
  ask for either without a special flag.
- **No dependencies.** Node's own server, so it runs anywhere.

---

## The tests

```bash
npm test
```

Each mock is started and asked something, so a broken one is caught here
rather than in a project that depends on it.
