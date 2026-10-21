import { readFileSync } from 'node:fs'

/**
 * The control panel.
 *
 * A person wants to see what the mock was asked and to decide how the next
 * call goes. This is that page.
 *
 * It is server-rendered HTML with a little HTMX on top — no build step, no
 * framework, no bundle. The buttons are real forms, so the page still works
 * when the script does not load.
 *
 * The markup and the styles live in `templates/` and `assets/`, so the look
 * of the panel can be changed without touching this file.
 */

/** The page, and the styles, read once. */
const TEMPLATE = readFileSync(new URL('./templates/panel.html', import.meta.url), 'utf8')
const STYLES = readFileSync(new URL('./assets/panel.css', import.meta.url), 'utf8')

/**
 * Put the values into the template.
 *
 * One pass, so a value that itself looks like a placeholder — a request body
 * with `{{params.id}}` in it — is left alone.
 */
export function render(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = values[key]

    return value === undefined ? '' : String(value)
  })
}

/** The page. */
export function panelPage(service) {
  return render(TEMPLATE, {
    name: service.name,
    url: service.url,
    styles: STYLES,
    state: stateFragment(service),
    requests: requestsFragment(service),
  })
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
 * Put the panel on a mock.
 *
 * The forms post to the control surface — the same one the command line
 * uses — so the page and the CLI do the same thing.
 */
export function attachPanel(service) {
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

  return service
}
