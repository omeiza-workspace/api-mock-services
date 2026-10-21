import { json } from './harness.js'

/**
 * The control panel.
 *
 * A person wants to see what the mock was asked and to decide how the next
 * call goes. This is that page.
 *
 * It is server-rendered HTML with a little HTMX on top — no build step, no
 * framework, no bundle. The buttons are real forms, so the page still works
 * when the script does not load.
 */

/** The page. */
export function panelPage(service) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${service.name} (mock)</title>
<script src="https://unpkg.com/htmx.org@2.0.4/dist/htmx.min.js"></script>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    background: #f6f6f7;
    color: #18181b;
  }
  header {
    background: #18181b;
    color: #fafafa;
    padding: 1rem 1.5rem;
    display: flex;
    align-items: baseline;
    gap: .75rem;
  }
  header h1 { margin: 0; font-size: 1.1rem; }
  header span { opacity: .65; font-size: .85rem; }
  main { max-width: 68rem; margin: 0 auto; padding: 1.5rem; display: grid; gap: 1.25rem; }
  section {
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 12px;
    padding: 1.1rem 1.25rem;
  }
  h2 { margin: 0 0 .75rem; font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; color: #71717a; }
  .row { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
  form { display: inline; }
  button {
    font: inherit; font-weight: 550; cursor: pointer;
    padding: .45rem .85rem; border-radius: 8px;
    border: 1px solid #d4d4d8; background: #fff; color: #18181b;
  }
  button.primary { background: #15803d; border-color: #15803d; color: #fff; }
  button.danger { color: #b91c1c; border-color: #fecaca; }
  button[aria-pressed="true"] { background: #18181b; border-color: #18181b; color: #fff; }
  .pill {
    display: inline-block; padding: .15rem .55rem; border-radius: 999px;
    background: #f4f4f5; border: 1px solid #e4e4e7; font-size: .8rem;
  }
  table { width: 100%; border-collapse: collapse; font-size: .85rem; }
  th, td { text-align: left; padding: .4rem .5rem; border-bottom: 1px solid #f4f4f5; }
  th { color: #71717a; font-weight: 550; }
  code { font-size: .8rem; color: #52525b; word-break: break-all; }
  .empty { color: #a1a1aa; font-size: .9rem; }
</style>
</head>
<body>
<header>
  <h1>${service.name}</h1>
  <span>the mock — ${service.url}</span>
</header>

<main>
  <section>
    <h2>The state</h2>
    <div id="state">${stateFragment(service)}</div>
  </section>

  <section>
    <h2>What it was asked</h2>
    <div id="requests" hx-get="/_panel/requests" hx-trigger="every 1s" hx-swap="innerHTML">
      ${requestsFragment(service)}
    </div>
  </section>
</main>
</body>
</html>`
}

/** The state, and the buttons that change it. */
export function stateFragment(service) {
  const outcome = service.state.outcome
  const failure = service.state.failure

  const outcomeButton = (value, label) => `
    <form method="post" action="/_control/outcome">
      <input type="hidden" name="outcome" value="${value}">
      <button type="submit" aria-pressed="${outcome === value}">${label}</button>
    </form>`

  const failureButton = (value, label) => `
    <form method="post" action="/_control/fail">
      <input type="hidden" name="kind" value="${value}">
      <input type="hidden" name="times" value="1">
      <button type="submit" class="danger">${label}</button>
    </form>`

  return `
  <div class="row">
    <span class="pill">the next payment: <strong>${outcome}</strong></span>
    ${outcomeButton('success', 'Succeeds')}
    ${outcomeButton('failed', 'Fails')}
    ${outcomeButton('cancelled', 'Is cancelled')}
  </div>
  <div class="row" style="margin-top:.6rem">
    <span class="pill">the next call: <strong>${failure ?? 'works'}</strong></span>
    ${failureButton('server', 'Answers 500')}
    ${failureButton('unauthorised', 'Answers 401')}
    ${failureButton('unavailable', 'Answers 503')}
    ${failureButton('timeout', 'Times out')}
    ${failureButton('network', 'The connection goes')}
  </div>
  <div class="row" style="margin-top:.6rem">
    <form method="post" action="/_control/webhook">
      <input type="hidden" name="send" value="true">
      <button type="submit">Send the webhook</button>
    </form>
    <form method="post" action="/_control/reset">
      <button type="submit">Forget everything</button>
    </form>
    <span class="pill">${service.requests.length} request(s)</span>
  </div>`
}

/** The requests, as a table. */
export function requestsFragment(service) {
  if (!service.requests.length) {
    return '<p class="empty">Nothing yet.</p>'
  }

  const rows = service.requests
    .slice(-40)
    .reverse()
    .map((request) => {
      const body = request.raw ? request.raw.slice(0, 120) : ''

      return `<tr>
        <td><code>${request.method}</code></td>
        <td><code>${request.path}</code></td>
        <td><code>${body}</code></td>
      </tr>`
    })
    .join('\n')

  return `<table>
    <thead><tr><th>Method</th><th>Path</th><th>Body</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

/**
 * The panel's routes.
 *
 * The forms post to the control surface ✓ — the same one the command line
 * uses ✓ — so the page and the CLI do the same thing ✓.
 */
export function panelRoutes(service) {
  service.on('GET', '/_panel', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(panelPage(service))
  })

  service.on('GET', '/_panel/requests', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(requestsFragment(service))
  })

  service.on('GET', '/_panel/state', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(stateFragment(service))
  })
}

/**
 * The control surface, as a form post.
 *
 * The panel's forms send a body; the command line sends JSON ✓. Both end
 * up in the same place ✓.
 */
export function readControlForm(body) {
  const values = {}

  for (const [key, value] of new URLSearchParams(body)) {
    values[key] = value
  }

  return values
}

export { json }
