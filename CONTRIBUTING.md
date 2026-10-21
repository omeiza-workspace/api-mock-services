# Contributing

Thanks for taking the time. This is a small project and the bar for a change
is simple: it must work on a machine that has nothing but node, and it must
not assume anything about the project it is used in.

## Getting set up

```sh
git clone https://github.com/omeiza-workspace/api-mock-services.git
cd api-mock-services
npm test
```

There is nothing to install. The package has no dependencies, and neither
does its test suite — it runs on node's own test runner.

## Before you open a pull request

```sh
npm run check
```

That is the lint and the tests. The same thing runs in CI, on Ubuntu and
macOS, on node 20 and 22.

## The layout

```
src/
  harness.js     the engine — routes, state, the control surface
  index.js       the public API
  spec.js        a mock written as a route file
  providers/     the mocks, one file per group of them
  ui/            everything a person sees: HTML, CSS, the panel
```

The engine knows nothing about HTML. The browser layer is put on a mock by
`attachViews`, and it is the only thing that renders anything.

## House rules

**No new dependencies.** Node is the whole toolchain. A mock that needs a
library is a mock that will not run in the next project's CI.

**The real shape.** The paths, the fields and the status codes are the
provider's, so the code under test does not change when it is pointed at a
mock. If you are unsure of a field, check the provider's own documentation
rather than inventing one.

**The state is kept.** What the service was asked, and what it decided, is on
`service.state` and `service.requests`. A test should be able to say what
really happened, not only that nothing threw.

**The reference decides.** A reference with `success` in it comes back
successful, one with `failed` in it comes back failed — so a test can ask
for either without a special flag.

**The engine stays free of the browser.** HTML, CSS and the panel live in
`src/ui/`. If a provider needs a checkout, it says so on itself:

```js
service.checkout = {
  title: 'Acme (mock)',
  find: (reference) => ({ reference, amount: '10.00', merchant: 'The shop' }),
  onDone: (reference, outcome) => recordIt(reference, outcome),
}
```

## Adding a mock

1. Put it in the file that fits it: `providers/fintech.js` for the payment
   gateways, `providers/identity.js` for the checks, and so on. A new file is
   fine too.
2. Give it a `MockService`, the routes the provider really has, and the state
   it really keeps.
3. Register it in `src/index.js`, with a port, a category and a description.
4. Add a test to `test/mocks.test.js`. Every mock is started and asked
   something, so a broken one is caught here rather than in a project that
   depends on it.

## Adding a page

The panel and the checkout are server-rendered HTML with a little HTMX on
top. The markup is in `src/ui/templates/`, the styles in `src/ui/assets/`,
and the browser code is in the template itself. There is no build step: what
you write is what is served.

The buttons are real forms, so the page works even when the script does not
load. Keep it that way.

## Releasing

1. Update `CHANGELOG.md`.
2. Bump the version in `package.json`.
3. Tag: `git tag -a v1.1.0 -m "v1.1.0"` and push the tag.

The release workflow publishes to npm.
