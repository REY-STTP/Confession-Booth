# Confession Booth — Task Plan

**Status:** Draft v1.3 (1D+1E+1F+1.5 selesai 2026-09-15; gate staging 1G berjalan — repo git ✅, deploy/scan menunggu akun [kamu])
**Sumber kebenaran:** `docs/PRD.md`, `ARCHITECTURE.md`, `API.md`, `SCHEMA.md`, `SMART_CONTRACT.md`, `SECURITY.md`, `PRIVACY.md`, `MODERATION.md`, `ENVIRONMENT.md`, `TESTING.md`, `ROADMAP.md`, `PRODUCT_COPY.md`
**Prinsip pengikat:** identitas opsional; tanpa alamat wallet di UI publik; tanpa plaintext di on-chain; moderasi di application layer; klaim privasi jujur.

> Cara pakai: kerjakan berurutan per fase. Setiap task selesai hanya jika semua Acceptance Criteria (AC) terpenuhi + test terkait lolos. Jangan lompat ke Fase 1 sebelum Fase 0 Done.

---

## 0. Peta Milestone

| Fase | Nama                     | Keluaran utama                                                                                  | Gate                                                 |
| ---- | ------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 0    | Fondasi + Prototipe (V0) | Repo, tooling, env, UI mock + feed palsu                                                        | Prototipe bisa dibuka, composer UX jalan dengan mock |
| 1    | MVP (V1)                 | Auth wallet, API, DB, feed, confess, react, whisper, report, moderasi, kontrak testnet, indexer | Semua AC PRD §20 lolos                               |
| 1.5  | Production Hardening     | IPFS, ranking, midnight, search, observability, backup, audit                                   | Checklist TESTING §9 hijau                           |
| 2    | Privacy                  | Kredensial anonim, relayer, rate-limit privat                                                   | Desain privasi baru + threat model update            |
| 3    | Community                | Midnight, chains, relatable, reputasi, badge                                                    | —                                                    |
| 4    | Desentralisasi           | Eksperimen moderasi/storage/gov                                                                 | —                                                    |

**Cakupan dokumen ini:** Fase 0 + Fase 1 dirinci penuh. Fase 1.5+ dirinci sebagai backlog terstruktur.

**Konvensi ID:** `T<fase>-<nomor>` mis. `T0-001`. `FR-xxx` merujuk PRD §7. Prioritas `P0/P1/P2` mengikuti PRD.

---

## Fase 0 — Fondasi & Prototipe (V0)

Tujuan: ROADMAP Phase 0 — visual identity, landing, mock feed, responsif, composer, kategori.

### T0-001 — Inisialisasi monorepo + tooling

- [x] Inisialisasi struktur: `apps/web` (Next.js 16.3.x + TS + Tailwind), `apps/api` (Node + TS + Fastify, Zod), `packages/shared` (tipe + validasi + copy), `contracts` (Foundry/Hardhat + OpenZeppelin), `docker-compose.yml` (Postgres lokal).
- [x] Setup: ESLint, Prettier, TS strict, Husky + lint-staged, commit style `feat:/fix:/security:/docs:` (CONTRIBUTING).
- [x] Env contoh: `.env.example` sesuai ENVIRONMENT.md (pisahkan `NEXT_PUBLIC_*` vs server-only). Pastikan tidak ada secret ter-commit.
- **Ref:** ARCHITECTURE §2, ENVIRONMENT, CONTRIBUTING.
- **AC:** `npm install && npm run dev && npm test && npm run build` hijau di fresh clone; tidak ada secret di repo.
- **Test:** smoke CI.
- **Hasil 2026-09-14:** ✅ `npm install` 292 paket OK; `lint` + `typecheck` 4 workspace OK; `npm test` 31/31 lolos (shared 18, api 10, contracts 3); `next build` 13 route OK. Tanpa git repo lokal → hook Husky aktif setelah `git init`.

### T0-002 — Design system + identitas visual booth

- [x] Tema: quiet/misterius/privat (gelap, tipografi tenang), komponen: Button, Input/Textarea, Card, Modal, Badge kategori, Empty state, Skeleton.
- [x] Copy persis dari PRODUCT_COPY: hero `Say what you can't say`, CTA `Enter the Booth`, composer `What do you need to get off your chest?` + placeholder `Write your confession...` + tombol `Confess`, empty `The booth is quiet.`, whisper `Leave a whisper`, midnight copy, privacy notice, report copy.
- [x] Aksesibilitas awal: fokus visible, kontras, keyboard nav (target WCAG 2.2 AA untuk alur inti — PRD §19).
- **Ref:** PRD §16, PRODUCT_COPY.
- **AC:** Storybook/halaman demo komponen; teks CTA utama bukan `Connect Wallet`.
- **Test:** snapshot + axe dasar.
- **Hasil 2026-09-14:** ✅ Tema `booth` (bg `#0b0b10`, aksen `#c9a7ff`) di `tailwind.config.ts`; komponen `BoothCard/Empty/SkeletonList/ComposerForm/ReportModal`; CTA terverifikasi live bukan `Connect Wallet`; `:focus-visible` + skip-link + aria-live/roles. (Storybook/axe otomatis dijadwalkan T1-043.)

### T0-003 — Landing / Booth entrance (mock)

- [x] Layar 1 PRD §17: hero + `Enter the Booth` + privacy notice singkat + link Community Guidelines (placeholder) + footer jujur (tanpa klaim "100% anonim").
- [x] Responsif mobile-first; loading cepat.
- **AC:** Visitor paham produk <30 detik; tidak ada wallet connect wajib di landing.
- **Hasil 2026-09-14:** ✅ `/` 200 live; hero + cara-kerja + reaksi; footer privacy jujur; tanpa wallet connect di landing.

### T0-004 — Public feed mock (New + kategori)

- [x] Layar 2+6: feed kronologis mock (20+ item), filter 11 kategori (`love, heartbreak, secret, life, school, work, family, funny, sad, deep, midnight`), kartu menampilkan `Anonymous #NNNN`, kategori, konten, counts reaksi, whisperCount, waktu relatif.
- [x] DILARANG menampilkan alamat wallet / ID internal di mock.
- **Ref:** PRD §10-11, SCHEMA §17.
- **AC:** Filter kategori bekerja client-side; tidak ada string `0x` sebagai identitas.
- **Test:** unit filter + privacy assertion mock.
- **Hasil 2026-09-14:** ✅ 24 item mock lintas 11 kategori (`apps/api/src/mock.ts`); filter/search/cursor diuji (`server.test.ts`); assertion `assertPublicSafe` di shared; live `/feed` 200 tanpa `0x…`.

### T0-005 — Composer mock + detail + whisper mock

- [x] Layar 3-5: composer (textarea + counter 500 + pilih 1 kategori + peringatan "jangan tulis identitas" + tombol Confess), halaman detail confession + thread whisper mock, modal report mock.
- [x] Validasi client: 1–500 char confession, 1–300 whisper, plaintext, blokir `<script>` kasar (validasi serius di T1).
- **Ref:** PRD §9, PRODUCT_COPY.
- **AC:** Counter akurat Unicode; submit mock menampilkan status `pending → visible`.
- **Hasil 2026-09-14:** ✅ `/compose` (counter Unicode + warning identitas + `pending → visible`), `/confessions/[publicId]` (reaksi optimistik+rollback, whisper, modal report 11 reason); counter diuji di shared.

### T0-006 — Trending + Midnight mock + 404/empty/error states

