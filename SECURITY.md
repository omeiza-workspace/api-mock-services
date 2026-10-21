# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.x | yes |
| < 1.0 | no |

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately through GitHub's
[private vulnerability reporting](https://github.com/omeiza-workspace/api-mock-services/security/advisories/new),
or by email to the maintainer. Include:

- what the problem is, and what an attacker could do with it
- the version of the package, and of node it runs on
- the steps to reproduce it

You will get an acknowledgement within a few days, and a fix or an
explanation of why the report is not a vulnerability.

## What the mocks do with your data

The mocks are local programs. They listen on `127.0.0.1` by default, keep
what they are asked in memory, and send nothing anywhere.

Two things are worth knowing:

- **A mock is not authenticated.** It answers to anyone who can reach it, the
  way the real service answers to anyone with a key. Do not expose one to
  a network you do not control.
- **The panel is a control surface.** `/_control` decides what the next
  call does, and `/_panel` is the page that drives it. Both are open on the
  same address as the mock. Binding to `127.0.0.1` is what keeps them
  private.

On a laptop a mock listens on `127.0.0.1` and nowhere else. The container
image sets `HOST=0.0.0.0`, because a published port has to be reachable from
outside the container — so a mock run in a container is open to whoever can
reach that port. Publish it on `127.0.0.1` (`-p 127.0.0.1:4001:4001`) and
it is not.

## The webhook

A mock can be told to send a webhook to a URL. It will send to whatever URL
it is given, including one on the local network. That is the point of it, so
it is worth knowing before pointing a mock at an address you care about.
