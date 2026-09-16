# Confession Booth — System Architecture

**Version:** 1.0

## 1. Architecture Goals

The system separates:

1. presentation;
2. authentication;
3. application indexing;
4. content storage;
5. blockchain verification;
6. moderation;
7. privacy controls.

The central architectural rule is:

> **Never make the blockchain the database for private application content.**

## 2. Recommended Stack

### Frontend (dikunci T1-028)

- Next.js 16.3.x
- TypeScript
- Tailwind CSS
- Native EVM wallet (`window.ethereum` + `personal_sign`); wagmi/React Query ditunda agar build ringan — T1-031 native implementasi
- viem dipakai API untuk verifikasi signature server-side

### Backend (dikunci T1-028)

- Node.js
- TypeScript
- Fastify
- Zod for validation

### Database (dikunci T1-028)

- PostgreSQL
- Drizzle

### Storage

Preferred:

- content-addressed storage such as IPFS-compatible storage (Kubo HTTP API).
- Abstraction `StorageAdapter {put, get}` untuk migrasi tanpa ubah API; `IpfsHttpAdapter` (T1H-001) + `FallbackStorageAdapter` primer→inline.

Sensitive payloads should be encrypted before decentralized storage where required.

### Blockchain (dikunci T1-028)

- EVM-compatible chain;
- viem server-side (verify + publisher/indexer);
- Registry immutable permissionless TANPA OpenZeppelin/admin (tidak ada fungsi
  kelola histori; multisig/upgrade hanya bila kontrak admin dibutuhkan di masa depan).

### Infrastructure

- Docker;
- reverse proxy;
- managed PostgreSQL or PostgreSQL on VPS;
- Redis cache (opsional, untuk feed_scores 60s + invalidasi moderasi — T1H-002);
- monitoring and centralized error reporting with privacy-aware configuration.

## 3. High-Level Architecture

```text
                    ┌──────────────────────┐
                    │      Next.js UI      │
                    │  Feed / Composer     │
                    └──────────┬───────────┘
                               │
                  Wallet Sign / HTTPS API
                               │
             ┌─────────────────┴─────────────────┐
             │                                   │
     ┌───────▼────────┐                  ┌───────▼────────┐
     │ Auth/API Server │                  │ EVM RPC        │
     │ Validation      │                  │ Provider       │
     │ Rate Limit      │                  └───────┬────────┘
     └───────┬────────┘                          │
             │                                   │
       ┌─────▼────────┐                    ┌─────▼─────────┐
       │ PostgreSQL   │                    │ Smart Contract│
       │ Index/State  │                    │ Proof/Refs    │
       └──────────────┘                    └────────────────┘
             │
       ┌─────▼────────────┐
       │ Content Storage  │
       │ IPFS-compatible  │
       └──────────────────┘
```

## 4. Trust Boundaries

### Browser boundary

Untrusted client. Never trust:

- wallet address claims;
- category;
- content length;
- reaction counts;
- role claims.

### API boundary

Validates authentication, authorization, rate limits, and content.

### Database boundary

Trusted application persistence, but assume compromise is possible.

### Storage boundary

Content must be integrity-verifiable.

### Blockchain boundary

Public and immutable. Never write data that should later be private.

## 5. Authentication Flow

```text
User
 ↓
Request nonce
 ↓
Server creates challenge
 ↓
Wallet signs challenge
 ↓
Server verifies signature
 ↓
Session issued
 ↓
API requests authenticated
```

Challenge should contain:

- domain;
- wallet address;
- random nonce;
- issued-at;
- expiration;
- statement;
- chain/application identifier.

Never accept a reusable static message.

## 6. Session Design

For a conventional MVP:

- short-lived access token;
- refresh token in secure, HttpOnly cookie if required;
- server-side session record;
- nonce invalidation after successful authentication.

Do not put secrets in localStorage.

If the project intentionally uses a different auth architecture, document the trade-off explicitly.

## 7. Publication Flow

```text
Composer
   │
   ▼
Client validation
   │
   ▼
POST /confessions
   │
   ▼
Server validation
   │
   ├── rate limit
   ├── abuse checks
   └── moderation pre-check
   │
   ▼
Create content payload
   │
   ▼
Store content / obtain CID
   │
   ▼
Calculate content hash
   │
   ▼
Create publication record
   │
   ▼
Submit blockchain transaction
   │
   ▼
Index tx hash + block
   │
   ▼
Feed becomes visible
```