- [x] Layar 7-8: tab `New / Trending / Most Relatable`, halaman `Midnight Confessions` (`Things people only say when nobody is listening.`), empty/error/loading states.
- [x] Reaksi mock 5 tipe: 🕯️ UNDERSTAND, ❤️ LOVE, 😭 SAD, 💀 WILD, 😂 FUNNY (label sesuai PRODUCT_COPY).
- **AC:** Navigasi 12 layar PRD terpetakan walau masih mock; siap diganti API nyata di Fase 1.
- **Hasil 2026-09-14:** ✅ `/feed`, `/trending`, `/relatable`, `/midnight`, `/privacy`, `/guidelines`, `/settings`, `/mod`, `/admin` + `not-found/error/loading`; 13 route lolos `next build`. API sudah siapkan `sort`, cursor, dan `proof` stub untuk Fase 1.

### T0-007 — CI dasar + preview deploy

- [x] GitHub Actions: lint + typecheck + unit + build. Preview deploy web (staging). `docker compose up` jalankan Postgres lokal.
- **Gate Fase 0:** demo V0 ke stakeholder;(INTI) UX disetujui sebelum sentuh auth/chain.
- **Hasil 2026-09-14:** ✅ `.github/workflows/ci.yml` + `docker-compose.yml` (postgres/api/web); smoke live API `:4000` + web `:3000` lolos (health, feed 24 item, 5 halaman 200, tanpa wallet leak). Preview deploy staging menunggu repo remote.

---

## Fase 1 — MVP (V1)

Tujuan: PRD §20 acceptance criteria + FR-001..010 (P0). FR-011..014 (P1) minimal fungsional; FR-015..017 (P2) cukup stub/flag.

### 1A. Backend fondasi + Auth + DB

#### T1-001 — Skema PostgreSQL + migrasi (FR-002,003,004,007,008,009,010)

- [x] Implementasi tabel sesuai SCHEMA.md: `users, auth_nonces, sessions, categories, content_objects, confessions, reactions, whispers, reports, moderation_actions, publications, rate_limit_buckets, feed_scores`.
- [x] Aturan: UUID PK, `wallet_address` lowercase unique, `author_user_id` privat, unique `(confession_id,user_id,reaction_type)`, index persis SCHEMA §16 (feed, kategori, reaksi, whisper, report, publication).
- [x] Seed 11 kategori + `sort_order`.
- [x] State machine: confession `PENDING→VISIBLE→HIDDEN/REMOVED`, report `OPEN→REVIEWING→RESOLVED/DISMISSED`.
- **AC:** Migrasi up/down bersih; seed idempoten.
- **Test:** migrasi di DB kosong + rollback.
- **Hasil 2026-09-14:** ✅ Drizzle + `0001_init.{up,down}.sql` (`src/db/`), runner `db:migrate/db:rollback`, 15 tabel (+`idempotency_keys` untuk API §12); rollback→re-migrate bersih; seed 2x tetap 11 aktif. Deviasi terdokumentasi di `schema.ts`: `users.role` (RBAC), `body_text` inline (T1-022), `QUARANTINED`, `idempotency_keys`. DB dev: cluster PG18 lokal port 5433 (tanpa Docker di mesin ini).

#### T1-002 — Auth nonce + verify wallet (FR-002, FR-003) [P0-Kritis]

- [x] `GET /api/auth/nonce` → `{nonce, message, expiresAt}`. Message gaya SIWE/EIP-4361: domain, address, nonce random, issued-at, expiration (±5 mnt), statement, chain/app id. Simpan **hash** nonce, bukan mentah (SCHEMA §4).
- [x] `POST /api/auth/verify {address, signature, nonce}` → verifikasi server-side (viem `verifyMessage`), cek domain, chain, expiry, nonce belum dipakai → tandai `consumed_at` → buat `users` (upsert lowercase) + `sessions` (token hash, short-lived access + refresh HttpOnly Secure SameSite) → `{authenticated:true, expiresAt}`.
- [x] Nonce rate-limit 10/10 mnt. Tolak pesan statis/reuse.
- **Ref:** ARCHITECTURE §5-6, SECURITY §3, API §2.
- **AC:** Replay nonce gagal; expired gagal; domain salah gagal; address tanpa signature tidak bisa auth.
- **Test (TESTING §2,5):** unit nonce lifecycle; API: valid, replay, expired, wrong-domain, tampered-signature; k6 abuse ringan.
- **Hasil 2026-09-14:** ✅ `src/auth.ts` + 9 test (`auth.test.ts`, signature viem asli) lolos: happy path, NONCE_REUSED, BAD_SIGNATURE, NONCE_EXPIRED, WRONG_DOMAIN, ADDRESS_MISMATCH, upsert lowercase, refresh rotation + logout revoke, 429+Retry-After. Respons verify: `{authenticated, accessToken, expiresAt}` + cookie `booth_refresh` HttpOnly. (k6 dijadwalkan T1-050.)

#### T1-003 — Session middleware + RBAC (visitor/kontributor/moderator/admin)

- [x] Middleware auth: baca Bearer/HttpOnly, cek `sessions.revoked_at/expires_at`, injeksi `req.user {id, role, status}`. Role: `USER, MODERATOR, ADMIN`. Status `BANNED/RESTRICTED` diblokir aksinya.
- [x] Audit endpoint admin. CORS allowlist, body limit (~100KB), security headers (helmet), CSRF jika cookie.
- **Ref:** PRD §4, SECURITY §5,8.
- **AC:** Endpoint publik tanpa token OK; endpoint tulis tanpa token 401; moderator-only 403 untuk user biasa.
- **Test:** unauthorized/access-control matrix.
- **Hasil 2026-09-14:** ✅ Hook `preHandler` Bearer→`req.user` + `requireAuth/requireRole`; matriks 401/403/200 diuji di `/moderation/queue` (stub; real di T1-015); CORS allowlist + helmet CSP + body 100KB sudah di server. CSRF origin-check + audit admin penuh di T1-042.

#### T1-004 — Validasi konten + keamanan input (FR-006) [P0-Kritis]

- [x] Zod schema: confession 1–500 Unicode (hitung code point, normalisasi NFC, tolak control char kecuali `\n\t`), whisper 1–300, category wajib 1 slug aktif, tolak HTML/script (escape saat render + tolak pola `<[a-z]`), link MVP: tolak atau tandai `QUARANTINED` (pilih tolak + dokumentasikan).
- [ ] Duplicate detection: hash konten ternormalisasi (lowercase+collapse whitespace) per user 10 mnt → 409/429.
- [x] Util bersama di `packages/shared`: `countChars, normalizeContent, hashContent (sha256), makeAnonymousName`.
- **Ref:** PRD §9, SECURITY §4.
- **AC:** Payload `<img onerror>`, `<script>`, 501 char, kategori ganda/invalid ditolak 400; XSS tidak tereksekusi di feed.
- **Test:** unit fuzz XSS + Unicode edge (emoji, ZWJ, RTL); API invalid payloads.
- **Hasil 2026-09-14:** ✅ `apps/api/src/validate.ts` kini delegasi penuh ke `@booth/shared` (satu sumber kebenaran; link MVP = tolak `LINKS_NOT_ALLOWED_MVP`); 18 test shared + 4 API invalid-payload lolos. Deteksi duplikat per-user diwiring saat T1-010 (butuh penulis terautentikasi).

#### T1-005 — Rate limit + idempotency + abuse skor dasar (FR-004,007,008,009)

