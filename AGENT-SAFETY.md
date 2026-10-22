# Agent safety

The mocks answer over HTTP, so anything can call them — a test, a script,
a crawler, or an agent. This page says what is safe, what is not, and what
the mocks do to protect themselves.

It is written for the case that matters most: **an agent that has been
pointed at these mocks.**

## What a mock is

A local program that answers like a provider's API. It holds no credentials,
it makes no request to the provider, and it is not a proxy to anything.

Every mock says so, in two ways:

- every answer carries `x-mock-service: <name>` and
  `x-mock-service-kind: mock`;
- `GET /_mock` returns what it is:

```json
{
  "kind": "mock",
  "service": "stripe",
  "real_service": false,
  "notice": "This is a local mock. It is not the real service, it holds no credentials for it, and it makes no request to it."
}
```

An agent can be told to check that route first, and be told to refuse to
carry on if the answer does not say `kind: "mock"`. That is the whole
mechanism. It costs nothing and it removes the ambiguity.

## The rules

**A mock is for development and testing.** Not for production, not for
anything a customer sees. A test that passes against a mock has proved that
your code handles that shape — not that the provider will accept it.

**A mock is not a way around a provider's rules.** A mock returns synthetic
content. It cannot produce what the real service would refuse to produce,
and using one to publish content as if it came from the provider is not a
shortcut, it is a lie in your pipeline. The AI mocks in particular return
canned replies: use them to test your parsers, your streaming handling and
your error paths — not to generate anything for people.

**Do not send real personal data to a mock.** A mock keeps what it was
asked in memory, and some of them print it: the Termii mock prints the
messages it is given to the console, because that is how you check an OTP
without a phone. Treat a mock's console as a log that may be read by
somebody else. Seed it with test data.

**Do not expose a mock to a network you do not control.** A mock answers to
anyone who can reach it, and accepts any key, token or signature, because it
has nothing to check them against. The panel and the control surface are on
the same address. On a laptop the mock listens on `127.0.0.1` and nowhere
else; in a container it listens on every interface, so publish it on
`127.0.0.1` and not on `0.0.0.0`.

**Do not point a mock at a provider's real account.** It has no way to use
a real key, and the habit of pasting a live credential into a test is worth
breaking on its own.

## For an agent that calls these mocks

The safe pattern is short:

1. Ask `GET /_mock` first. If the answer is not `kind: "mock"`, stop.
2. Check `x-mock-service-kind` on every answer. It should say `mock`.
3. Treat every field as synthetic. Do not act on a mock's content as if it
   were real: a mock's "user" is a fixture, its "post" was written by a test,
   and its "verified" means the shape was right, not that a person was.
4. Keep the base URL configurable, and keep it on `127.0.0.1`. The command
   line prints the variable for each mock:

   ```bash
   eval $(api-mock-services env)
   ```

5. Do not let a mock's answer become a decision that affects somebody else —
   a message sent, a payment made, an account closed. A mock is where those
   decisions are tested, not made.

## Why the project is built this way

The terms every provider publishes now say two things that this project
takes literally:

- an AI agent's use of a service is the customer's responsibility, and the
  customer carries the liability for what that agent does;
- the use restrictions apply to the agent as much as to the person.

Which is the argument for a mock that is **obviously** a mock, that is
**obviously** local, that asks for no credentials, and that cannot reach the
provider at all. Those properties are not decoration:

- **No request leaves the machine.** The engine makes no request to a
  provider — checked by `test/no-bridging.test.js`, which fails the build if
  a provider's host appears anywhere in the code, or if any `fetch()` is
  given a fixed address.
- **No credentials.** There is nothing to leak, because there is nothing to
  hold.
- **The routes are checked against the provider's own specification.** A
  route the provider does not serve is a route that has drifted, and it
  fails the build — see `npm run specs`.
- **Every mock says what it is**, on every answer.

## What is not claimed

- A mock does not model a provider's business rules. A payment that a mock
  says succeeded may be one the provider would refuse.
- A mock is not a sandbox. It is a shape, not a business.
- The project's own tests prove the mocks behave as documented. They do not
  prove a provider will accept a request — only the provider can say that.