Keputusan produk (T1-010/T1-028): confession tampil `VISIBLE` langsung agar UX
real-time; publikasi chain berjalan async (`publications.status=PENDING_CHAIN`,
proof menyusul via worker). Alternatif `PENDING`-sampai-confirmed ditolak untuk MVP.

## 8. On-Chain vs Off-Chain

### On-chain

- confession ID / publication ID;
- content hash;
- content reference/CID;
- protocol version;
- publication timestamp or block-derived timestamp;
- optional content status commitment.

### Off-chain

- actual content;
- moderation records;
- reports;
- rate-limit state;
- search indexes;
- analytics;
- operational logs.

### Never on-chain

- wallet-to-real-person mapping;
- IP;
- email;
- private messages;
- moderation notes;
- plaintext sensitive content.

## 9. Event Indexing

Contract events should be indexed by a backend worker.

Example:

```solidity
event ConfessionPublished(
    bytes32 indexed confessionId,
    bytes32 indexed contentHash,
    string contentCID,
    uint64 timestamp,
    uint16 version
);
```

The backend should reconcile:

`database record ↔ transaction ↔ event ↔ content hash`.

## 10. Feed Architecture

Use cursor pagination.

Example:

`GET /api/feed?sort=new&limit=20&cursor=...`

Never rely on client-provided offsets for large feeds.

Ranking can be computed asynchronously and cached.

## 11. Privacy Architecture

The product should maintain three separate concepts:

### Authentication identity

The wallet/session used to authorize an action.

### Public content identity

`Anonymous #4821`.

### Content object

The confession itself.

These should not be conflated.

## 12. Threat Model

### Threat: wallet correlation

Mitigation:

- never display address publicly;
- avoid address-based public URLs;
- consider relayer/anonymous credential architecture in future.

### Threat: IP logging

Mitigation:

- minimize access logs;
- configure retention;
- avoid unnecessary analytics;
- consider privacy-preserving infrastructure.

### Threat: blockchain correlation

Mitigation:

- do not directly assume wallet anonymity;
- future relayer or privacy-preserving transaction architecture.

### Threat: replayed signature

Mitigation:

- nonce;
- expiration;
- domain binding;
- one-time challenge consumption.

### Threat: XSS

Mitigation:

- plaintext-only content;
- escape output;
- CSP;
- sanitize any future rich content.

### Threat: spam/Sybil

Mitigation:

- rate limits;
- abuse scoring;
- CAPTCHA/PoW escalation;
- future anonymous credentials.

### Threat: malicious storage

Mitigation:

- content hash verification;
- CID verification;
- database integrity checks.

## 13. Failure Handling

If storage succeeds but blockchain publication fails:

`PENDING_CHAIN`

If blockchain succeeds but indexing fails:

worker must reconcile from chain events.

If content is moderated after publication:

application hides it while preserving the historical proof record.

## 14. Background Workers

Recommended workers:

- blockchain event indexer;
- publication confirmation worker;
- feed ranking worker;
- moderation queue worker;
- abuse scoring worker;
- storage integrity checker.

## 15. Deployment

```text
Internet
   │
CDN / Reverse Proxy
   │
Next.js
   │
API
   ├── PostgreSQL
   ├── Storage
   └── Queue/Workers
             │
             └── RPC → Blockchain
```

Use separate environments:

- local;
- staging/testnet;
- production/mainnet.

Never share production private keys with development.

## 16. Observability

Log operational events, not confession contents.

Good:

`publication_id=abc tx_status=confirmed`

Bad:

`user confessed: "..."`

Recommended:

- request latency;
- error rate;
- transaction failure;
- worker lag;
- storage errors;
- moderation queue depth.

## 17. Architecture Decision Summary

| Decision        | Choice                    |
| --------------- | ------------------------- |
| Public identity | Anonymous pseudonym       |
| Auth            | Wallet signature          |
| Content         | Off-chain                 |
| Proof           | On-chain hash/reference   |
| Database        | PostgreSQL                |
| Storage         | IPFS-compatible           |
| Feed            | Cursor pagination         |
| Ranking         | Server-side + cache       |
| Moderation      | Off-chain                 |
| Secrets         | Server secret manager/env |
| Rich text       | No in MVP                 |
| ZK              | Future                    |
