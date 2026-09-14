# Confession Booth — Privacy Policy v1.0

**Status:** MVP. **policy_version:** `v1.0` (dipakai `moderation_actions.policy_version`).
Setiap klaim di bawah bisa dilacak ke implementasi. Tanpa kalimat absolut
("tidak ada yang bisa tahu siapa kamu" DILARANG — pakai notice jujur di app).

## 1. Apa yang publik

- `author.displayName` (`Anonymous #NNNN` dari `displaySeed` acak per-confession).
- `category`, `content`, `createdAt`, counts reaksi, `whisperCount`.
- `contentHash`, `txHash`, `blockNumber`, `contractAddress`, `chainId` via `/proof`.
- Ref: `apps/api/src/content.ts:projectConfession`, `docs/SCHEMA.md §17`.

## 2. Apa yang TIDAK publik (diuji `assertPublicSafe` + privacy scan)

Wallet, `author_user_id`, IP mentah, session/token, `moderator_notes`, email.
Test: `packages/shared/src/index.ts:assertPublicSafe`, `apps/api/src/content.test.ts` privacy scan.

## 3. Tiga identitas terpisah

Auth (wallet/session) vs publik (`Anonymous #`) vs objek konten (`contentHash`).
`displaySeed` acak per-confession mencegah korelasi antar-posting user sama.

## 4. Batasan jujur (wajib tampil di UI)

Blockchain + metadata jaringan (tx history, RPC, IP, browser, perilaku) tetap bisa
berkorelasi. Akun wallet-auth saja ≠ anonim. Jangan tulis nama/alamat/telepon.
Copy wajib: `Blockchain and network metadata can still create privacy risks.`
Ref: `packages/shared/src/index.ts:COPY.privacyNotice`, `docs/PRIVACY.md`.

## 5. Retensi (cocok implementasi)

| Data | Simpan | Retensi |
|---|---|---|
| `auth_nonces` | hash saja, bukan mentah | hapus saat expired (`cleanupAuthExpired`, T1-023) |
| `sessions` | hash token | hapus 7 hari setelah expired; cap 20/user aktif |
| `rate_limit_buckets` | `subject_hash` sha256, bukan IP mentah | per-window, window lama dihapus saat tick |
| `idempotency_keys` | key+user+respons | 24 jam (`IDEMPOTENCY_TTL_MS`) |
| `reports`/`moderation_actions` | reporter nullable, notes privat | permanen untuk audit; TIDAK pernah on-chain |
| Log server | `{request_id, method, url, status, latency}` + `x-request-id` | tanpa isi confession/signature (logger tanpa body) |
| On-chain | `confessionId + contentHash + CID + timestamp + version` | immutable; moderasi hanya app-layer (HIDDEN/REMOVED tetap ada histori) |

## 6. Hak pengguna

Minta hapus tampilan app (HIDE/REMOVE via report), revoke sesi (`/auth/logout`),
lapor doxxing (auto-`QUARANTINED`). Hapus on-chain tidak mungkin (immutable).

## 7. Perubahan policy

Versi baru → `policy_version` baru di `GUIDELINES.md` + audit `moderation_actions`.
