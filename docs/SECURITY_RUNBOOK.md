# Confession Booth — Security Runbook (10 langkah, SECURITY §14)

## 1. Deteksi

Sinyal: alert `/api/metrics` (`indexerLagOver5m`, `txFailOver5pct`), antrean OPEN
meledak, laporan kritis, `npm audit`/Slither/ZAP temuan baru.

## 2. Triase (15 mnt)

Tentukan: kebocoran identitas? konten kritis (threat/doxxing)? chain lag? abuse?
Prioritas: kritis → quarantine dulu via `/moderation/actions HIDE`.

## 3. Batasi dampak

- Konten kritis: `HIDE/REMOVE` (cache invalidate <5s) + `BAN/RESTRICT` author bila perlu.
- Kredensial bocor: rotasi `SESSION_SECRET/RPC/PUBLISHER/DEPLOYER/STORAGE/ADMIN_SECRET`
  via secret manager; revoke sesi (`sessions.revoked_at`).
- RPC down: failover `RPC_URL` → provider cadangan; publisher backoff 5 mnt otomatis.

## 4. Kumpulkan bukti (tanpa sebar plaintext)

Simpan `request_id`, `publication_id`, `tx_hash`, `policy_version`, audit
`moderation_actions`. JANGAN paste isi confession/signature ke chat/log.

## 5. Perbaiki

Patch + `lint/typecheck/test/build` hijau + migrasi reviewed. Kontrak immutable:
rollback hanya app-layer (revert deploy API/web, BUKAN rewrite chain).

## 6. Verifikasi

Ulangi: privacy scan, `GET /proof` hash cocok, `/metrics` alert clear,
`db:backup` sukses, E2E inti hijau.

## 7. Komunikasi jujur

Status page + notice app. Tanpa klaim absolut. Sebut: apa bocor, siapa terdampak,
apa yang immutable on-chain.

## 8. Retensi bukti

Audit `reports/moderation_actions` permanen; log request 30 hari; nonce/sesi
mengikuti `PRIVACY_POLICY.md §5`.

## 9. Postmortem (48 jam)

5 Why + aksi T1H/T2 bila perlu (relayer, CAPTCHA/PoW, FTS, IPFS).

## 10. Kontak & akses

Admin via `ADMIN_SECRET` + role grant teraudit (`/api/admin/grant-role`).
Kunci deploy di secret manager/HW wallet; JANGAN di repo/chat.
