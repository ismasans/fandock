# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| latest  | ✅ |
| dev     | ⚠️ testing only |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report them privately by opening a [GitHub Security Advisory](https://github.com/ismasans/fandock/security/advisories/new).

Include:
- A description of the vulnerability
- Steps to reproduce it
- Potential impact
- Your suggested fix (optional)

You will receive a response within 7 days. We will coordinate a fix and disclosure timeline with you.

## Security considerations

FanDock requires privileged Docker access to control fan hardware via sysfs. Keep this in mind:

- Change the default password immediately on first login
- Set a strong `FANDOCK_SECRET` environment variable
- Do not expose FanDock directly to the internet — use it on your local network only
- Use HTTPS if you need remote access (via a reverse proxy)