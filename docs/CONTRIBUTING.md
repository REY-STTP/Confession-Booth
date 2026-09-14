# Confession Booth — Contribution Guide

## Setup

```bash
npm install
npx husky init   # pasang git hooks sekali saja (lint-staged saat commit)
```

> `prepare` sengaja TIDAK ada di `package.json`: hook husky hanya untuk
> mesin kontributor. Lifecycle `prepare` jalan di semua environment (termasuk
> Vercel/Docker tanpa devDeps) dan memecahkan build deploy (T1G).

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
