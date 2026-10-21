import { readFileSync } from 'node:fs'
import { render } from './panel.js'

/**
 * The hosted checkout.
 *
 * A payment mock that can only be driven from code is useful in a test but
 * not to a person. This is the little page a person can open, choose how the
 * payment goes, and see what happened — so a flow can be walked in a browser
 * without a real card.
 *
 * The page and the styles live in `templates/` and `assets/`, like the
 * panel's do.
 */

/** The page, and the styles, read once. */
const TEMPLATE = readFileSync(new URL('./templates/checkout.html', import.meta.url), 'utf8')
const STYLES = readFileSync(new URL('./assets/checkout.css', import.meta.url), 'utf8')

/**
 * The page, with the details of the payment put in.
 */
export function checkoutPage({ title = 'Pay', amount, reference, merchant = 'The shop', completeUrl }) {
  return render(TEMPLATE, { title, amount, reference, merchant, completeUrl, styles: STYLES })
}

/**
 * Put a checkout on a mock.
 *
 * The page is where a person completes the payment; the answer goes back to
 * the mock, which remembers how it went.
 *
 * The mock says what it is: `service.checkout` holds the title, how to find
 * the payment being made, and what to record when it is done.
 */
export function attachCheckout(service) {
  const checkout = service.checkout

  if (!checkout) return service

  const path = checkout.path ?? '/checkout/:reference'
  const completePath = `${path}/complete`

  service.on('GET', path, (req, res) => {
    const payment = checkout.find?.(String(req.params.reference))

    if (!payment) {
      res.statusCode = 404
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.end('<h1>Nothing to pay</h1>')
      return
    }

    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(
      checkoutPage({
        title: checkout.title ?? 'Pay',
        amount: payment.amount,
        reference: payment.reference,
        merchant: payment.merchant,
        completeUrl: `/checkout/${encodeURIComponent(payment.reference)}/complete`,
      }),
    )
  })

  service.on('POST', completePath, (req, res) => {
    const reference = String(req.params.reference)
    const outcome = req.json?.outcome ?? 'success'

    service.setOutcome(outcome)
    checkout.onDone?.(reference, outcome, req.json)

    res.statusCode = 200
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ outcome, reference }))
  })

  return service
}
