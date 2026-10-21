# Mocks contributed as files

A mock does not have to be code. A service that is only read from — or one
whose flow is small enough to describe — can be written as a route file and
dropped in here.

This is the folder to put a contributed mock in. It is deliberately outside
`src/`: nothing here is loaded by the package, and nothing here has to be
reviewed as JavaScript.

## Adding one

1. Write the route file. It is JSON, and it looks like this:

```json
{
  "name": "acme",
  "state": { "greeting": "hello" },
  "routes": [
    { "method": "GET", "path": "/v1/things", "body": { "things": [] } },
    { "method": "GET", "path": "/v1/things/:id", "body": { "id": "{{params.id}}" } }
  ]
}
```

2. Start it:

```bash
api-mock-services file contrib/acme.json
```

3. Point the application at it. The command line prints the URL and the
   environment variable.

The placeholders are filled in from the request: `{{params.id}}` from the
path, `{{query.q}}` from the query string, `{{body.email}}` from the body,
`{{header.authorization}}` from a header, and `{{state.anything}}` from what
the mock keeps.

A route file can also be a JavaScript module that exports the same object.
The `.json` one is easier to read; the module one can compute.

## The rules

- **The real shape.** The paths, the fields and the status codes are the
  provider's. If the provider changes its API, the file changes with it.
- **No state, or state that is written down.** A route file cannot hold a
  payment in progress — that is what a mock written as code is for.
- **No new dependency.** A route file is JSON and a few placeholders.
- **A test.** A contributed mock is tested like any other: start it, ask it
  something, and check the answer.

## What is here

| File | What it stands in for |
|---|---|
| `mpesa.json` | Safaricom M-Pesa — the Daraja API |
