# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A documentation site in `docs/` — plain HTML, no build step, published by
  the Pages workflow.
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
