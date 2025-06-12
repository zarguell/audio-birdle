# Security Policy

## Supported Versions

The current active version is considered **alpha**. While development is ongoing, we will do our best to prioritize and respond to security concerns.

## Reporting a Vulnerability

If you discover a security vulnerability in **Audio Birdle**:

- **Do not open a public GitHub issue**.
- Instead, report a [private security advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability).

Please provide as much detail as possible:

- Steps to reproduce
- Impact assessment
- Suggested fix (if applicable)

You’ll receive a response as soon as possible. We appreciate responsible disclosure.

## Scope

This project is currently a **static web app**. Potential concerns might include:

- Insecure handling of browser-local state
- Exploitable client-side scripts
- Malicious code injection or third-party asset vulnerabilities

Note that being able to find / exploit the answer of the day is not considered a vulnerability. The project works to obfuscate the answer from the client, but being that the code is all client side, the client must be able to determine the answer itself.

---

Thank you for helping keep Audio Birdle safe and secure!
