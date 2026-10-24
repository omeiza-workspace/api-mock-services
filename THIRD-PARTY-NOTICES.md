# Third-party notices

The mocks in this package stand in for services that other people build and
run. This document says what that means, where the line is, and what is not
claimed.

## The short version

- **These are not the real services.** Every mock is a local program that
  answers like a provider's API. It is not connected to the provider in any
  way.
- **No request ever leaves the machine for a provider.** The engine makes no
  request to a provider's API, holds no provider credentials, and has no
  code that could. This is checked by a test, not promised in prose — see
  [the check](#the-check).
- **The project is not affiliated with, endorsed by, or sponsored by any of
  the providers named below.** The names are used only to say which API a
  given mock answers for.
- **The shapes are facts, not copies.** A field name, a path and a status
  code are the provider's interface. No provider's source code, artwork,
  logo or documentation is included in this package.

## What a mock is for

Running the code that talks to a provider, offline, without an account, at no
cost, and without a rate limit. That is what a test suite needs.

A mock is **not**:

- a proxy — nothing is forwarded to the provider;
- a sandbox — it does not model the provider's business rules, and it is not
  a staging environment;
- a way to avoid the provider's terms, pricing or limits in production.

If a feature needs the provider's real behaviour — a genuine signature, a
genuine settlement, a genuine risk decision — use the provider's own test
mode. The point of a mock is to test *your* code, not theirs.

## The trademarks

The names of the providers below are the trademarks of their owners. They are
used here in the ordinary way: to identify the API that a given mock answers
for. That is nominative use, and the project does not do anything that would
suggest otherwise:

- no logo, wordmark or brand asset is included;
- no mock is presented as being built, operated or endorsed by its provider;
- the README, the command line and the control panel all say plainly that
  these are mocks and not the real service;
- the URLs a mock hands back point at the mock itself, never at the
  provider's site, so a link in a test cannot take a developer — or a
  scraper — to the real service.

The providers keep whatever rights they have in their own names and APIs.
Nothing here grants a licence to use them.

## The credentials

There are none. A mock accepts any key, token or signature, because it has
nothing to check them against. That is what makes it useful in a test, and
it is also why a mock must never be exposed to a network you do not
control.

Do not put a real provider key in a mock's configuration, and do not point a
mock at a real provider's account. The mock has no way to use it — and the
habit of pasting a live key into a test is worth breaking anyway.

## The specifications

Some of the providers publish an OpenAPI specification. Where one is kept in
`specs/`, it is fetched from the provider's own public repository by
`scripts/update-specs.js`, and it stays under the provider's own licence.
Those files are not published in the npm package; they are kept so the mocks
can be checked against them.

## The providers

| Mock | Stands in for | Owner of the name and API |
|---|---|---|
| `stripe` | Stripe | Stripe, Inc. |
| `resend` | Resend | Resend, Inc. |
| `xero` | Xero | Xero Limited |
| `cloudflare` | Cloudflare | Cloudflare, Inc. |
| `paystack` | Paystack | Paystack (Flutterwave Technology Unlimited) |
| `interswitch` | Interswitch | Interswitch |
| `youverify` | YouVerify | YouVerify |
| `onesignal` | OneSignal | OneSignal, Inc. |
| `twilio` | Twilio | Twilio Inc. |
| `flutterwave` | Flutterwave | Flutterwave |
| `monnify` | Monnify | Monnify (Interswitch) |
| `termii` | Termii | Termii |
| `smileid` | Smile Identity | Smile Identity (Smile Identity Nigeria Limited) |
| `identitypass` | Identity Pass | Identity Pass (Smile Identity) |
| `whatsapp` | WhatsApp Cloud API | WhatsApp LLC (Meta Platforms, Inc.) |
| `fcm` | Firebase Cloud Messaging | Google LLC |
| `openai` | OpenAI and Anthropic API shapes | OpenAI and Anthropic, PBC |
| `s3` | Amazon S3 | Amazon.com, Inc. |
| `facebook` | Facebook Graph API | Meta Platforms, Inc. |
| `instagram` | Instagram Graph API | Meta Platforms, Inc. |
| `x` | X (formerly Twitter) API v2 | X Corp. |
| `bluesky` | Bluesky AT Protocol | Bluesky Social PBC and the Bluesky Foundation |
| `tiktok` | TikTok | TikTok (ByteDance Ltd.) |
| `youtube` | YouTube Data API | Google LLC |
| `linkedin` | LinkedIn | LinkedIn Corporation |
| `telegram` | Telegram Bot API | Telegram FZ-LLC |
| `reddit` | Reddit | Reddit, Inc. |
| `paypal` | PayPal | PayPal Holdings, Inc. |
| `square` | Square | Block, Inc. |
| `adyen` | Adyen | Adyen N.V. |
| `shippo` | Shippo | Shippo, Inc. |
| `easypost` | EasyPost | EasyPost, Inc. |
| `fedex` | FedEx | FedEx Corporation |
| `ups` | UPS | United Parcel Service, Inc. |
| `dhl` | DHL | Deutsche Post DHL Group |
| `amazon-sp-api` | Amazon SP-API | Amazon.com, Inc. |
| `shopify` | Shopify | Shopify Inc. |
| `ebay` | eBay | eBay Inc. |
| `etsy` | Etsy | Etsy, Inc. |
| `walmart` | Walmart | Walmart Inc. |
| `sendgrid` | SendGrid | Twilio Inc. |
| `mailchimp` | Mailchimp | The Rocket Science Group LLC (Intuit) |
| `klaviyo` | Klaviyo | Klaviyo, Inc. |
| `postmark` | Postmark | ActiveCampaign, LLC |
| `hubspot` | HubSpot | HubSpot, Inc. |
| `salesforce` | Salesforce | Salesforce, Inc. |
| `pipedrive` | Pipedrive | Pipedrive, Inc. |
| `attio` | Attio | Attio Technologies Ltd. |
| `quickbooks` | QuickBooks | Intuit Inc. |
| `netsuite` | NetSuite | Oracle Corporation |
| `sage` | Sage | The Sage Group plc |
| `cin7` | Cin7 | Cin7 Limited |
| `dear` | DEAR Systems | DEAR Systems (Cin7) |
| `tradegecko` | TradeGecko | TradeGecko (Cin7) |
| `katana` | Katana | Katana Manufacturing Software Limited |

The list is checked by a test: a mock that ships without a row here fails the
build.

## The check

The guarantee that nothing bridges to a provider is mechanical, not a promise:

```sh
npm test
```

`test/no-bridging.test.js` reads every line of the engine and the command
line, and fails if

- any provider's API host appears in the code at all — not in a request,
  which there are none of, and not in a link or a string that could become
  one; or
- any `fetch()` in the engine is given a literal address. Every one of them
  takes its address from the caller: a webhook the user configured, a
  notification server the user named.

The only requests the engine makes are to an address somebody handed it.

## If a provider objects

Write to the maintainers. A request can be honoured by removing the mock,
renaming it, or changing the shapes it answers with. That is the point of
keeping the mocks small, plain and easy to replace: a provider's objection
should cost a day, not a rewrite.