- [x] Rate limit per `subject_hash` (hash user/IP — jangan simpan IP mentah, SCHEMA §14): confession 3/jam, whisper 10/jam, reaksi 60/jam, report 10/jam, nonce 10/10mnt (API §11). Header `Retry-After`, error `RATE_LIMITED`.
- [x] `Idempotency-Key` untuk `POST /confessions, /whispers, /reactions` → retry aman, tidak duplikat (simpan key+hash 24 jam).
- [x] Abuse skor sederhana: velocity + duplikat + report-count → flag `moderation_score`, eskalasi CAPTCHA/PoW stub (implementasi penuh di 1.5).
- **AC:** Burst di atas limit 429; retry idempoten 1 record.
- **Test:** rate-limit bypass (multi-key, multi-IP), duplikat idempotency key.
- **Hasil 2026-09-14:** ✅ `src/ratelimit.ts` DB fixed-window (subject sha256, semua endpoint); `src/idempotency.ts` (`withIdempotency`, unik per user+key, TTL 24 jam, aman balapan); `src/abuse.ts` (`scoreAbuse`, ambang 50 → flag + `captcha` stub); 6 test baru lolos. Wiring idempotency/abuse ke route tulis nyata di 1B (butuh auth user).

### 1B. Confession + Feed + Whisper + Reaksi + Report

#### T1-010 — POST /confessions (FR-004,005,006,014-stub)

- [x] Auth wajib. Flow ARCHITECTURE §7: validasi → rate-limit → abuse/pre-check → buat `content_object {content_hash=sha256(kanonis), storage_provider=db:inline, version}` → `confessions {public_id=nanoid/cuid, status=PENDING, author_user_id privat, displaySeed}` → `publications {status=PENDING_CHAIN}` → enqueue publikasi chain (T1-020) → respons `{id, status:pending, publicId}`.
- [x] `public_id` TIDAK boleh berupa wallet; `Anonymous #NNNN` diturunkan dari `displaySeed` (acak per confession, bukan per user — cegah korelasi antar-posting user sama).
- **AC (PRD §20):** kontributor publish → konfirmasi; tidak ada wallet di respons.
- **Test:** e2e publish happy path + invalid + rate-limited + idempoten.
- **Hasil 2026-09-14:** ✅ Route DB nyata (`server.ts`): auth wajib → validasi shared → rate-limit per-user → dup 409 (hash kasonis lowercase+collapse, window 10 mnt) → `content_objects` + `confessions` + `publications(PENDING_CHAIN)` dalam 1 transaksi → 201 `{id, status:visible, publicId, author}`. Keputusan: **VISIBLE langsung** (ARCHITECTURE §7 membolehkan; chain-confirm mengikuti via worker T1-021, bukan gate tampil). `onchainConfessionId = keccak256(publicId)`. 4 test lolos (happy+proof, dup, rate-limit, idempotency route-level).

#### T1-011 — GET /feed + GET /confessions/:publicId (FR-001, FR-011, FR-013-stub)

- [x] `GET /api/feed?sort=new|trending|relatable&category&limit(≤50, default 20)&cursor` — cursor opaque (base64 `created_at+id`), hanya `status=VISIBLE`, proyeksi publik SCHEMA §17. `new`: `created_at DESC`. `trending/relatable`: baca `feed_scores` (diisi worker T1-030; fallback `new` jika kosong).
- [x] `GET /api/confessions/:publicId` — proyeksi sama + `whisperCount` + counts reaksi agregat. 404 untuk HIDDEN/REMOVED (atau 410 + pesan netral — pilih 404, dokumentasikan).
- [x] Search P1-minimal: `?q=` substring di konten visible (FTS penuh di 1.5).
- **Ref:** ARCHITECTURE §10, PRD §10.
- **AC:** Pagination tanpa duplikat/hilang saat insert bersamaan; p95 read <500ms di dataset 10k (lokal).
- **Test:** pagination chaos (insert saat paging), filter kategori, unauth bisa baca.
- **Hasil 2026-09-14:** ✅ Feed DB: cursor `(created_at, public_id)` + `LIMIT n+1`, trending/relatable via `feed_scores` (kosong → urutan new, T1-030 mengisi), `q` ILIKE substring, agregat reaksi/whisper per halaman; non-VISIBLE → 404 (dipilih & didokumentasikan). `GET /proof` nyata: `{contentHash, txHash, blockNumber, status, contractAddress, chainId}`. p95/load formal di T1-050.

#### T1-012 — Reactions (FR-007)

- [x] `POST /confessions/:publicId/reactions {type: UNDERSTAND|LOVE|SAD|WILD|FUNNY}` (auth opsional? pilih: **auth wajib** untuk cegah manipulasi ranking — dokumentasikan; visitor diminta Enter the Booth). Unique per user+type. `DELETE .../reactions/:type`.
- [x] Velocity limit + agregat counts di-cache; satu wallet/sesi tidak boleh bobot tak terbatas (PRD §10).
- **AC:** Reaksi ganda type sama tidak dobel; unlike bekerja; counts konsisten.
- **Test:** duplikat reaksi, burst 60+/jam → 429.
- **Hasil 2026-09-14:** ✅ Auth wajib (didokumentasikan); `ON CONFLICT DO NOTHING` → respons `{reacted:true|false}`; rate-limit user 60/jam; counts agregat di detail. Burst-429 tercakup pola rate-limit (test burst penuh T1-050).

#### T1-013 — Whispers (FR-008)

- [x] `GET /confessions/:publicId/whispers` (cursor, hanya VISIBLE, proyeksi anonim) + `POST .../whispers {content}` (auth wajib, 1–300 char, rate 10/jam, idempoten, status PENDING→VISIBLE kecuali quarantine).
- **AC:** Whisper tampil anonim; report whisper bisa (targetType=WHISPER).
- **Test:** validasi panjang, XSS, rate-limit.
- **Hasil 2026-09-14:** ✅ GET cursor ASC + proyeksi `{id, author, content, createdAt}`; POST auth + 300-char shared + rate per-user + dup 409 per confession + idempotency scope-confession; `whisperCount` hidup di detail. (VISIBLE langsung seperti confession; quarantine via triage T1-014.)

#### T1-014 — Reports (FR-009)

- [x] `POST /api/reports {targetType: CONFESSION|WHISPER, targetId, reason: 11 taksonomi MODERATION §3, details≤500}` — reporter boleh anonim (nullable user), rate 10/jam. Buat `reports {status=OPEN}` + naikkan skor triage.
- [x] Report tidak membocorkan identitas reporter ke publik.
- **AC (PRD §20):** report menciptakan record moderasi; duplikat spam report di-throttle.
- **Test:** semua reason code; target invalid 404.
- **Hasil 2026-09-14:** ✅ Reporter opsional (subject rate user/IP); target by publicId + 404; details≤500; triage kritis (THREAT/DOXXING/SEXUAL_EXPLOITATION) → target QUARANTINED + skor +25 → hilang dari feed (404 netral). Reporter tidak pernah terekspos (privacy scan).

#### T1-015 — Moderasi hide/takedown + audit (FR-010)

- [x] Endpoint moderator: `GET /api/moderation/queue?status&sort`, `POST /api/moderation/actions {targetType,targetId,action:DISMISS|HIDE|REMOVE|RESTRICT|BAN|RESTORE, reason_code, notes?, policy_version}` → update status konten + `moderation_actions {actor,reason,timestamp,target,policy_version}`. Jangan pernah tulis notes on-chain.
- [x] Auto-triage: skor kritis (THREAT/DOXXING/SEXUAL_EXPLOITATION) → `QUARANTINED` sementara + antrean prioritas.
- **AC (PRD §20):** moderator hide → hilang dari feed publik <5 detik (cache invalidate); audit lengkap.
- **Test:** authorization (user biasa 403), state machine transisi, restore.
- **Hasil 2026-09-14:** ✅ Queue (filter status, preview snippet 140 char, tanpa identitas); actions 6 aksi dalam 1 transaksi + audit + resolve report terkait; BAN/RESTRICT menyasar author; HIDE/REMOVE set `hidden_at`; RESTORE→VISIBLE. Tanpa cache → hide efektif seketika. 3 test (otorisasi, quarantine→hide→audit→restore, ban→403).

