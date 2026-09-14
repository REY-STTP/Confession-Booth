# Confession Booth — Deploy VPS Ubuntu (T1G, pengganti Render)

CVM 2C4G cukup untuk staging penuh: Caddy + web + api(+4 worker) + Postgres.
Prasyarat: **domain sendiri** (wajib HTTPS — cookie refresh `Secure` tidak
diset browser lewat HTTP; tanpa HTTPS sesi mati tiap 1 jam). Subdomain
disarankan: `booth.example.com` (web) + `api-booth.example.com` (API).

## 1. Siapkan server (sekali saja)

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

## 2. DNS

A record `booth` dan `api-booth` → IP publik CVM. Tunggu propagasi
(`nslookup booth.example.com` menjawab IP CVM).

## 3. Clone + env

```bash
git clone https://github.com/REY-STTP/Confession-Booth.git booth && cd booth
cp .env.example .env
```

Isi `.env` (contoh; ganti domain + secret):

```env
POSTGRES_USER=booth
POSTGRES_PASSWORD=<acak-kuat>
POSTGRES_DB=booth
DATABASE_URL=postgres://booth:<acak-kuat>@postgres:5432/booth
SESSION_SECRET=<openssl rand -hex 32>
ADMIN_SECRET=<acak-kuat>
CORS_ORIGIN=https://booth.example.com
APP_DOMAIN=api-booth.example.com
WEB_DOMAIN=booth.example.com
API_DOMAIN=api-booth.example.com
NEXT_PUBLIC_APP_URL=https://booth.example.com
NEXT_PUBLIC_API_URL=https://api-booth.example.com
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
NODE_ENV=production
```

Generate secret: `openssl rand -hex 32`.

## 4. Naik + migrasi + smoke

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose exec api node scripts/db/migrate.mjs up
docker compose exec api node scripts/db/seed.mjs
curl https://api-booth.example.com/api/health
curl 'https://api-booth.example.com/api/feed?sort=new&limit=5'
curl https://api-booth.example.com/api/slo
```

Buka `https://booth.example.com/feed` → harus tampil (banner offline = API/CORS salah).

## 5. Rutin

```bash
docker compose logs -f api web        # log
docker compose exec api node scripts/db/backup.mjs backup   # backup manual
crontab -e                            # + 0 2 * * * cd ~/booth && docker compose run --rm backup
git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build  # update
```

Rollback app: `git checkout <commit-lama> && ... up -d --build`
(kontrak immutable — histori on-chain tidak bisa di-rollback).
