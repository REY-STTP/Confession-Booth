# Confession Booth — Community Guidelines v1.0

**policy_version:** `v1.0` (kirim di `POST /moderation/actions {policy_version}`).
Pelanggaran → report (11 reason) → triase → hide/remove/restrict/ban + audit.

## Dilarang (→ reason code)

1. Spam/flood → `SPAM`
2. Harassment/bullying → `HARASSMENT`
3. Hate → `HATE`
4. Ancaman/kekerasan → `THREAT` (kritis → auto-`QUARANTINED`)
5. Doxxing/info pribadi → `DOXXING` (kritis)
6. Eksploitasi seksual/anak → `SEXUAL_EXPLOITATION` (kritis)
7. Self-harm — tulis dengan hati-hati; kami prioritaskan keselamatan → `SELF_HARM`
8. Penipuan/scam → `FRAUD`
9. Malware/phising/link berbahaya → `MALWARE` (link ditolak MVP: `LINKS_NOT_ALLOWED_MVP`)
10. Aktivitas ilegal → `ILLEGAL_ACTIVITY`
11. Lainnya → `OTHER` (wajib `details` jelas, max 500, tanpa markup)

## Aturan konten

- 1–500 char confession, 1–300 whisper, plaintext, tanpa HTML/script.
- 1 kategori aktif, tanpa link (MVP), tanpa info pengenal diri/orang lain.
- Duplikat per-user 10 mnt → 409; spam burst → 429 + skor abuse.

## Kritis (T1-014)

`THREAT/DOXXING/SEXUAL_EXPLOITATION` → langsung `QUARANTINED` + skor +25 (cap 100)
→ hilang dari feed (404 netral) → antrean prioritas → putusan manusia.

## Banding

Konten bisa `RESTORE` → `VISIBLE` (tanpa bump `publishedAt`). Semua aksi tercatat
(actor, reason, timestamp, target, policy_version); identitas moderator tidak publik.
Kontrak on-chain immutable — takedown hanya di app-layer.