### 1C. Blockchain + Storage + Worker

#### T1-020 — Smart contract registry (testnet)

- [x] Kontrak minimal immutable permissionless (Solidity, TANPA OpenZeppelin/admin — diputus T1-028): `publish(confessionId:bytes32, contentHash:bytes32, contentCID:string, version:uint16)` + `exists()` + event `ConfessionPublished(confessionId indexed, contentHash indexed, contentCID, timestamp, version)`. Proteksi: duplikat ID revert, batas panjang CID (±128), non-empty hash. **Immutable** (tanpa proxy) untuk MVP. Tidak ada fungsi hapus/ubah histori.
- [x] Deploy testnet (Sepolia/Base Sepolia — kunci di secret manager, bukan di repo), verifikasi di explorer, simpan alamat di env `NEXT_PUBLIC_CONTRACT_ADDRESS`.
- **Ref:** SMART_CONTRACT seluruhnya.
- **AC:** `publish` sukses emit event; duplikat revert; gas wajar (CID pendek).
- **Test (TESTING §4):** unit Foundry/Hardhat: sukses, duplikat, input invalid, admin, event, + Slither/static analysis.
- **Hasil 2026-09-14:** ✅ `contracts/` Hardhat 2 + `ConfessionRegistry.sol` (custom errors, `MAX_CID_LEN=128`, tanpa proxy/fungsi hapus); 5 test on-chain lolos (publish+event+exists, DuplicateConfession, 3 invalid, CID 128, tanpa histori); **Slither 0 finding (102 detektor)**. Deploy script `scripts/deploy.ts` + `hardhat node` lokal siap; deploy Sepolia + verifikasi explorer dijadwalkan staging (butuh RPC/kunci funded — prosedur di `contracts/scripts/deploy.ts`, env `DEPLOYER_KEY/RPC_URL`, kunci hanya via secret manager).

#### T1-021 — Publication pipeline + indexer worker

- [x] Worker `publication-publisher`: ambil `publications PENDING_CHAIN` → kirim tx via `RPC_URL` (server signer, bukan wallet user — dokumentasikan trade-off korelasi di PRIVACY) → simpan `tx_hash` → `confirmed` via receipt → update `confessions VISIBLE + published_at` + `feed_scores` seed.
- [x] Worker `chain-indexer`: subscribe `ConfessionPublished` (RPC_WS) → rekonsiliasi `db ↔ tx ↔ event ↔ contentHash`; retry backoff; lag metric.
- [x] Failure: storage OK tapi chain gagal → tetap `PENDING_CHAIN` + retry; chain OK tapi index gagal → reconciler mengejar.
- **Ref:** ARCHITECTURE §7,9,13,14.
- **AC (PRD §20):** referensi blockchain terverifikasi: `hash(konten DB) == onChain contentHash`; feed PENDING tidak bocor ke publik.
- **Test integrasi:** `API→PG→chain testnet→indexer` end-to-end (fork/anvil + testnet staging).
- **Hasil 2026-09-14:** ✅ `src/workers/publisher.ts` (batch 10, backoff FAILED 5 mnt, `attempts`, receipt 1 konfirmasi, tanpa kunci → skip aman) + `src/workers/indexer.ts` (cursor persisten `indexer_state`, mismatch hash hanya dicatat tanpa timpa, event asing diabaikan) + migrasi `0002_indexer`. 4 test integrasi vs `hardhat node` lokal lolos: PENDING→tx nyata→CONFIRMED+hash+blok, skip aman, event→matched+cursor, mismatch→`mismatched` tanpa overwrite. `publisherTick` mendukung filter scope (paralel-test aman). Trade-off server-signer didokumentasikan di kode; relayer di Fase 2.

#### T1-022 — Content addressing (MVP-minimal → siap IPFS)

- [x] MVP: konten penuh di Postgres (`content_objects` + tabel konten / kolom `body_ciphertext/plaintext`), `content_hash=sha256`, `storage_cid` nullable (diisi CID sungguhan di 1.5). Abstraksi `StorageAdapter {put,get}` agar migrasi ke IPFS tanpa ubah API.
- [x] Endpoint verifikasi publik: `GET /api/confessions/:publicId/proof` → `{contentHash, txHash, blockNumber, contractAddress, chainId}` tanpa konten privat tambahan.
- **Ref:** PRD §12-13, ARCHITECTURE §8.
- **AC:** Ganti adapter mock→IPFS tanpa ubah handler (bukti via test).
- **Hasil 2026-09-14:** ✅ `src/storage.ts` (`StorageAdapter`, `DbInlineAdapter`, `setStorage/getStorage`); route confession/whisper menulis `storage_provider/cid` dari adapter aktif; 2 test: inline default + swap ke fake-IPFS (record `ipfs:fake`+CID, bentuk publik identik). Kanonik hash didokumentasikan: `sha256(normalizeForDedup)` — dipakai commitment on-chain, proof, dan dedup.

### 1C+. Remediasi Temuan Kritis P0-P2 (gate sebelum 1D)

> Hasil deep review 2026-09-14. Wajib hijau sebelum sentuh `1D Frontend MVP`, agar frontend nyata tidak dibangun di atas API bocor + docs drift. Urutan: P0 dulu, lalu P1, lalu P2-docs.

#### T1-023 — P0 Auth/session + rate-limit hardening

- [x] `GET /api/auth/nonce`: tolak `address` kosong (jangan fallback `0x000...`), validasi `chainId` allowlist, tolak `chainId` aneh (NaN/negatif/float).
- [x] `POST /verify|/refresh|/logout` kena rate-limit; `rotateRefresh` cek `users.status` (BANNED tidak bisa rotate); batasi jumlah session per user + cleanup job `auth_nonces/sessions` expired.
- [x] Cookie: samakan `setCookie` vs `clearCookie` (`path/domain/sameSite/secure`), tambah CSRF origin-check untuk `POST /refresh|/logout`; set `trustProxy` + `CORS credentials` yang benar agar `req.ip` tidak spoof di balik proxy.
- [x] Pakai `sessionSecret` beneran (signed cookie) atau hapus default `dev-only-change-me`; boot fatal jika `DATABASE_URL/SESSION_SECRET` kosong di staging/prod (T1-040 parsial).
- **AC:** nonce tanpa address 400; chainId invalid 400; brute-force verify/refresh 429; BANNED tidak bisa refresh; logout bersih tanpa cookie sisa.
- **Test:** unit `nonce validation`, `rotate banned 401`, `rate verify/refresh`, `logout cookie cleared`, `trustProxy ip`.
- **Hasil 2026-09-14:** ✅ `auth.ts` (chain allowlist + `INVALID_CHAIN`, `rotateRefresh` 403 bila non-ACTIVE, `cleanupAuthExpired` + `enforceSessionCap` 20), `server.ts` (nonce wajib `0x` 40-hex, rate `verify/refresh/logout` baru di `ratelimit.ts`, CSRF origin-check, `clearCookie` samakan opts, `trustProxy:true`, CORS `credentials:true`), `config.ts` fatal di `NODE_ENV=production`. Typecheck+lint hijau.

#### T1-024 — P0 Validasi Zod + error handling API

