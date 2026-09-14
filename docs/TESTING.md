# Confession Booth — Testing Strategy

## 1. Unit Tests

Test:

- content validation;
- category validation;
- anonymous ID generation;
- ranking formula;
- nonce validation;
- signature verification;
- hash generation;
- moderation state transitions.

## 2. API Tests

Test:

- authentication;
- unauthorized access;
- invalid payloads;
- rate limits;
- duplicate reactions;
- duplicate idempotency keys;
- pagination;
- moderation authorization.

## 3. Integration Tests

Test:

`API → PostgreSQL → Storage → Blockchain testnet/indexer`

## 4. Smart Contract Tests

Test:

- successful publication;
- duplicate ID;
- invalid inputs;
- unauthorized admin operation;
- event emission;
- upgrade behavior if applicable.

## 5. Security Tests

- XSS payloads;
- SQL injection attempts;
- replayed signatures;
- expired signatures;
- nonce reuse;
- CORS;
- CSRF;
- oversized requests;
- rate-limit bypass;
- authorization bypass.

## 6. E2E Tests

Critical journey:

```text
Open booth
 → Browse
 → Connect wallet
 → Sign
 → Compose
 → Publish
 → Confirm
 → React
 → Whisper
 → Report
```

## 7. Privacy Tests

Verify that public API responses never contain:

- wallet address;
- internal user ID;
- IP;
- session ID;
- moderator notes.

Also verify server logs do not contain confession plaintext.

## 8. Performance

Load test:

- feed pagination;
- trending;
- confession publication;
- reaction bursts;
- moderation queue.

## 9. Release Gate

Production release requires:

- tests passing;
- migrations reviewed;
- contract verified;
- security checklist complete;
- backups verified;
- environment variables checked;
- monitoring active;
- rollback plan documented.
