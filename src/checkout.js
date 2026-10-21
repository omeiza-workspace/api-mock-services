/**
 * The hosted checkout.
 *
 * A payment mock that can only be driven from code is useful in a test but
 * not to a person. This is the little page a person can open, choose how the
 * payment goes, and see what happened — so a flow can be walked in a browser
 * without a real card.
 */

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{title}}</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    background: #f4f4f5;
    font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #18181b;
  }
  main {
    width: min(26rem, calc(100vw - 2rem));
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 14px;
    padding: 1.75rem;
    box-shadow: 0 10px 30px rgb(0 0 0 / 6%);
  }
  h1 { margin: 0 0 .25rem; font-size: 1.25rem; }
  p.sub { margin: 0 0 1.25rem; color: #71717a; font-size: .9rem; }
  dl { display: grid; gap: .4rem; margin: 0 0 1.25rem; font-size: .9rem; }
  .row { display: flex; justify-content: space-between; gap: 1rem; }
  .row dt { color: #71717a; }
  .row dd { margin: 0; font-variant-numeric: tabular-nums; }
  .amount { font-size: 1.6rem; font-weight: 650; margin: .25rem 0 1.25rem; }
  .buttons { display: grid; gap: .6rem; }
  button {
    font: inherit;
    font-weight: 550;
    padding: .7rem 1rem;
    border-radius: 10px;
    border: 1px solid transparent;
    cursor: pointer;
  }
  .pay { background: #15803d; color: #fff; }
  .fail { background: #fff; color: #b91c1c; border-color: #fecaca; }
  .cancel { background: #fff; color: #71717a; border-color: #e4e4e7; }
  .done { font-size: .9rem; color: #71717a; }
  code { font-size: .8rem; word-break: break-all; color: #52525b; }
</style>
</head>
<body>
<main>
  <h1>{{title}}</h1>
  <p class="sub">This is a stand-in. No money moves.</p>

  <p class="amount">{{amount}}</p>

  <dl>
    <div class="row"><dt>Reference</dt><dd><code>{{reference}}</code></dd></div>
    <div class="row"><dt>Merchant</dt><dd>{{merchant}}</dd></div>
  </dl>

  <div class="buttons" id="buttons">
    <button class="pay" data-outcome="success">Pay</button>
    <button class="fail" data-outcome="failed">Fail the payment</button>
    <button class="cancel" data-outcome="cancelled">Cancel</button>
  </div>

  <p class="done" id="done" hidden></p>
</main>

<script>
  const buttons = document.getElementById('buttons')
  const done = document.getElementById('done')

  buttons.addEventListener('click', async (event) => {
    const button = event.target.closest('button')
    if (!button) return

    const outcome = button.dataset.outcome

    await fetch('{{completeUrl}}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome, reference: '{{reference}}' }),
    })

    buttons.hidden = true
    done.hidden = false
    done.textContent = outcome === 'success'
      ? 'Paid. The shop has been told.'
      : outcome === 'failed'
            ? 'The payment failed.'
            : 'The payment was cancelled.'
  })
</script>
</body>
</html>`

/**
 * The page, with the details of the payment put in.
 */
export function checkoutPage({ title = 'Pay', amount, reference, merchant = 'The shop', completeUrl }) {
  return PAGE.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = { title, amount, reference, merchant, completeUrl }[key]

    return value === undefined ? '' : String(value)
  })
}

/**
 * Put a checkout on a mock.
 *
 * The page is where a person completes the payment; the answer goes back to
 * the mock, which remembers how it went.
 *
 * @param service  the mock to put it on
 * @param path     where the page is, e.g. '/checkout/:reference'
 * @param title    what the page says
 * @param find     given the reference, what is being paid
 * @param onDone   given the reference and the outcome, what to record
 */
export function addCheckout(service, { path = '/checkout/:reference', title = 'Pay', find, onDone }) {
  const completePath = path.replace(':reference', ':reference') + '/complete'

  service.on('GET', path, (req, res) => {
    const payment = find(String(req.params.reference))

    if (!payment) {
      res.statusCode = 404
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.end('<h1>Nothing to pay</h1>')
      return
    }

    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(
      checkoutPage({
        title,
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
    onDone?.(reference, outcome, req.json)

    res.statusCode = 200
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ outcome, reference }))
  })
}