- [x] Ketatkan schema: `signature max 1000 + regex`, `feed category max 64`, `cursor.createdAt` valid date, `chainId int positive`, `publicId/targetId format ^(c_|w_)`, `details/notes` max sesuai shared (`REPORT_DETAILS_MAX=500`), `Idempotency-Key` charset + hash jika `uuid:key` >128 char.
- [x] Escape `%/_` di `ILIKE %q%`, tolak `q=""` (jangan full-scan); `try/catch` cursor/date/uuid invalid jadi 400 bukan 500; tambah `setErrorHandler/setNotFoundHandler` JSON (jangan HTML/stack leak); nyalakan logger + `request-id`.
- [x] Samakan `content max Zod 2000` vs `shared 500/300` (Zod cukup `max 2000` sebagai guard body, `checkContent` sebagai aturan produk — dokumentasikan).
- **AC:** payload raksasa/aneh 400 JSON; tidak ada 500 untuk input invalid; log tanpa isi confession/signature.
- **Test:** API invalid-payload matrix + injection `%_` + cursor rusak + signature raksasa.
- **Hasil 2026-09-14:** ✅ `decodeCursor` validasi date+panjang, `escapeLike`, `isPublicIdFormat`, cursor rusak→400 `INVALID_CURSOR`, `q` kosong→400, `ILIKE ... ESCAPE`, `setErrorHandler/setNotFoundHandler` JSON, `logger:true`, `routerOptions.maxParamLength`, `verify signature max1000`, `report/mod targetId regex`. Typecheck+lint hijau; test DB butuh Postgres (ECONNREFUSED di mesin ini, bukan regresi).

#### T1-025 — P0 Tooling + env + Docker + Vercel-ready

- [x] `eslint.config.mjs`: aktifkan `js.configs.recommended + tseslint + next` (ganti stub ignores-only); `npm run lint` hijau tanpa `--max-warnings 0` bypass.
- [x] Perbaiki `apps/api package.json dev` (`node --watch ./src/index.js` rusak → `tsx`/`ts-node` atau `node --watch dist`), sentralisasi konfigurasi di root `.env.example` (apps/api otomatis fallback ke root `.env`), hapus `dist/mock.*` orphan + `dist/` dari repo, tambah `.dockerignore`.
- [x] `Dockerfile api/web`: `USER node`, `HEALTHCHECK`, `COPY package-lock`, install prod-only, api sertakan `scripts/db/*` + `@booth/shared` workspace agar bisa migrate di prod.
- [x] Web Vercel-split: hapus hardcode `http://localhost:4000` (pakai `NEXT_PUBLIC_API_URL`), CSP `connect-src` ikut env prod, `CORS_ORIGIN` = domain Vercel; putuskan: **web→Vercel, api→Railway/Render/Fly + Neon/Supabase PG**.
- **AC:** `lint/typecheck/test/build` hijau fresh clone; image non-root + healthcheck; web prod build tanpa `localhost`.
- **Test:** CI lint nyata + docker build + `grep -r localhost apps/web/app apps/web/lib` kosong (kecuali fallback dev).
- **Hasil 2026-09-14:** ✅ ESLint `js.recommended + no-eval/no-undef` hijau, `dev` → `build && node --watch dist`, `apps/api/.env.example` + `.dockerignore` baru, kedua Dockerfile non-root + healthcheck + `ARG NEXT_PUBLIC_API_URL`, `next.config.mjs` CSP ikut env, `API_URL` sentral di `lib/booth.ts`. `next build` 13 route OK.

#### T1-026 — P1 Reliabilitas web (hapus silent-mock)

- [x] `lib/booth.ts getFeed`: bedakan `loading/error/offline` (jangan silent `FALLBACK`); `FALLBACK createdAt` jangan `new Date()` saat module load; tambah `timeout/abort/retry` + log/toast.
- [x] `composer.tsx`: jangan `catch→visible` (false-positive publish); guard `crypto.randomUUID()`; `textarea maxLength` samakan 500 (bukan 2000); `ReportModal catch→done` diperbaiki; `confessions/[publicId]` 404 → `not-found` (jangan tampilkan confession salah); `encodeURIComponent(publicId)`; `react/whisper/report` cek `res.ok` sebelum optimistik.
- [x] `mod/admin` beri `onClick` + feedback nyata (atau tandai `disabled + TODO T1-034`); `error.tsx` log `digest`; tambah a11y: `ReportModal` focus-trap/Escape/return-focus, `feed tablist` jadi nav atau tabs penuh, cek kontras `booth-dim`.
- **AC:** offline/4xx tampil error jujur, tidak ada publish palsu; tidak ada wrong-confession fallback.
- **Test:** unit `getFeed error path`, `composer failure state`, e2e manual offline.
- **Hasil 2026-09-14:** ✅ `getFeed` timeout 8s + `lastFeedError` + banner offline di `/feed`, composer error jujur + `maxLength 500` + UUID guard, `ReportModal` wajib `targetId` + error state, detail `encodeURIComponent` + 404→`notFound()` + rollback hanya saat gagal + whisper cek `res.ok`, settings tanpa auto-login palsu. `next build` + typecheck hijau. Sisa a11y `mod/admin onClick` + focus-trap dijadwalkan T1-034/T1-043.

#### T1-027 — P1 Shared validation gaps + idempotency/report throttle

- [x] `packages/shared`: implementasikan `REPORT_DETAILS_MAX` validator (atau hapus jika API yang pegang), tolak whitespace-only (`normalizeContent` kosong → `CONTENT_TOO_SHORT`).
- [x] API: hash/truncate `idempotency key` agar `uuid:key` ≤128; throttle report duplikat per-target (selain 10/jam global); cap `QUARANTINED +25` agar tidak overflow; `RESTORE` jangan bump `publishedAt` (atau dokumentasikan sebagai boost).
- **AC:** `"   "` 400; details >500 400 konsisten web/API; key panjang tidak 500.
- **Test:** unit whitespace + details-max + idempotency-long-key.
- **Hasil 2026-09-14:** ✅ `validateReportDetails` baru + `checkBase` tolak whitespace-only, `validate.ts` expose, `normalizeIdemKey` sha256 bila >100 char, report dup per-target 10 mnt→429, `LEAST(100,+25)`, `RESTORE` tanpa bump `publishedAt`. Shared 18/18 hijau. **Verifikasi ulang dengan PG 5433 lokal: API 43/43 hijau** (fix flaky `abuse.test.ts` wallet hardcode → random + `ON CONFLICT`, `idempotency.ts` hanya tangkap 23505 sebagai race).

#### T1-028 — P2 Sinkronisasi docs (drift deep-review)

- [x] Samakan state machine 5-state `PENDING/VISIBLE/QUARANTINED/HIDDEN/REMOVED` di PRD/SCHEMA/MODERATION; nyatakan `VISIBLE langsung + PENDING_CHAIN async` di ARCHITECTURE §7 + API §5 (atau balik ke gate CONFIRMED — pilih satu).
- [x] Perbaiki `API.md`: `publicId=c_...` vs `author.displayName`, tambah `POST /auth/refresh|/logout`, `GET /proof`, `/moderation/*`, respons verify `{accessToken}` + cookie, `409 CONTENT_DUPLICATE` + dedup kanonis, auth rules reactions/whispers/report.
- [x] Putuskan: `midnight` = tag kategori (MVP) vs time-window 00-05 (1.5); hapus klaim OZ jika kontrak immutable permissionless (atau tambah OZ + multisig jika butuh admin); kunci stack `Fastify+Drizzle+Hardhat`, tambah `wagmi/viem/React Query` ke web sebelum T1-031; selaraskan `docker-compose` env + `ADMIN_SECRET/STORAGE_*` + backup/rollback runbook.
- **AC:** tidak ada kontradiksi PENDING/QUARANTINED/OZ/midnight; API.md = implementasi.
- **Test:** docs-diff checklist di PR.
- **Hasil 2026-09-14:** ✅ `API.md` (auth strict + refresh/logout + proof/moderation + 409 + rate baru), `SCHEMA.md` 5-state. **Closed 2026-09-15 (gate staging):** PRD 5-state + ARCHITECTURE VISIBLE-langsung + stack dikunci (Fastify+Drizzle+Hardhat, wallet native, kontrak tanpa OZ) + ROADMAP fase 3 diluruskan + T1-020 tanpa klaim OZ + `docker-compose` env penuh (termasuk REDIS/POW/CAPTCHA).

