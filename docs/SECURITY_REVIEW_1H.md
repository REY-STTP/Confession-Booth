# Confession Booth — Security Review 1H (ringan, pra-staging)

Tanggal: 2026-09-15. Cakupan: repo + scan lokal. Review eksternal penuh dijadwalkan
sebelum mainnet (lihat checklist §5).

## 1. Hasil scan lokal (hijau)

| Scan | Hasil |
|---|---|
| `npm audit --omit=dev` | 0 vulnerabilities (Next 16.3.5, post RCE GHSA-p293/GHSA-2xp9) |
| Slither kontrak (`ConfessionRegistry.sol`) | 0 finding / 102 detektor (T1-020) |
| `npm run lint` | hijau (`--max-warnings 0`) |
| Secret-in-repo | tidak ada `PUBLISHER_KEY/DEPLOYER_KEY/SESSION_SECRET` ter-commit (hanya `.env.example` + placeholder `0x000...`); `apps/api/.env` di-ignore |
| Privacy scan otomatis | `privacy.test.ts` 4/4 + `assertPublicSafe` di semua respons publik |
| Lighthouse lokal (prod build, desktop) | `/feed` perf 96 + a11y 100, `/` perf 100 + a11y 100 (target ≥85/100 ✅, 2026-09-15; staging ulang pasca-deploy) |
| CSP web | `script-src 'self' 'unsafe-inline'` (wajib Next.js; XSS dilapis React-escape + tolak markup + Zod) |

## 2. Permukaan yang diperiksa

Auth SIWE (nonce hash, sekali pakai, 5 mnt, allowlist chain), sesi (hash token,
cap 20, cleanup), RBAC + `ADMIN_SECRET` bootstrap teraudit, rate-limit per-subject
hash (termasuk verify/refresh/logout/admin), PoW eskalasi (HMAC, expiry 10 mnt),
Zod ketat (cursor/publicId/signature), cursor 400-bukan-500, ILIKE escape,
idempotency hash ≤128, CSRF origin-check, trustProxy, error JSON tanpa stack.

## 3. Risiko sisa (diterima untuk staging, wajib sebelum mainnet)

- ZAP baseline + review eksternal belum jalan (butuh URL staging).
- Admin MFA masih secret-kuat (TOTP/IdP di hosting prod).
- Relayer privasi (Fase 2) belum ada — korelasi wallet→tx didokumentasikan jujur.
- Redis/IPFS/CAPTCHA provider belum dipilih (fallback lokal aktif).

## 4. Jejak keputusan

Kontrak immutable permissionless (tanpa OZ/admin), VISIBLE-langsung +
PENDING_CHAIN async, midnight = tag ATAU 00–04 WIB, FTS `simple`+trgm,
PoW ganti CAPTCHA sampai ada kunci provider.

## 5. Checklist review eksternal (mainnet gate)

[ ] ZAP baseline staging tanpa High [ ] Audit kontrak independen [ ] Review
retensi vs PRIVACY_POLICY [ ] Drill restore + RPC failover disaksikan [ ] Hapus
semua TODO keamanan terbuka di TASKS.
