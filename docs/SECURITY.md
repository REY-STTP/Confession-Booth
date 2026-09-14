# Confession Booth — Security & Privacy Model

## 1. Security Objective

Protect:

- user sessions;
- private operational identifiers;
- content integrity;
- moderator/admin privileges;
- smart contract funds/state;
- infrastructure secrets.

## 2. Privacy Objective

Minimize the ability to correlate:

`real-world person → wallet → session → confession`

The MVP cannot guarantee that this correlation is impossible.

## 3. Authentication Security

Requirements:

- EIP-4361/SIWE-style domain-bound message where compatible;
- one-time nonce;
- short expiration;
- replay protection;
- HTTPS;
- secure cookies if cookies are used;
- server-side signature verification.

Never authenticate from a wallet address supplied without signature verification.

## 4. Input Security

Treat all user content as hostile.

- plaintext storage/rendering by default;
- HTML escaped;
- URLs restricted;
- file uploads disabled in MVP;
- length limits;
- Unicode normalization;
- control-character handling.

## 5. API Security

- schema validation;
- authentication middleware;
- authorization checks;
- rate limiting;
- request size limits;
- CORS allowlist;
- CSRF protection where applicable;
- secure headers;
- audit admin endpoints.

## 6. Database Security

- parameterized queries/ORM;
- least-privilege DB account;
- encrypted backups;
- no production DB credentials in frontend;
- migration review.

## 7. Secrets

Never commit:

- private keys;
- database passwords;
- RPC API keys;
- JWT secrets;
- encryption keys.

Use environment variables or a secret manager.

## 8. Admin Security

Admin accounts should require stronger authentication.

Recommended:

- separate admin identity;
- MFA;
- least privilege;
- audit log;
- multisig for critical blockchain administration.

## 9. Smart Contract Security

Before mainnet:

- unit tests;
- fuzzing;
- static analysis;
- independent review/audit;
- testnet deployment;
- emergency response procedure.

## 10. Content Privacy

Never log:

```text
POST /confessions body={"content":"..."}
```

Instead log:

```text
publication_id
request_id
operation
status
latency
```

## 11. Metadata Retention

Define retention periods before production.

Examples:

- application logs: short retention;
- authentication events: limited operational retention;
- moderation records: longer retention if needed;
- abuse-control identifiers: minimum necessary retention.

The privacy policy must match actual implementation.

## 12. Threat Matrix

| Threat | Impact | Primary mitigation |
|---|---|---|
| XSS | High | plaintext + CSP |
| Wallet replay | High | nonce + expiry |
| Spam | Medium | rate limits |
| Sybil | High | future anonymous credentials |
| DB leak | High | minimize identity/content linkage |
| RPC metadata correlation | High | privacy-aware provider strategy |
| Admin compromise | Critical | MFA + least privilege |
| Contract bug | Critical | audit + minimal scope |
| Malicious storage | Medium | hash verification |
| Doxxing | High | moderation + reporting |

## 13. Responsible Privacy Language

Avoid:

> "Nobody can ever find out who you are."

Prefer:

> "Confession Booth is designed to let you express yourself without a public profile. Blockchain and network metadata can still create privacy risks."

## 14. Security Incident Response

1. Detect.
2. Contain.
3. Preserve relevant operational evidence.
4. Disable compromised credentials.
5. Assess affected data.
6. Patch.
7. Rotate secrets.
8. Communicate appropriately.
9. Document root cause.
10. Add regression tests.