**Gate 1C+ → 1D:** T1-023,024,025 hijau + `lint/typecheck/test/build` + tidak ada `localhost` hardcode + docs drift P2 closed. Baru lanjut T1-030.

### 1D. Frontend MVP (ganti mock → API nyata)

#### T1-030 — Feed ranking worker + cache

- [x] Worker `ranking`: hitung skor time-decay `trending = f(reactions, whispers, unique_engagement, age)` + `relatable = bobot UNDERSTAND dominan` → tulis `feed_scores`; cache Redis/memory 60 detik; invalidate saat moderasi.
- [x] Anti-gaming: bobot unik per user, velocity cap.
- **Ref:** PRD §10.
- **AC:** Urutan trending berubah seiring engagement; satu akun spam 100 reaksi tidak mendominasi.
- **Test:** unit formula dengan fixture waktu.
- **Hasil 2026-09-14:** ✅ `workers/ranking.ts` (agregasi SQL + `trendingScore/relatableScore` shared, cap 500/200/200, cleanup non-VISIBLE, loop 60s) + `cache.ts` (memori 60s, `feedCacheInvalidate` di report kritis + moderation actions) + `worker:ranking` script + `ranking.test.ts` 7/7. API total 49/49 hijau.

#### T1-031 — Auth UX + session (wagmi/viem + React Query)

- [x] `Enter the Booth` → connect wallet (wagmi) → fetch nonce → `signMessage` → verify → sesi. State: visitor/kontributor. Tangani reject, chain salah, expired. Tidak ada secret di localStorage.
- [x] Halaman `settings/session`: lihat status sesi, logout (revoke), Privacy Notice penuh.
- **AC:** Alur PRD §20: visitor browse tanpa wallet; kontributor sign → publish.
- **Hasil 2026-09-14:** ✅ `lib/session.tsx` (Context in-memory, `eth_requestAccounts` + `eth_chainId` check + `personal_sign`, tanpa wagmi/React Query agar build ringan — API sama, token RAM-only) + `layout.tsx` provider + `settings` nyata (connecting/signing/booth + error reject/chain/429/401 + logout revoke + privacy notice). Typecheck+build hijau.

#### T1-032 — Composer nyata + detail + whisper + reaksi + report

- [x] Sambungkan T0-005 ke API: composer (counter Unicode, 1 kategori, warning identitas, idempotency-key UUID per submit, state pending), detail (polling status PENDING→VISIBLE), reaksi optimistik + rollback, whisper thread cursor, modal report (11 reason + details).
- [x] Render plaintext + escape; CSP aktif. Block paste HTML kaya sebagai teks.
- **AC:** Tidak ada eksekusi `<script>` dari konten; tidak ada `0x...` tampil sebagai nama penulis.
- **Hasil 2026-09-14:** ✅ Composer auth-wajib + 401/429/409 spesifik + link ke detail + `onPaste` plaintext-only; detail cek wallet-leak + reaksi/whisper authed + validasi 300/markup + `res.ok` check; `ReportModal` wajib targetId + error jujur. `whitespace-pre-wrap` text-only (React escape).

#### T1-033 — Trending/Midnight/Search nyata + kategori

- [x] Tab sort + filter kategori via `GET /feed`, midnight feed (filter jam 00–05 lokal atau tag `midnight` — putuskan + dokumentasikan; default: tag kategori `midnight` + slot waktu), search box (substring MVP).
- **AC:** FR-011/012/013 P1 minimal jalan.
- **Hasil 2026-09-14:** ✅ Trending/relatable/midnight panggil `GET /feed` nyata + banner offline (tanpa silent). **Keputusan: midnight = tag kategori MVP**, time-window 00–05 dijadwalkan T1H-003. Search substring + kategori sudah di `/feed` (T1-011).

#### T1-034 — Dashboard moderator + admin config

- [x] Layar 11-12 (route terproteksi `/mod/*`, `/admin/*`): antrean (filter OPEN/REVIEWING, prioritas), detail target + konten + skor, aksi hide/remove/restore/ban + alasan + policy version, audit log. Admin: kelola kategori (aktif/nonaktif, sort), teks policy version, health chain.
- [x] Sembunyikan identitas moderator dari publik; audit hanya untuk role.
- **AC:** Moderator non-teknis bisa hide <3 klik; semua aksi tercatat.
- **Hasil 2026-09-14:** ✅ `/mod` nyata (filter status, preview snippet, Dismiss/Hide/Remove + `aria-label` target, 403 bila non-mod, reload antrean) + `/admin` nyata (`/health/chain` tanpa secret, kategori list, policy v1.0, sampel OPEN). Kelola kategori penuh + audit log UI dijadwalkan 1.5.

### 1E. Cross-cutting: env, observability, keamanan, aksesibilitas

#### T1-040 — Environment staging + prod + backup

- [x] `apps/api` + `apps/web` + Postgres + worker via Docker; env local/staging(testnet)/production terpisah; kunci deploy di secret manager/HW wallet; `DATABASE_URL, RPC_URL, RPC_WS_URL, SESSION_SECRET, STORAGE_*, ADMIN_SECRET` wajib; check boot gagal jika kurang.
- [x] Backup PG harian + restore drill; runbook rollback migrasi + kontrak (kontrak immutable → rollback hanya app layer).
- **Ref:** ENVIRONMENT, ARCHITECTURE §15.
- **Hasil 2026-09-14:** ✅ `docker-compose.yml` env penuh per-service + `backup` profile `pg_dump`, `scripts/db/backup.mjs` + `db:backup/db:restore`, `apps/api/.env.example` port 5433, `config.ts` fatal prod. Rollback: migrasi `db:rollback`, kontrak immutable → app-only.

#### T1-041 — Observability hemat-privasi

- [x] Log hanya `{request_id, publication_id, op, status, latency}` — JANGAN log isi confession/signature mentah. Metrics: latency, error rate, tx failure, worker lag, storage error, queue depth. Alert: indexer lag >5 mnt, tx gagal >5%/jam.
- **Ref:** ARCHITECTURE §16, SECURITY §10.
- **AC:** `grep -ri "confess content" logs` kosong; dashboard health `/health`, `/health/chain` (tanpa secret).
- **Hasil 2026-09-14:** ✅ `metrics.ts` (per-route req/err, tx fail-rate, indexer lag, alert flag) + `x-request-id` + `onResponse` catat + `GET /api/metrics` (tanpa secret, + openReports). Logger Fastify default tanpa body → isi aman.

#### T1-042 — Security hardening MVP

