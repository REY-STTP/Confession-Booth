# Confession Booth — Staging Gate (1G)

Target: staging hidup end-to-end sebelum Fase 2. Bagian `[kamu]` butuh akun/kunci
milikmu — saya tidak bisa membuatnya. Bagian `[repo]` sudah siap di commit ini.

## 1. Remote repo [kamu, 5 mnt]

```powershell
cd D:\Secret\My-Project\10-Confession-Booth
gh repo create confession-booth --private --source=. --push
# tanpa gh CLI: buat repo private di github.com, lalu:
# git remote add origin git@github.com:<user>/confession-booth.git
# git push -u origin main
```

Verifikasi: Actions `ci` hijau (lint+typecheck+test+e2e+audit+build).

## 2. Database staging [kamu, 10 mnt]

Neon (atau Supabase) → project baru → salin `DATABASE_URL` (pooler, `?sslmode=require`).

```bash
DATABASE_URL='<neon-url>' npm run db:setup --workspace @booth/api
```

## 3. API staging [kamu, 15 mnt]

> Pivot T1G: Render butuh kartu → staging pindah ke VPS Ubuntu (CVM 2C4G).
> Jalur Render tetap valid via `render.yaml` bila nanti ada kartu.
> Ikuti **`docs/VPS.md`** (Caddy TLS otomatis + compose prod + UFW).

Railway/Render/Fly dari Dockerfile `apps/api` (atau `docker compose` di VPS).
Env wajib (lihat `.env.example`):

```
DATABASE_URL=<neon-url>
SESSION_SECRET=<acak-32+-via-secret-manager>
CORS_ORIGIN=https://<web-staging>
APP_DOMAIN=<api-domain>
NEXT_PUBLIC_CHAIN_ID=11155111
ADMIN_SECRET=<kuat, server-only>
```

Opsional 1.5: `RPC_URL/RPC_WS_URL/PUBLISHER_KEY` (Sepolia),
`STORAGE_ENDPOINT/+KEY/SECRET` (Kubo), `REDIS_URL`, `POW_DIFFICULTY=14`.
Worker (`publisher/indexer/ranking/abuse`) sebagai service terpisah dengan
command `npm run worker:<nama> --workspace @booth/api`.

Smoke:

```bash
curl https://<api>/api/health
curl https://<api>/api/health/chain
curl 'https://<api>/api/feed?sort=new&limit=5'
curl https://<api>/api/slo
```

## 4. Web staging (Vercel) [kamu, 10 mnt]

Import repo → Root Directory `apps/web` → env:

```
NEXT_PUBLIC_APP_URL=https://<web-staging>
NEXT_PUBLIC_API_URL=https://<api>
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_CONTRACT_ADDRESS=<dari §5, sementara 0x000...>
```

Smoke: `/`, `/feed`, `/compose` (tolak publish tanpa sesi = benar), `/privacy`.

## 5. Kontrak Sepolia [kamu, butuh wallet funded, 15 mnt]

```bash
cd contracts
export RPC_URL='https://sepolia.infura.io/v3/<key>'  # JANGAN commit
export DEPLOYER_KEY='<0x...>'                         # JANGAN commit
npx hardhat run scripts/deploy.ts --network sepolia
npx hardhat verify --network sepolia <address>
```

Lalu set `NEXT_PUBLIC_CONTRACT_ADDRESS=<address>` di API+web staging,
redeploy, cek `GET /confessions/<id>/proof` → `txHash` + explorer.
Catat alamat di `contracts/deployed/sepolia.json` (commit, tanpa kunci).

## 6. Scan staging [kamu, 20 mnt]

```bash
# ZAP baseline (butuh Docker)
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t https://<web-staging> -r zap-staging.html
# Target: tanpa High. Simpan laporan di luar repo.

# Lighthouse (butuh Chrome)
npx lighthouse https://<web-staging>/feed --preset=desktop \
  --only-categories=performance,accessibility --output=json
# Target: perf ≥85, a11y 100 alur inti.
```

## 7. Rollback staging

App: redeploy commit sebelumnya di dashboard (kontrak immutable — histori
on-chain tidak bisa di-rollback). DB: `db:rollback` hanya forward-fix di prod;
staging boleh `db:rollback` + `db:setup` ulang. Lihat `docs/OPERATIONS.md §5`.

## Status

- [x] Repo git + commit awal + CI (lint/typecheck/test/e2e/audit/build)
- [x] Dockerfile non-root + healthcheck + compose env penuh
- [x] Runbook ini + OPERATIONS + SECURITY_REVIEW_1H
- [ ] Remote + push [kamu]
- [ ] DB + API + web staging [kamu]
- [ ] Sepolia deploy + verify [kamu, funded key]
- [ ] ZAP + Lighthouse [kamu]
