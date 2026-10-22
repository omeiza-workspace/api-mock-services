# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-21

### Added

- Eighteen mocks in one dependency-free process: Stripe, Paystack,
  Interswitch, Flutterwave, Monnify, YouVerify, Smile ID, Identity Pass,
  Twilio, Termii, OneSignal, WhatsApp, Firebase Cloud Messaging, Resend,
  Xero, Cloudflare, an OpenAI-compatible model mock and an S3-compatible
  storage mock.
- A documentation site, an architecture note, an adopter list that grows by
  pull request, and a `llms.txt` for the coding agents that read
  repositories.
- Mocks written as route files, contributed as files, and started from the
  command line.
- A `/health` endpoint on every mock.

### Fixed

- The footprint gate was intermittently failing. Its idle budget was 1%
  over a three-second sampling window, and the engine's idle figure is a
  trickle of around half a percent — so over three seconds the reading
  landed anywhere between 0% and 2% depending on what the operating system
  happened to schedule. The gate failed two runs in three on an idle
  machine, and CI runs it. The window is now ten seconds and the budget 2%,
  which is four times above what the engine uses and four times below the
  7.9% it exists to catch.

### Changed

- The README now quotes ranges for memory, idle CPU and time to the first
  request, and names the script that produces them. The first-request
  measurement moves by a factor of three with machine load, so publishing
  one sample as *the* figure was a number that happened to be true once.

## [Unreleased]

### Added

- Nine social mocks: Facebook, Instagram, X, Bluesky, Telegram, Reddit,
  LinkedIn, TikTok and YouTube — 27 mocks in all. The LinkedIn mock serves
  both the older `/v2/posts` shape and the current `/rest/posts` one, with
  the id in the `x-restli-id` header, the OAuth exchange, and the
  authorization redirect.
- Every mock answers `/_mock` with what it is, and every answer carries
  `x-mock-service-kind: mock` — so an agent, a script or a crawler can tell
  it is not talking to the real service.
- `AGENT-SAFETY.md` — the rules for anything calling a mock.
- `THIRD-PARTY-NOTICES.md` — what each mock stands in for, and where the
  line is with every provider's terms.
- `npm run specs` — every route a mock serves, checked against the
  provider's own published specification. A route that has drifted fails the
  build.
- `npm run routes` and `docs/ROUTES.md` — the inventory of every endpoint
  every mock serves, generated from the code.
- The `social` category, and a compose profile for it.

### Changed

- A mock keeps the path a route was written with, beside the matcher it is
  matched by — so the routes of a mock can be read, listed and checked.

### Fixed

- The container listens on every interface, so a published port actually
  reaches the mock. It was bound to the container's own loopback, and
  answered nothing.
- `make footprint` works again: two targets had been defined for it, and the
  stale one won.
- `--port` was applied to every mock named, so starting two of them with a
  port put them both on the same one. A port given on the command line is
  now the first one, and the rest follow it.
- The footprint run picks a free port from the private range, so a run left
  behind by an earlier one cannot get in its way — and it fails loudly
  rather than reporting a measurement of a process that is not there.
- A documentation site in `docs/` — plain HTML, one stylesheet, no build
  step, published by the Pages workflow.
- `scripts/update-specs.js` and a `Specs` workflow: the specifications the
  mocks are checked against are fetched from the providers' own repositories
  on a schedule, and the difference is committed for a human to look at.
- `ARCHITECTURE.md` — why the project is built the way it is.
- `ADOPTERS.md` — the list of who uses it, added by pull request.
- `llms.txt` — a short guide for the coding agents that read repositories.
- Flutterwave, Monnify, Termii, Smile ID, Identity Pass, WhatsApp Cloud API,
  Firebase Cloud Messaging, an OpenAI-compatible model mock and an
  S3-compatible storage mock — 18 mocks in all.
- Categories, so the mocks are grouped by what they stand in for: payments,
  identity, messaging, email, accounting, DNS, AI and storage.
- `api-mock-services file ./mocks/acme.json` — a mock written as a route
  file, started from the command line.
- `api-mock-services env` — the environment for the whole stack, in one line.
- `contrib/` — mocks contributed as files, with no code in them.
- A `/health` endpoint on every mock, so a container health check has
  something to ask.
- Compose profiles, so a project starts the group of mocks it needs rather
  than all eighteen.

### Changed

- The browser layer moved out of the engine. The panel and the checkout are
  in `src/ui/`, with the markup in `templates/` and the styles in `assets/`.
  The engine in `src/harness.js` no longer knows anything about HTML.
- A provider now declares its checkout with `service.checkout` instead of
  calling into the UI.
- The package is MIT and publishable, and the repository has the licence,
  the contributing guide, the code of conduct, the security policy and the
  issue templates.

### Fixed

- The container listens on every interface, so a published port actually
  reaches the mock. It was bound to the container's own loopback, which
  meant `docker run -p 4001:4001` answered nothing.
- `createSpecMock` and `createSpecMockFromFile` are exported from the
  package, which the README said they were.
- The README no longer repeats the container section, and the environment
  variables it lists are the ones the command line actually prints.

## [1.0.0]

### Added

- The first release: Stripe, Resend, Xero, Cloudflare, Paystack, Interswitch,
  YouVerify, OneSignal and Twilio.
- The control panel, the hosted checkout, the control surface and the
  command line.