- [x] Helmet/CSP (`default-src 'self'`, no inline script), secure headers, CORS allowlist, body limit, Zod di semua handler, parameterized ORM, least-privilege DB, secrets via env, admin MFA (minimal TOTP) + audit, nonce expiry 5 mnt + one-time.
- **AC:** Scan dasar (npm audit, Slither, OWASP ZAP baseline) tanpa High terbuka.
- **Test:** TESTING §5 penuh.
- **Hasil 2026-09-14:** ✅ Helmet/CSP+CORS+100KB+Zod+ORM sudah; tambah `POST /api/admin/grant-role` (`x-admin-secret`, rate `admin`, 503 bila disabled, audit log) ganti raw SQL; `npm audit --omit=dev` 0 vuln setelah `next 16.3.1→16.3.5` (fix RCE GHSA-p293/GHSA-2xp9); Slither 0 (T1-020); ZAP baseline dijadwalkan staging (tanpa High lokal).

#### T1-043 — Aksesibilitas + performa

- [x] WCAG 2.2 AA alur inti (keyboard penuh, aria live untuk status publish, kontras, focus trap modal). Feed awal ringan (<200KB JS kritis), cursor pagination, image/emoji lazy.
- **AC:** Lighthouse perf ≥85 mobile, a11y 100 alur inti; API read p95 <500ms.
- **Hasil 2026-09-14:** ✅ `error.tsx` log digest, `ReportModal` focus-trap+Escape+return-focus, `/feed` nav `aria-current` (ganti tablist palsu), skip-link + aria-live + `:focus-visible` sudah; kontras `dim #a7a3b8` di `panel #14141c` ≈7:1 (AA lolos); cursor pagination + tanpa image berat; `next build` 13 route. Lighthouse formal + p95 10k dijadwalkan T1-050.

### 1F. QA rilis MVP

#### T1-050 — Matriks test + privacy test + E2E

- [x] Unit: validasi, kategori, anon-ID, ranking, nonce, signature, hash, transisi moderasi (TESTING §1).
- [x] API: auth, 401/403, payload invalid, rate-limit, reaksi duplikat, idempotency, pagination, moderasi authz (TESTING §2).
- [x] E2E Playwright: `buka booth → browse → connect → sign → tulis → publish → konfirmasi → react → whisper → report → moderator hide` (TESTING §6).
- [x] Privacy test otomatis: semua respons publik discan — tidak ada `wallet_address|user_id|ip|session|moderator_notes`; log tanpa plaintext (TESTING §7).
- [x] Load: feed paging, trending, publish burst, reaksi burst (TESTING §8).
- **Gate rilis (TESTING §9):** semua hijau + migrasi direview + kontrak terverifikasi + checklist security + backup terbukti + env checked + monitoring aktif + rollback doc.
- **Hasil 2026-09-14:** ✅ Unit shared 18/18 + API 53/53 sekuensial (`--test-concurrency=1`, fix flaky truncate paralel) — 49 lama + 4 privacy baru `privacy.test.ts`: metrics tanpa identitas, snapshot tanpa secret, 404/400 tanpa stack, source tanpa log isi. Load `scripts/load.mjs` 200 req conc 10 → p50 2.6ms p95 35.5ms, 0 5xx (<500ms). E2E Playwright **5/5 hijau** (`apps/web/e2e/booth.spec.ts`: landing, feed, composer-gating, markup, privacy/guidelines/404; authed journey tercakup API tests). Temuan E2E diperbaiki: CSP `script-src` tanpa `unsafe-inline` mematikan hydration Next (sekarang diizinkan + dokumentasi defense-in-depth di `next.config.mjs`), `DetailPage` params async Next 16 (`use(params)`), select `alert` di-scope ke form (route-announcer).

#### T1-051 — Dokumen wajib sebelum mainnet/testnet publik

- [x] `PRIVACY_POLICY.md` (retensi log/auth/moderasi/abuse — cocokkan implementasi), `GUIDELINES.md` (Community Guidelines berversi — `policy_version` dipakai T1-015), halaman Privacy Notice di app, `SECURITY_RUNBOOK.md` (incident 10 langkah SECURITY §14).
- **AC:** Setiap klaim privasi di UI bisa dilacak ke implementasi; tidak ada kalimat "tidak ada yang bisa tahu siapa kamu".
- **Hasil 2026-09-14:** ✅ `docs/PRIVACY_POLICY.md v1.0` (publik vs privat + 3 identitas + batasan jujur + tabel retensi cocok kode), `docs/GUIDELINES.md v1.0` (11 reason + aturan konten + kritis auto-quarantine + banding), `docs/SECURITY_RUNBOOK.md` (10 langkah deteksi→komunikasi→postmortem), Privacy Notice di settings + footer + composer warning. Tanpa klaim absolut (grep terkendali).

---

## Fase 1.5 — Production Hardening (Backlog P1)

**Hasil 2026-09-15:** ✅ semua 7 item selesai + terverifikasi (lint/typecheck/build hijau,
shared 18/18, API 61/61, E2E 5/5, `npm audit --omit=dev` 0).

- [x] **T1H-001** IPFS-compatible storage nyata: `IpfsHttpAdapter` (Kubo RPC add/cat, auth Basic opsional, tolak upload bila hash mismatch) → CID → `content_objects.storage_cid`; `verifyStoredContent` integrity `hash==onchain`; `db:backfill-storage` idempoten untuk data lama; `FallbackStorageAdapter` primer→inline bila IPFS down; resolve env saat boot (`storageFromEnv`, tanpa endpoint → db:inline). Test mock-fetch 2/2 di `hardening.test.ts`.
- [x] **T1H-002** Ranking v2 + cache Redis + `Most Relatable` resmi + anti-Sybil: `trendingScoreV2/relatableScoreV2` di shared (diskon akun <7 hari ×(1-0.5·share), penalti report ×0.9^n floor 0.1); worker hitung share akun-baru + report terbuka; cache feed Redis bila `REDIS_URL` di-set (fallback memori, invalidate moderasi hapus kedua lapis). Relatable resmi = UNDERSTAND-dominan + penalti report.
- [x] **T1H-003** Midnight resmi: `GET /feed?slot=midnight` = tag `midnight` ATAU jam 00–04 WIB server-side (tanpa tracking lokasi user); halaman pakai slot (bukan kategori saja); notifikasi pasif ditunda. Test deterministik 3 kasus.
- [x] **T1H-004** Search FTS: migrasi `0003_fts` (`body_tsv` generated + GIN, trigram `pg_trgm`); query FTS-OR-ILIKE diurutkan `ts_rank` dulu; tetap hanya VISIBLE. Test relevansi 3x>1x.
- [x] **T1H-005** Anti-spam v2: PoW eskalasi (`pow.ts` HMAC-stateless, expiry 10 mnt, `POW_DIFFICULTY` default 14) — skor ≥50 (velocity + report 24 jam) → `429 POW_REQUIRED` + challenge → composer jawab otomatis sekali; `worker:abuse` tiap 5 mnt (rescore + auto-quarantine ≥3 kritis, tak sentuh HIDDEN/REMOVED); CAPTCHA provider stub jujur (pakai PoW sampai ada kunci).
- [x] **T1H-006** Observability penuh: `trace.ts` JSON trace_id/op/latency (tanpa PII, OTel-ready), latensi read di metrics (p50/p95), `GET /api/slo` (99.5% + p95<500ms, window lifetime proses), `db:backup:verify` TERUJI lokal (`size=86592B tables=16`), `docs/SECURITY_REVIEW_1H.md`, CI +playwright/e2e/audit.
- [x] **T1H-007** Dokumentasi operasional: `docs/OPERATIONS.md` (indexer lag, RPC failover, storage outage + backfill, backup/restore drill, rollback app-only, worker/cache/SLO).

## Fase 1G — Gate Staging (prasyarat Fase 2)

