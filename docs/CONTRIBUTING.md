# Confession Booth — Contribution Guide

## Principles

- privacy first;
- minimal complexity;
- no unnecessary data collection;
- security over convenience;
- no public wallet identity;
- no plaintext private content on-chain.

## Pull Requests

Every PR should state:

- what changed;
- why;
- affected components;
- database migration requirements;
- security/privacy impact;
- tests added.

## Commit Style

Suggested:

```text
feat: add confession composer
fix: prevent reaction duplication
security: harden signature nonce validation
docs: update privacy model
```

## Review Checklist

- Does this expose identity?
- Does this put unnecessary data on-chain?
- Does this create an abuse vector?
- Is input validated?
- Is authorization enforced server-side?
- Are tests included?
- Does the change affect the threat model?
