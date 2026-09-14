# Confession Booth — Deploy VPS Ubuntu (T1G) + Vercel

Arsitektur: **web di Vercel** (CDN global), **API staging di VPS** CVM 2C4G
(Caddy + api(+4 worker) + Postgres). Domain: `confession-booth.web.id`.
Prasyarat: HTTPS wajib di kedua sisi (cookie refresh `Secure` ditolak browser
lewat HTTP; tanpa HTTPS sesi mati tiap 1 jam).

## 1. DNS (DNSPod/panel domainmu)

| Host | Tipe | Nilai |
|---|---|---|
| `@` | A | `76.76.21.21` (Vercel apex) |
| `www` | CNAME | `cname.vercel-dns.com` (opsional) |
| `api` | A | IP publik CVM |

## 2. Web → Vercel [dashboard]

Import repo `REY-STTP/Confession-Booth` → Root Directory `apps/web` → env:

```
NEXT_PUBLIC_APP_URL=https://confession-booth.web.id
NEXT_PUBLIC_API_URL=https://api.confession-booth.web.id
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
```

Deploy → menu Domains → tambah `confession-booth.web.id` (+ `www` bila mau).

## 3. Siapkan VPS (sekali saja)

```bash
# Docker + plugin compose (Ubuntu 22.04/24.04)
sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin git ufw

# Firewall: hanya SSH + HTTP/S publik
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw --force enable && sudo ufw status
```

## 4. Clone + env (API-only)

```bash
git clone https://github.com/REY-STTP/Confession-Booth.git booth && cd booth
cp .env.example .env
```

Isi `.env` (ganti yang bertanda `<>`):

```env
POSTGRES_USER=booth
POSTGRES_PASSWORD=<<acak-kuat>>
POSTGRES_DB=booth
DATABASE_URL=postgres://booth:<<acak-kuat>>@postgres:5432/booth
SESSION_SECRET=<<openssl rand -hex 32>>
ADMIN_SECRET=<<acak-kuat>>
CORS_ORIGIN=https://confession-booth.web.id
APP_DOMAIN=api.confession-booth.web.id
API_DOMAIN=api.confession-booth.web.id
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
NODE_ENV=production
```

Generate secret: `openssl rand -hex 32`. (`CORS_ORIGIN` boleh koma-lipat ganda
bila perlu preview Vercel, mis. `https://confession-booth.web.id,https://xxx.vercel.app`.)

## 5. Naik + migrasi + smoke

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api postgres caddy
docker compose exec api node scripts/db/migrate.mjs up
docker compose exec api node scripts/db/seed.mjs
curl https://api.confession-booth.web.id/api/health
curl 'https://api.confession-booth.web.id/api/feed?sort=new&limit=5'
curl https://api.confession-booth.web.id/api/slo
```

Buka `https://confession-booth.web.id/feed` → harus tampil (banner offline =
URL API/CORS salah — cek `NEXT_PUBLIC_API_URL` di Vercel + redeploy web).

## 6. Rutin

```bash
docker compose logs -f api               # log (tanpa isi confession/signature)
docker compose exec api node scripts/db/backup.mjs backup   # backup manual
crontab -e                               # + 0 2 * * * cd ~/booth && docker compose run --rm backup
git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api postgres caddy  # update
```

Rollback app: `git checkout <commit-lama> && ... up -d --build ...`
(kontrak immutable — histori on-chain tidak bisa di-rollback).