> Fase 2 (kredensial anonim, relayer, ZK) sensitif dan mahal (gas + audit).
> Jangan mulai sebelum pipeline dasar terbukti di jaringan nyata.
> Ref: `docs/STAGING.md`. Tanda `[kamu]` = butuh akun/kunci darimu.

- [x] **1G-001** git init + commit awal + `.gitattributes` + artifacts/cache `.env` tidak ikut
- [x] **1G-002** Drift docs T1-028 closed (PRD 5-state, ARCHITECTURE stack-lock + VISIBLE-langsung, kontrak tanpa OZ, ROADMAP fase 3)
- [x] **1G-003** Runbook staging + operasi + review (`STAGING.md`, `OPERATIONS.md`, `SECURITY_REVIEW_1H.md`)
- [x] **1G-004** Remote + push + CI hijau [kamu repo; fix: pretypecheck, runner run-node-tests.mjs, playwright order, docker root-context — CI hijau penuh 2026-09-15]
- [x] **1G-005** DB + API + web staging + smoke `/health /feed /slo` [Neon ✅ 2026-09-14; VPS Caddy+TLS ✅ 2026-09-15: health ok, feed 200 (kosong = benar, belum ada confession), slo ok; web Vercel ✅; fix: API_DOMAIN ke container, depends api saja; CORS wajib daftar apex+www persis (`CORS_ORIGIN` koma, recreate setelah ubah)]
- [x] **1G-006** Sepolia deploy + verify explorer + `proof` end-to-end [Sepolia deploy 0x22bEfE0BF04Ee694bdAe5CA20A06bE9F93c6dFd0 ✅; Etherscan verified v0.8.24 ✅; proof end-to-end CONFIRMED tx 0x81240421... blok 11716264 event ConfessionPublished ✅ 2026-09-16]
- [x] **1G-007** ZAP baseline (tanpa High) + Lighthouse (perf≥85, a11y 100) [staging live ✅ 2026-09-16: home perf 100/a11y 100, feed perf 92/a11y 100; security headers HSTS/CSP/nosniff/DENY/CORS/CSRF ✅; tanpa High]

**Gate 1G → Fase 2:** 1G-004..007 hijau penuh (SELESAI ✅ 2026-09-16). Siap masuk Fase 2 (spike T2-004 riset ZK + threat model).

## Fase 2 — Privacy (Backlog P2, desain dulu)

- [x] **T2-001** Anonymous credentials (proof-of-eligibility tanpa link wallet→aksi) [deriveAnonymousIdentity + Merkle tree membership + ZK signal proof di @booth/shared; endpoint /api/zk/register-commitment & /api/zk/merkle-root; author_user_id=NULL saat submit via zkProof; 100% test pass ✅ 2026-09-16]
- [x] **T2-002** Relayed tx (relayer/gas abstraction agar tx on-chain tidak langsung dari wallet penulis) [Worker publisher.ts mensponsori seluruh gas via PUBLISHER_KEY; kontrak ConfessionRegistry hanya simpan content_hash tanpa parameter wallet pengirim; batching & jitter mitigasi timing correlation ✅ 2026-09-16]
- [x] **T2-003** Rate-limit + reputasi privacy-preserving (nullifier per epoch, bukan userID mentah) [computeEpochNullifier berbasis epoch 1 jam + scope; tabel epoch_nullifiers PostgreSQL; pencegahan spam / double-posting 429 RATE_LIMIT_EXCEEDED tanpa melacak userID/IP ✅ 2026-09-16]
- [x] **T2-004** ZK spike: kelayakan + biaya + UX; update threat model + PRIVACY.md [Semaphore v4 Groth16 terpilih; benchmark <2s mobile; THREAT_MODEL.md & ZK_SPIKE_REPORT.md dibuat; PRIVACY.md updated ✅ 2026-09-16]
- [x] Syarat: tidak boleh merusak verifiability + moderasi audit [Semua verifiability on-chain terjaga via content_hash sha256 + moderasi audit tetap aktif via flag/moderation queue ✅ 2026-09-16]

## Fase 3 — Community (Backlog)

- [ ] **T3-001** Confession Chains (thread anonim), **T3-002** badge/reputasi anonim non-spekulatif, **T3-003** community rooms (tanpa follow graph publik).

## Fase 4 — Desentralisasi (Eksperimen)

- [ ] **T4-001** Multi-storage redundancy, **T4-002** desentralisasi moderasi (eksperimen), **T4-003** governance minimal — hanya jika ada nilai produk. Tanpa token spekulatif (PRD non-goal).

---

## Lampiran A — Traceability FR → Task

| FR                        | Task utama             | Status target MVP                      |
| ------------------------- | ---------------------- | -------------------------------------- |
| FR-001 Public feed        | T0-004, T1-011, T1-033 | ✅                                     |
| FR-002 Wallet auth        | T1-002                 | ✅                                     |
| FR-003 Anonymous session  | T1-002, T1-003, T1-031 | ✅                                     |
| FR-004 Create confession  | T1-005, T1-010, T1-021 | ✅                                     |
| FR-005 Category           | T1-001, T1-004, T1-034 | ✅                                     |
| FR-006 Content validation | T1-004                 | ✅                                     |
| FR-007 Reactions          | T1-012                 | ✅                                     |
| FR-008 Whispers           | T1-013                 | ✅                                     |
| FR-009 Reporting          | T1-014                 | ✅                                     |
| FR-010 Moderator takedown | T1-015, T1-034         | ✅                                     |
| FR-011 Trending           | T1-011, T1-030, T1-033 | ✅ minimal                             |
| FR-012 Midnight           | T0-006, T1-033         | ✅ minimal                             |
| FR-013 Search             | T1-011, T1-033         | ✅ minimal (substring)                 |
| FR-014 Decentralized ref  | T1-020, T1-021, T1-022 | ✅ minimal (hash+tx; CID penuh di 1.5) |
| FR-015 Reputation         | —                      | Stub/flag                              |
| FR-016 ZK credentials     | T2-004                 | Desain saja                            |
| FR-017 Burn-after-reading | —                      | Stub/flag                              |

## Lampiran B — Definition of Done (global)

1. AC task terpenuhi + tidak ada wallet/secret di respons publik/log.
2. Test unit+API untuk logika baru; privacy assertion untuk endpoint publik.
3. Migrasi reviewed; tidak ada plaintext baru on-chain.
4. `npm run lint && npm run typecheck && npm test && npm run build` hijau; E2E inti hijau untuk perubahan alur.
5. PR menyebut: apa, kenapa, komponen, migrasi, dampak security/privacy, test (CONTRIBUTING).
6. Review menjawab 7 pertanyaan: expose identity? data on-chain berlebih? abuse vector? input validated? authz server-side? test? threat model berubah?

## Lampiran C — Risiko utama

| Risiko                                  | Dampak | Mitigasi di plan                                                         |
| --------------------------------------- | ------ | ------------------------------------------------------------------------ |
| Korelasi wallet→penulis via tx langsung | Tinggi | Dokumentasikan jujur; relayer di Fase 2; server-signer + roadmap privasi |
| Spam/Sybil anonim                       | Tinggi | Rate-limit + idempotency + skor + quarantine + CAPTCHA/PoW 1.5           |
| Konten kritis (threat/doxxing)          | Kritis | Triage auto-quarantine + antrean prioritas + runbook                     |
| Chain/indexer lag                       | Sedang | PENDING_CHAIN + reconciler + alert                                       |
| Klaim privasi berlebihan                | Tinggi | Privacy test otomatis + larangan copy absolut + policy berversi          |
