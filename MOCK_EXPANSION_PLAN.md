# Mock Expansion Plan

## Goal
Add all missing services from the reference list to reach comprehensive coverage.

## Current State: 27 mocks
## Target: ~67 mocks (adding 40+)

---

## Batch 1: Payments (High Impact)
- [ ] PayPal
- [ ] Square
- [ ] Adyen

## Batch 2: Shipping (High Impact)
- [ ] Shippo
- [ ] EasyPost
- [ ] FedEx
- [ ] UPS
- [ ] DHL

## Batch 3: Marketplaces (High Impact)
- [ ] Amazon SP-API
- [ ] Shopify
- [ ] eBay
- [ ] Etsy
- [ ] Walmart

## Batch 4: Email/Marketing
- [ ] SendGrid
- [ ] Mailchimp
- [ ] Klaviyo
- [ ] Postmark

## Batch 5: CRM
- [ ] HubSpot
- [ ] Salesforce
- [ ] Pipedrive
- [ ] Attio

## Batch 6: Accounting (additional)
- [ ] QuickBooks
- [ ] NetSuite
- [ ] Sage

## Batch 7: ERP/Inventory
- [ ] Cin7
- [ ] DEAR
- [ ] TradeGecko (now Cin7)
- [ ] Katana

## Batch 8: Tax
- [ ] Avalara
- [ ] TaxJar
- [ ] Vertex

## Batch 9: POS Hardware
- [ ] Square Terminal
- [ ] Clover
- [ ] Toast
- [ ] Lightspeed

## Batch 10: Analytics
- [ ] Segment
- [ ] Mixpanel
- [ ] Amplitude
- [ ] RudderStack

---

## Per-Mock Checklist
For each new mock:
- [ ] Provider file in `src/providers/` (or new category file)
- [ ] Real API shapes (paths, fields, status codes, envelopes)
- [ ] State management (keeps what was sent/decided)
- [ ] Reference-decides pattern (success/fail in reference)
- [ ] `/health` endpoint
- [ ] `/_mock` identity (handled by engine)
- [ ] `x-mock-service-kind: mock` header (handled by engine)
- [ ] Tests in `test/` (at least 3: happy path, error path, edge case)
- [ ] Registration in `src/index.js` with port, category, description
- [ ] Entry in `THIRD-PARTY-NOTICES.md`
- [ ] Docker compose service in `examples/docker-compose.yml`
- [ ] Docs update in `docs/index.html` (mock table)
- [ ] Spec verification entry in `specs/sources.json` (where spec exists)
- [ ] Route inventory regenerates (`npm run routes --write`)

## Port Allocation Strategy
Current: 4000-4027 (27 mocks)
Next: 4028-4067 (40 mocks)

| Range | Category |
|-------|----------|
| 4028-4030 | PayPal, Square, Adyen |
| 4031-4035 | Shippo, EasyPost, FedEx, UPS, DHL |
| 4036-4040 | Amazon SP-API, Shopify, eBay, Etsy, Walmart |
| 4041-4044 | SendGrid, Mailchimp, Klaviyo, Postmark |
| 4045-4048 | HubSpot, Salesforce, Pipedrive, Attio |
| 4049-4051 | QuickBooks, NetSuite, Sage |
| 4052-4055 | Cin7, DEAR, TradeGecko, Katana |
| 4056-4058 | Avalara, TaxJar, Vertex |
| 4059-4062 | Square Terminal, Clover, Toast, Lightspeed |
| 4063-4066 | Segment, Mixpanel, Amplitude, RudderStack |

## Implementation Order
1. Create provider files (batch by batch)
2. Write tests for each batch
3. Register in index.js
4. Update THIRD-PARTY-NOTICES.md
5. Update docker-compose.yml
6. Update docs/index.html
7. Update specs/sources.json where applicable
8. Run `npm run routes --write`
9. Run full test suite
10. Commit batch

## Notes
- Prioritize providers with public OpenAPI specs for spec verification
- Use existing patterns: `MockService`, `json()`, `counter()`, `service.on()`
- Keep state on `service.state`
- Reference-decides: reference with `success`/`fail` determines outcome
- No external dependencies
- ES modules, 2-space indent, no semicolons