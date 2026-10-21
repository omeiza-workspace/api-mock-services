import { attachPanel } from './panel.js'
import { attachCheckout } from './checkout.js'

/**
 * The browser layer.
 *
 * Everything a person sees — the control panel, the hosted checkout — lives
 * here. The engine (`src/harness.js`) knows nothing about HTML: it records
 * requests, keeps state and answers over the control surface. This folder
 * turns that into pages.
 *
 * A service that wants a checkout says so on itself:
 *
 * ```js
 * service.checkout = {
 *   title: 'Paystack (mock)',
 *   find: (reference) => ({ reference, amount: '50.00', merchant: 'The shop' }),
 *   onDone: (reference, outcome) => recordIt(reference, outcome),
 * }
 * ```
 *
 * `attachViews` mounts the panel, and the checkout when the mock has one.
 */
export function attachViews(service) {
  attachPanel(service)
  attachCheckout(service)

  return service
}

export { attachPanel, panelPage, stateFragment, requestsFragment } from './panel.js'
export { attachCheckout, checkoutPage } from './checkout.js'
