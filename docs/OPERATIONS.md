# Confession Booth — Operasi 1H (indexer, RPC, storage, backup, rollback)

## 1. Indexer lag (alert: `indexerLagOver5m` di `/api/metrics`)

1. Cek `/api/metrics` → `indexerLagSec`, `/api/health/chain` → `contractConfigured`.
2. Cek worker log `[indexer]` + `indexer_state.last_block` vs block terbaru explorer.
3. Penyebab umum: `RPC_URL` mati/rate-limit, restart kehilangan cursor (cursor persisten di DB — aman).
4. Aksi: failover `RPC_URL` (lihat §2), restart `worker:indexer`, reconciler mengejar otomatis (mismatch dicatat, tidak menimpa).
5. Validasi: `matched` naik, alert clear.

## 2. RPC failover

- Primer + cadangan di secret manager; rotasi tanpa deploy ulang bila via env restart.
- Publisher backoff otomatis: `FAILED` dicoba ulang tiap 5 mnt (`attempts` tercatat).
- Publisher konfirmasi: default 3 konfirmasi (reorg safety) pada testnet/mainnet; 1 konfirmasi pada local hardhat node (`chainId: 31337`) agar tidak timeout pada automine.
- Tanpa `RPC_URL/PUBLISHER_KEY` worker skip aman (tetap `PENDING_CHAIN`, tidak crash).
- Ganti `PUBLISHER_KEY`: pastikan saldo gas + update secret + restart worker.

## 3. Storage outage (IPFS)

- `storageFromEnv()`: `STORAGE_ENDPOINT` kosong → `db:inline`; adapter fallback primer→inline bila IPFS down (publish tetap jalan, `storage_cid` null).
- `cat` gagal: konten inline tetap dibaca dari `body_text`; proof/hash tidak terpengaruh.
- Setelah pulih: `npm run db:backfill-storage` (idempoten, verifikasi hash per baris, skip mismatch).
- Verifikasi: `content_objects.storage_cid` terisi + `verifyStoredContent` via test.

## 4. Backup & restore drill

- Harian: `docker compose --profile backup run backup` → `./backups/booth-YYYY-MM-DD.dump`.
- Manual: `npm run db:backup --workspace @booth/api`.
- Verifikasi (tanpa sentuh prod): `npm run db:backup:verify` (butuh `pg_dump` di PATH/`PGBIN`) — cek size + 16 tabel via `pg_restore --list`.
- Restore drill: `npm run db:restore --workspace @booth/api -- backups/<file>.dump` ke DB staging KOSONG (JANGAN prod).
- Bukti lokal 2026-09-15: `size=86592B tables=16` OK.

## 5. Rollback & Migrasi

- Migrasi: `npm run db:migrate --workspace @booth/api` (menerapkan urutan `0001_init` s/d `0005_indexer_mismatches`; script otomatis membaca `.env` di root).
- Rollback: `npm run db:rollback --workspace @booth/api` (SATU migrasi terakhir; dev/staging saja; prod → forward-fix).
- App: redeploy image/commit sebelumnya (kontrak immutable — histori on-chain tidak bisa di-rollback).
- Checklist pasca-rollback: `/api/health`, `/api/metrics` alert clear, smoke feed+publish.

## 6. Worker & cache

- `worker:publisher|indexer|ranking|abuse` loop + tick sekali untuk test; interval via `*_INTERVAL_MS`.
- Ranking tiap 60s → `feed_scores`; abuse tiap 5 mnt → rescore + quarantine ≥3 kritis.
- Cache feed 60s (memori; Redis bila `REDIS_URL` di-set); invalidate otomatis tiap aksi moderasi.
- SLO: `GET /api/slo` (99.5% + p95<500ms, window lifetime proses; Prometheus di prod).
