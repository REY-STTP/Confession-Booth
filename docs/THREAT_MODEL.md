# Confession Booth — Threat Model & Security Architecture (Fase 2)

**Version:** 2.0  
**Status:** Active  
**Last Updated:** 2026-09-16

---

## 1. Executive Summary

Confession Booth bertujuan menyediakan platform pengungkapan diri yang aman, privat, dan terverifikasi secara on-chain. Pada Fase 1 (MVP & Staging), privasi diimplementasikan pada tingkat antarmuka dan proyeksi data (alamat wallet dan userID disembunyikan dari feed publik).

Namun, model Fase 1 memiliki batas privasi inheren: **keterkaitan langsung (linkability) di database internal** antara `users.wallet_address` dan `confessions.author_user_id`.

Fase 2 menghadirkan arsitektur privasi kriptografis berbasis **Zero-Knowledge Proofs (ZK-SNARKs)** dan **Anonymous Credentials (Semaphore Protocol)**. Dokumen ini mendefinisikan model ancaman, profil penyerang, permukaan serangan, dan mitigasi kriptografis yang diterapkan.

---

## 2. Adversary Models (Profil & Kekuatan Penyerang)

| Profil Penyerang                   | Deskripsi & Akses                                                                              | Kemampuan & Vektor Serangan                                                                                                     |
| :--------------------------------- | :--------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| **A1: Passive Public Observer**    | Mengamati data publik di website dan blockchain publik (Sepolia/Mainnet).                      | Menganalisis konten feed, timestamp publikasi, transaksi kontrak `ConfessionRegistry`, dan pola reaksi.                         |
| **A2: Malicious Database Insider** | Memiliki akses read-only atau read-write ke database PostgreSQL (`Neon`).                      | Memeriksa foreign key `author_user_id`, session tokens, IP logs, dan audit tables untuk merekonstruksi identitas penulis.       |
| **A3: Rogue RPC / Infra Provider** | Pengelola node RPC Ethereum (misal: Infura/Alchemy/PublicNode), CDN/Vercel, atau VPS provider. | Menganalisis metadata jaringan: IP asal request HTTP, korelasi waktu antara request ke API dengan penyiaran transaksi on-chain. |
| **A4: Sybil & Spam Attacker**      | Pengguna nakal yang membuat ribuan akun/wallet untuk membanjiri feed.                          | Melakukan DoS/spam confession kotor, manipulasi skor relatable/trending, atau mencoba melacak korban melalui bot reaksi.        |
| **A5: Malicious Moderator**        | Akun dengan role `MODERATOR` atau `ADMIN` yang berniat jahat.                                  | Mencoba mengeksploitasi fitur moderasi untuk men-deanonimisasi pengguna atau menyensor postingan secara sepihak.                |

---

## 3. Analisis Kerentanan Fase 1 vs Solusi Fase 2

### 3.1. Database-Level Deanonymization (Risiko A2)

- **Kelemahan Fase 1:** Kolom `confessions.author_user_id` merujuk langsung ke tabel `users.id` yang memiliki `wallet_address`. Jika database bocor, identitas penulis langsung terungkap.
- **Mitigasi Fase 2:** Pemutusan hubungan identitas (_Unlinkability_). Kolom `author_user_id` dibuat `NULL` untuk submission ZK. Sebagai gantinya, request menyertakan **ZK Proof of Membership** dan **Epoch Nullifier**. Database backend tidak pernah menerima atau menyimpan informasi wallet pembuat confession.

### 3.2. Network & Timing Correlation Attacks (Risiko A1 & A3)

- **Kelemahan Fase 1:** Ketika pengguna mem-post confession pada detik $T$, relayer publisher mem-publish ke blockchain pada $T + 5\text{ detik}$. Pengamat jaringan dapat menghubungkan IP request HTTP dengan transaksi blockchain.
- **Mitigasi Fase 2:**
  1. _Randomized Batching & Jitter_: Background worker publisher menampung antrean publikasi dan menambahkan delay acak (15–60 detik) serta mem-batch beberapa confession sekaligus.
  2. _Zero Identity on-chain_: Kontrak `ConfessionRegistry.sol` hanya mencatat `confessionId` dan `contentHash`, dipanggil oleh alamat relayer (`PUBLISHER_KEY`), tanpa parameter identitas pengirim.

### 3.3. Sybil & Denial of Service Attacks (Risiko A4)

