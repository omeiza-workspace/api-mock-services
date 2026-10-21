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
