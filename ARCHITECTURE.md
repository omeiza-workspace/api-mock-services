# Architecture

Why the project is built the way it is. The short version: **one
implementation, no dependencies, and a promise that is checked**.

## The shape

```
src/
  harness.js     the engine — routes, state, the control surface
  index.js       the public API
  spec.js        a mock written as a route file
  providers/     the mocks, one file per group of them
  ui/            everything a person sees: HTML, CSS, the panel
    templates/   the markup
    assets/      the styles
```

### The engine knows nothing about HTML

`src/harness.js` does four things: it matches a request to a route, it
records what it was asked, it keeps the state the mock decided on, and it
answers over a control surface (`/_control`).

Everything a person sees — the control panel, the hosted checkout — lives in
`src/ui/` and is put on a mock by `attachViews`. The two are separated on
purpose:

- The engine can be used without the browser. `new MockService('acme')` is
  a perfectly good mock; it simply has no page until the browser layer is
  attached.
- The page can be changed without touching the engine. The markup is in
  `templates/`, the styles in `assets/`, and the browser code is in the
  template itself.
- Neither has to know about the other. The engine does not import the UI,
  and the UI does not import a provider.

A provider that wants a checkout declares it, rather than reaching into the
browser layer:

```js
service.checkout = {
  title: 'Acme (mock)',
  find: (reference) => ({ reference, amount: '10.00', merchant: 'The shop' }),
  onDone: (reference, outcome) => recordIt(reference, outcome),
}
```

The UI mounts it; the engine never looks at it.

## The control surface

`/_control` is the API the command line and the panel both drive:

| Route | What it does |
|---|---|
| `POST /_control/outcome` | Choose how the next payment goes |
| `POST /_control/fail` | Make the next call fail — server, unauthorised, unavailable, timeout, network |
| `POST /_control/webhook` | Set the webhook settings, and send it |
| `POST /_control/reset` | Forget everything |
| `GET /_control/requests` | Everything the mock was asked |
| `GET /_control/logs` | The requests, as they happen (SSE) |

The panel is a view of it. The command line is a client of it. They cannot
drift, because there is only one implementation.

## No dependencies

There are none — not at runtime, not in the tests, not in the lint. Node is
the whole toolchain. This is not asceticism; it is the thing that makes the
mocks easy to adopt:

- A project can depend on the package without an install step of its own.
- A contributor can add a mock without learning a framework.
- The container image has nothing in it to install, so it stays small and
  starts instantly.

The lint is the clearest example. There is no eslint in it; `scripts/lint.js`
parses every file with `node --check` and checks the house style — no
semicolons, no trailing whitespace, a newline at the end. The footprint
budget is the same idea: `scripts/footprint.js` measures the running mocks
with node and `ps`.

## The promise that is checked

The README says the mocks are light. A promise nobody checks is a promise
that erodes, so it is a budget, and it fails the build:

```sh
npm run footprint
```

```
  mocks       18 in one process
  memory      51 MB
  idle CPU    0.3%
  startup     432 ms

  budgets: memory <= 120 MB, startup <= 5000 ms, idle CPU <= 1%
```

The budgets are deliberately loose. They catch a regression that adds a
runtime — a dependency, a poller, a timer that never stops — not a
difference between two machines.

## The categories

The mocks are grouped by what they stand in for, and the grouping is part of
the API:

```js
export const CATEGORIES = {
  payments: { title: 'Payments', description: 'The card and the bank rails' },
  identity: { title: 'Identity', description: 'The KYC and the verification checks' },
  messaging: { title: 'Messaging', description: 'The text, the WhatsApp and the push' },
  email: { title: 'Email', description: 'The sending domains and the mail itself' },
  accounting: { title: 'Accounting', description: 'The books' },
  dns: { title: 'DNS', description: 'The zones and the records' },
  ai: { title: 'AI', description: 'The model calls' },
  storage: { title: 'Storage', description: 'The buckets and the objects' },
}
```

The compose file uses the same names as profiles, so `--profile payments`
starts the payment mocks and nothing else. A project should not pay for
eighteen containers to test one flow.

## One process, many mocks

`api-mock-services start stripe paystack flutterwave` starts three servers
in one process, on one port each. That is the difference between one
container and three, and between 51MB and 153MB.

It also means the mocks share a fate: one `SIGTERM` stops all of them, and
the ports are freed properly.

## The rules a mock keeps

- **The real shape.** The paths, the fields and the status codes are the
  provider's, so the code under test does not change when it is pointed at
  a mock.
- **The state is kept.** What the service was asked, and what it decided, is
  on `service.state` and `service.requests`.
- **The reference decides.** A reference with `success` in it comes back
  successful, one with `failed` in it comes back failed — so a test can ask
  for either without a special flag.
- **No dependencies.** Node's own server, so it runs anywhere.

## Where it fits next to CI Kit

[CI Kit](https://github.com/omeiza-workspace/ci-kit) runs a repository's
gates locally, before anything reaches a runner. This package is the mock
engine those gates can point at.

The kit starts the mocks in the background, waits for them to answer, runs
the tests against them, and shuts them down again. The configuration is in
`.ci/ci.json`:

```json
{
  "mocks": {
    "command": "node bin/api-mock-services.js start stripe paystack",
    "endpoints": {
      "stripe": "http://127.0.0.1:4001",
      "paystack": "http://127.0.0.1:4005"
    }
  }
}
```

So `make mocks-up`, `make mocks-status` and `make mocks-down` work here,
and a project that uses both gets the same loop in CI and on a laptop.

## Deliberate decisions, and why

**Not DNS masquerading.** Hijacking `api.paystack.co` needs a CA
certificate installed, rights to change `/etc/hosts`, and it leaks real
traffic for any domain the mock does not cover. The alternative is one line
with no certificate and nothing to clean up:

```bash
eval $(api-mock-services env)
```

**Not a Go or Rust rewrite.** A native binary would be lighter and start
faster. It would also mean a build step, a toolchain, and a contributor who
cannot simply add a mock. The memory is already 51MB for eighteen mocks,
and it is measured. The shareability is worth more than the last 30MB.

**Not schema-driven everywhere.** A specification describes a shape; it does
not describe a state machine. A payment that is created, then paid, then
refunded cannot be expressed in a `.yaml`, so those mocks are written as
code. For the services that are only read from, a route file is enough —
and `createSpecMock` fills the placeholders in without a YAML parser and
without a dependency.