- **Kelemahan Fase 1:** Pembatasan frekuensi (rate limiting) bergantung pada `user_id` di database. Jika `user_id` dihapus demi privasi, penyerang dapat melakukan spam tanpa batas.
- **Mitigasi Fase 2:** **Epoch-Based Nullifiers**. Pengguna menghasilkan nullifier unik secara deterministik dari rahasia identitas mereka untuk setiap epoch waktu (misal: per jam atau per 24 jam). Jika nullifier yang sama dikirim dua kali dalam satu epoch, API menolak request (429/409) tanpa perlu tahu siapa pemilik wallet-nya.

### 3.4. Rogue Moderator Abuse (Risiko A5)

- **Mitigasi Fase 2:** Dashboard moderasi hanya memiliki visibilitas atas `public_id`, `body_text`, dan `reason_code` laporan. Database tidak memiliki data wallet pembuat untuk ditampilkan kepada moderator. Aksi moderasi (HIDE/BAN) dicatat dalam audit trail permanen dengan parameter target `public_id` dan `nullifier_hash`.

---

## 4. Arsitektur Kriptografi Zero-Knowledge (Semaphore v4)

Fase 2 mengadopsi protokol **Semaphore** (Zero-Knowledge Anonymous Signaling di ekosistem Ethereum):

```
+-----------------------------------------------------------------------+
| 1. REGISTRATION PHASE (Deterministic Identity via Wallet Signature)   |
+-----------------------------------------------------------------------+
  User Wallet --(Sign SIWE Challenge)--> Seed
    --> Identity { trapdoor, nullifier }
    --> Identity Commitment = Poseidon(trapdoor, nullifier)
    --> Dikirim ke server dan dimasukkan ke Merkle Tree (Depth 20)

+-----------------------------------------------------------------------+
| 2. ACTION PHASE (Confession / Whisper / Reaction)                     |
+-----------------------------------------------------------------------+
  Client Browser (WASM Prover)
    Inputs:
      Private: Identity Trapdoor, Identity Nullifier, Merkle Proof (Path)
      Public:  Merkle Root, Epoch Scope, Content Hash (Signal)
    Generates:
      - ZK-SNARK Proof (Groth16 over BN254)
      - Nullifier Hash = Poseidon(Identity Nullifier, Epoch Scope)

+-----------------------------------------------------------------------+
| 3. VERIFICATION & STORAGE PHASE                                       |
+-----------------------------------------------------------------------+
  API Server (Fastify Backend)
    1. Validasi Merkle Root terdaftar (aktif / recent).
    2. Periksa apakah Nullifier Hash sudah pernah dipakai dalam Epoch ini.
    3. Verifikasi ZK Proof terhadap Content Hash (Signal).
    4. Simpan ke PostgreSQL: author_user_id = NULL, nullifier_hash = X.
    5. Publisher Worker mengirim komitmen ke ConfessionRegistry.sol di Sepolia.
```

---

## 5. Parameter Keamanan Kriptografi

1. **Kurva Elips:** `BN254` (`alt_bn128`), kompatibel native dengan EVM precompiles (`0x06`, `0x07`, `0x08`).
2. **Sistem Pembuktian:** `Groth16` (ukuran proof konstan 128-256 byte, verifikasi sangat cepat <5 ms).
3. **Fungsi Hash SNARK-Friendly:** `Poseidon Hash` (efisiensi constraint tinggi, ~300 constraints per hash vs ribuan constraints untuk SHA256).
4. **Kedalaman Merkle Tree:** `Depth = 20`, mendukung hingga $2^{20} = 1.048.576$ anggota anonim per grup.
5. **Ukuran Kumpulan Anonimitas (Anonymity Set):** Minimal 100 anggota sebelum fitur ZK dibuka ke publik, memastikan derajat ketakterbedaan (_k-anonymity_) yang memadai.

---

## 6. Syarat Tidak Boleh Dilanggar (Non-Negotiable Invariants)

1. **Verifiabilitas On-Chain:** Bukti keberadaan konten (`ConfessionRegistry.sol`) tetap dapat diverifikasi secara independen oleh siapa pun di explorer Sepolia/Ethereum.
2. **Kepatuhan Moderasi:** Konten berbahaya (pelecehan, CSAM, doxxing) dapat di-_takedown_ dari feed dalam <5 detik oleh moderator terotorisasi via `public_id`.
3. **Penyimpanan Non-Kastodial:** Kunci privat identitas ZK (`trapdoor` dan `nullifier`) hanya berada di memori browser pengguna dan tidak pernah dikirim ke jaringan.
