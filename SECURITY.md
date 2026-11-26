# Security Policy

## Supported Versions

The current active version is **alpha**. We prioritise and respond to security
reports as quickly as possible.

## Reporting a Vulnerability

If you discover a security vulnerability in **Audio Birdle**:

- **Do not open a public GitHub issue.**
- Report a [private security advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability).

Please include reproduction steps, impact, and a suggested fix if available.

## Scope

Audio Birdle is a static site deployed as Cloudflare Workers static assets. The
relevant attack surface includes:

- Browser-local state handling (`localStorage`).
- Client-side data and audio URLs.
- Third-party recordings and data attribution.
- Content Security Policy and cache behaviour in `public/_headers`.
- Supply-chain integrity of pinned Node tooling and vendored components.

Remote URLs are restricted to `https:` before they reach `<audio>`, `<img>`, or
`<a>` elements. HTML is rendered by Jinja from templates; client-side UI uses
`textContent`, not `innerHTML`. Inline scripts and styles are not allowed.

Being able to determine today's answer from the client is not considered a
vulnerability: the game is entirely client-side by design.

## Security architecture

The scope above describes the static-only deployment. When dynamic components
ship (Workers with `main`, Discord Activity, D1), `docs/security-architecture.md`
is the threat model of record and its ground rules are release-blocking.
