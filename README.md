# api-mock-services

[![CI](https://github.com/omeiza-workspace/api-mock-services/actions/workflows/ci.yml/badge.svg)](https://github.com/omeiza-workspace/api-mock-services/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@bytesickle/api-mock-services.svg)](https://www.npmjs.com/package/@bytesickle/api-mock-services)
[![node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![licence](https://img.shields.io/badge/licence-MIT-green.svg)](LICENSE)

Stand-ins for the outside world.

Every project that talks to a payment gateway, an email provider, an
accounting service, a DNS provider, a messaging service or an identity check
needs something to talk to **in a test**. This is that something — one
implementation, shared, instead of a copy in every repository.

There are no dependencies. The mocks are built on Node's own HTTP server, so
they run in a test, in a container and on a laptop without being installed
first.

It is also light. One process holding every mock you need takes about 50MB of
memory and nothing at all at rest — a fraction of what a JVM-based mock
engine costs per container.

---

## What it costs

Measured on a laptop with all nine mocks running, against the four
containers this replaces:

| | this engine | four containers |
|---|---|---|
| processes | 1 | 4 |
| memory | 50 MB | 250 MB |
| idle CPU | 0.0% | 7.9%, almost all of it the OpenAPI proxy |
| time to first request answered | 1.4 s | 20 s and rising |
| things to start, stop and clean up | 1 | 4 |

The numbers are the reason for the rules below.

## The rules

These are not preferences. They are what keeps the engine light, and a
contributor who breaks one of them breaks the promise in the first line of
this file.

- **No dependencies.** Not "few" — none. The engine runs on Node's own HTTP
  server. A dependency is a package to install, audit and keep out of the
  advisories.
- **No runtime that costs memory to start.** A JVM, a compiled Go binary or
  a Python environment all add to the footprint before a single request is
  served. Node is already on the machine, because the project under test
  runs on it.
- **One process for every mock.** Nine mocks in one process cost 50MB. Nine
  containers cost nine runtimes.
- **In the test, not beside it.** A test that needs a mock starts it in the
  test process, with `startMock()`. Nothing listens on a port, no container
  starts, and the mock stops when the test ends. This is the cheapest way
  to mock anything, and it is why the engine is a library first and a
  service second.
- **Idle means idle.** A mock answers a request and then stops computing.
  Polling, watching and retrying are how a mock turns into a battery drain.

---

## The mocks there are

**Payments**

| Mock | What it stands in for | Port |
|---|---|---|
| `stripe` | The card payments — PaymentIntents, refunds, the webhook | 4001 |
| `paystack` | The card payments (Nigeria) | 4005 |
| `interswitch` | The card payments (Nigeria, Interswitch) | 4006 |
| `flutterwave` | The card payments (Nigeria, Flutterwave) | 4010 |
| `monnify` | The bank rails (Nigeria) — reserved virtual accounts | 4011 |

**Identity**

| Mock | What it stands in for | Port |
|---|---|---|
| `youverify` | The identity checks | 4007 |
| `smileid` | The identity checks (Nigeria, Smile ID) — BVN, NIN, licences | 4013 |
| `identitypass` | The identity checks (Nigeria) — people and businesses | 4014 |

**Messaging**

| Mock | What it stands in for | Port |
|---|---|---|
| `twilio` | The SMS | 4009 |
| `termii` | The SMS (Nigeria, Termii) | 4012 |
| `onesignal` | The push notifications | 4008 |
| `whatsapp` | The WhatsApp messages (Cloud API) | 4015 |
| `fcm` | The push notifications (Firebase) | 4016 |

**Everything else**

| Mock | What it stands in for | Port |
|---|---|---|
| `resend` | The email — sending domains, the DNS records, sending | 4002 |
| `xero` | The accounting — tokens, connections, invoices | 4003 |
| `cloudflare` | The DNS — zones, records | 4004 |
| `openai` | The model calls — OpenAI and Anthropic shapes | 4017 |
| `s3` | The buckets and the objects (S3) | 4018 |

Every mock answers `/health`, so a container can be checked without knowing
which mock it is.

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

One image, one process, as many mocks as you like:

```bash
docker run --rm -p 4001:4001 -p 4005:4005 api-mock-services stripe paystack
```

Or all of them at once, with the example compose file. The compose file is
grouped into profiles, so a project only starts what it needs — a category
of two or three containers rather than all eighteen:

```bash
docker compose -f examples/docker-compose.yml --profile payments up -d
docker compose -f examples/docker-compose.yml --profile identity up -d
docker compose -f examples/docker-compose.yml --profile messaging up -d
docker compose -f examples/docker-compose.yml --profile all up -d
```

The profiles are `payments`, `identity`, `messaging`, `email`, `accounting`,
`dns`, `ai`, `storage` and `all`.

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

The markup is in `src/ui/templates/`, the styles in `src/ui/assets/`. To
change the look of the panel, change the CSS. To change what it says, change
the template. Neither needs a line of JavaScript touched.

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
docker compose -f examples/docker-compose.yml --profile all up -d
```

```
PAYSTACK_API_URL=http://localhost:5001
FLUTTERWAVE_API_URL=http://localhost:4010/v3
TERMII_API_URL=http://localhost:4012
WHATSAPP_API_URL=http://localhost:4015
OPENAI_API_BASE=http://localhost:4017/v1
```

The command line prints the environment variable for each mock as it starts,
so there is nothing to copy by hand.

### Driving it from the command line

Once a mock is running, it can be told what to do:

```bash
api-mock-services pay stripe failed       # the next payment fails
api-mock-services error stripe server     # the next call answers 500
api-mock-services error stripe timeout 3  # the next three calls time out
api-mock-services webhook stripe resend   # send the webhook again
api-mock-services reset stripe            # forget everything
api-mock-services logs stripe             # watch the requests
```

The kinds of failure are `server`, `unauthorised`, `unavailable`, `timeout`
and `network`.

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

A route file can also be a file on disk, and started from the command line:

```bash
api-mock-services file ./mocks/acme.json
```

### A mock contributed as a file

[`contrib/`](contrib/README.md) is where a mock that somebody else
contributed lives. Drop a route file in, and it runs — no code, no build
step, nothing to review as JavaScript:

```bash
api-mock-services file contrib/mpesa.json
```

---

## The command line

```bash
api-mock-services list                    # what there is, by category
api-mock-services start stripe resend     # start some
api-mock-services start stripe --port 4100
api-mock-services env                     # the environment for the whole stack
```

Each one prints the URL, the environment variable that points an app at it,
and the address of the panel.

Pointing a whole application at the stack is one line:

```bash
eval $(api-mock-services env)
```

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

Register it in `src/index.js`, give it a port, a category and a description,
and it is ready to use from the command line, from a container and from a
test.

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

## The layout

The engine and the browser are two things, and they do not mix.

```
src/
  harness.js     the engine — routes, state, the control surface
  index.js       the public API
  spec.js        a mock written as a route file
  providers/     the mocks, one file per group of them
  ui/            everything a person sees: HTML, CSS, the panel
```

`src/harness.js` knows nothing about HTML. It records requests, keeps state
and answers over the control surface — `/_control`, which the command line
and the panel both drive. The browser layer is put on a mock by
`attachViews`, and it is the only thing that renders anything.

```js
import { MockService } from '@bytesickle/api-mock-services'
import { attachViews } from '@bytesickle/api-mock-services/ui'

const service = attachViews(new MockService('acme'))
```

A provider that wants a checkout says so on itself, rather than reaching
into the browser layer:

```js
service.checkout = {
  title: 'Acme (mock)',
  find: (reference) => ({ reference, amount: '10.00', merchant: 'The shop' }),
  onDone: (reference, outcome) => recordIt(reference, outcome),
}
```

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

### The CI kit

This package is the mock engine the [CI kit](https://github.com/omeiza-workspace/ci-kit)
drives, so the two fit together:

```bash
make mocks-up      # start the mocks the tests need
make mocks-status  # are they answering?
make mocks-down    # stop them
```

The configuration is in [`.ci/ci.json`](.ci/ci.json). The kit starts the
mocks in the background, waits for them to answer, and shuts them down
again — so a test run never leaves a container behind, and never needs a
cloud runner.

---

## The tests

```bash
npm test        # the tests
npm run lint    # the house style
npm run check   # both
npm run footprint  # are the mocks still light?
```

Each mock is started and asked something, so a broken one is caught here
rather than in a project that depends on it.

The footprint is a budget, and it is checked in CI: eighteen mocks in one
process, about 50MB of memory, under 1% CPU while idle, and answering in
under half a second. If a change makes the mocks heavier, the build fails.

---

## Contributing

Pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the
house rules, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for the behaviour
that is expected of everyone taking part.

The short version: no new dependencies, the provider's real shapes, and a
test that would fail without your change.

### Adding yourself as an adopter

If your team uses these mocks, add a row to [ADOPTERS.md](ADOPTERS.md) in a
pull request — a name, what you use it for, and a logo if you have one. It
is a pull request, so the list is public, dated, and cannot be inflated.

---

## Support the project

The mocks are maintained in the open, and that takes time.

If they have saved you a flaky test, a slow suite, or a bill from a
provider's test environment, consider sponsoring the maintenance:

- **🏢 For teams** — [GitHub Sponsors](https://github.com/sponsors/omeiza-workspace).
  If a team of ten uses these mocks, the hours saved are worth an hour of
  your company's budget.
- **☕ For individuals** — [Buy Me a Coffee](https://buymeacoffee.com/omeiza-workspace).
  A quick thank-you for a tool that kept your test suite offline.

<!-- Maintainer: replace the Buy Me a Coffee link above with the account
     that exists, and uncomment buy_me_a_coffee in .github/FUNDING.yml. -->

There is no paid tier and nothing is gated: the package stays MIT, and every
mock in it stays free. Sponsorship pays for the time spent on issues, the
platforms it runs on, and the releases.

If sponsoring is not your thing, a star, an issue report, or a pull request
that fixes something is worth just as much.

---

## More

- [ARCHITECTURE.md](ARCHITECTURE.md) — why it is built this way.
- [ADOPTERS.md](ADOPTERS.md) — who uses it.
- [The site](https://omeiza-workspace.github.io/api-mock-services) — the same
  thing, as a page.
- [CI Kit](https://github.com/omeiza-workspace/ci-kit) — works beautifully
  with this: the gates that run a repository's tests locally, before
  anything reaches a runner.

---

## Licence

MIT. See [LICENSE](LICENSE).
