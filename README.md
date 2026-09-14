# Confession Booth (UNSAID)

> **Say what you can't say.** Nobody needs to know who you are.

Anonymous confession feed. Blockchain untuk verifiability, bukan penyimpanan plaintext.

## Struktur

```text
apps/web        Next.js 16.3.x + Tailwind (feed, composer, mod dashboard)
apps/api        Fastify + Zod (auth, confessions, reactions, whispers, reports, moderation)
packages/shared Tipe + validasi + copy (sumber tunggal aturan 500/300 char, kategori, reaksi)
contracts       Solidity registry minimal (hash/reference, tanpa plaintext)
```

## Mulai

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run dev      # web :3000 + api :4000
npm test
npm run build
```

## Prinsip

- Tanpa alamat wallet di UI publik — hanya `Anonymous #NNNN`.
- Tanpa plaintext confession di on-chain — hanya `contentHash + CID + timestamp + version`.
- Moderasi di application layer, beraudit, berversi.
- Klaim privasi jujur — lihat `docs/PRIVACY.md`.
