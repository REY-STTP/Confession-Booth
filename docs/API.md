# Confession Booth — API Specification

**Base:** `/api`

## 1. Conventions

- JSON request/response.
- UTC timestamps in ISO 8601.
- Cursor pagination.
- Authentication required only where marked.
- Never expose wallet identity through public endpoints.

## 2. Authentication

### GET `/auth/nonce`

Creates a short-lived authentication challenge.

Query (T1-023): `address` wajib `0x` 40-hex, `chainId` opsional integer positif dan harus sama dengan chain server (allowlist).

Response:

```json
{
  "nonce": "...",
  "message": "Sign in to Confession Booth...",
  "expiresAt": "2026-09-14T12:00:00Z"
}
```

### POST `/auth/verify`

Request:

```json
{
  "address": "0x...",
  "signature": "0x...",
  "nonce": "..."
}
```

Batas: `signature` max 1000 char. Rate-limit `verify` 20/10 mnt per IP (T1-023).

Server verifies:

- signature;
- domain;
- chain/application (harus sama dengan server, `INVALID_CHAIN` bila beda);
- nonce;
- expiration;
- nonce unused.

Response (T1-028: sinkron dengan implementasi):

```json
{
  "authenticated": true,
  "accessToken": "...",
  "expiresAt": "2026-09-14T13:00:00Z"
}
```

Set-Cookie: `booth_refresh` (`Path=/api/auth, HttpOnly, Secure prod, SameSite=Lax`).

### POST `/auth/refresh`

Cookie `booth_refresh` → rotasi pasangan baru. Rate-limit 20/10 mnt. CSRF origin-check. Akun `BANNED/RESTRICTED` 403 (T1-023).

### POST `/auth/logout`

Revoke Bearer + cookie. Rate-limit 30/10 mnt. CSRF origin-check. `clearCookie` memakai opsi sama dengan `setCookie` (T1-023).

## 3. Feed

### GET `/feed`

Query:

- `sort=new|trending|relatable`
- `category`
- `limit`
- `cursor`
- `q` — FTS (`simple` tsvector + GIN) dengan ILIKE+trigram sebagai recall fallback; diurutkan `ts_rank` dulu (T1H-004)
- `slot=any|midnight` — midnight = tag `midnight` ATAU jam 00–04 WIB server-side (T1H-003)

Response:

```json
{
  "items": [],
  "nextCursor": "..."
}
```

## 4. Get confession

### GET `/confessions/:publicId`

Returns public projection only.

## 5. Create confession

### POST `/confessions`

Authentication required.

Request:

```json
{
  "category": "heartbreak",
  "content": "..."
}
```

Validation:

- 1–500 Unicode characters;
- plaintext only;
- no executable markup;
- rate limit;
- abuse checks.

Response:

```json
{
  "id": "c_...",
  "status": "visible",
  "publicId": "c_...",
  "author": { "displayName": "Anonymous #4821" }
}
```

Catatan T1-028: `publicId` = ID opaque `c_...`/`w_...`, BUKAN display name.
`author.displayName` = `Anonymous #NNNN` dari `displaySeed` acak per-confession.
Feed langsung `VISIBLE`; publikasi chain async `publications.status=PENDING_CHAIN` (bukan gate tampil).

Dedup: `409 CONTENT_DUPLICATE` bila `sha256(normalizeForDedup)` sama per-user 10 mnt.

Anti-spam v2 (T1H-005): akun bermasalah (skor ≥50 dari velocity + report 24 jam)
menjawab `429 POW_REQUIRED` + `challenge {token, difficulty, expiresAt}`.
Selesaikan `sha256(salt:nonce)` bit-nol di depan, retry dengan header
`x-pow-solution: <token>:<nonce>`. Composer web menjawab otomatis sekali.

## 6. React

Auth wajib (anti-manipulasi ranking; visitor diminta Enter the Booth). Unique per user+type.

### POST `/confessions/:publicId/reactions`

```json
{
  "type": "UNDERSTAND"
}
```

### DELETE `/confessions/:publicId/reactions/:type`

Removes the authenticated user's reaction.

## 7. Whispers

### GET `/confessions/:publicId/whispers`

Returns public whispers.

### POST `/confessions/:publicId/whispers`

```json
{
  "content": "..."
}
```

Maximum: 300 Unicode characters. Auth wajib. Idempotency di-scope per confession.

## 8. Reports

### POST `/reports`

Reporter boleh anonim. `details` max 500 (validator `validateReportDetails`), tanpa markup.
Throttle: rate 10/jam + dup per-target 10 mnt → 429. Kritis (`THREAT/DOXXING/SEXUAL_EXPLOITATION`) → target `QUARANTINED` + skor `LEAST(100,+25)` (T1-027).

```json
{
  "targetType": "CONFESSION",
  "targetId": "c_...",
  "reason": "HARASSMENT",
  "details": "..."
}
```

## 8b. Proof & Moderation (superset implementasi, T1-028)

- `GET /confessions/:publicId/proof` → `{contentHash, txHash, blockNumber, status, contractAddress, chainId}`.
- `GET /moderation/queue?status=OPEN|REVIEWING|RESOLVED|DISMISSED&limit` (MODERATOR/ADMIN).
- `POST /moderation/actions {targetType,targetId,action:DISMISS|HIDE|REMOVE|RESTRICT|BAN|RESTORE,reason_code,notes?,policy_version}` — `RESTORE` tidak bump `publishedAt` (T1-027).
- `POST /api/admin/grant-role {wallet, role}` — header `x-admin-secret` (ADMIN_SECRET), 503 bila disabled (T1-042).
- `GET /api/metrics` — request/error per route, tx fail-rate, p50/p95 read, alert, openReports (tanpa secret, T1-041).
- `GET /api/slo` — SLO 99.5% + p95<500ms, window lifetime proses (T1H-006).

## 9. Health

### GET `/health`

Returns application health.

### GET `/health/chain`

Returns blockchain provider/indexer health without exposing secrets.

## 10. Error Format

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests."
  }
}
```

Never include stack traces in production.

## 11. Rate Limits

Suggested initial limits:

| Action | Limit |
|---|---|
| Auth nonce | 10 / 10 min |
| Auth verify | 20 / 10 min (T1-023) |
| Auth refresh | 20 / 10 min (T1-023) |
| Auth logout | 30 / 10 min (T1-023) |
| Confession | 3 / hour |
| Whisper | 10 / hour |
| Reaction | 60 / hour |
| Report | 10 / hour + dup per-target 10 min (T1-027) |

These are starting values and should be tuned from abuse data.

## 12. Idempotency

Publication-related POST requests should support an idempotency key.

Example header:

`Idempotency-Key: <random-client-generated-value>`

The server must ensure a retry does not create duplicate content.
