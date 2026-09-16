# Confession Booth — Privacy Principles

## What We Aim to Protect

Confession Booth is designed to avoid exposing a public identity attached to a confession.

## What We Do Not Promise

The service does not automatically guarantee perfect anonymity.

Potential correlation sources include:

- blockchain transaction history;
- RPC provider metadata;
- network/IP metadata;
- browser/device metadata;
- third-party infrastructure;
- user behavior that reveals identity.

## Data Minimization

The application should collect only what is necessary to:

- authenticate;
- publish content;
- prevent abuse;
- moderate content;
- operate the service.

## Public Data

A normal feed response should expose:

- anonymous display name;
- confession content;
- category;
- public engagement counts;
- publication metadata.

It should not expose:

- wallet address;
- internal user ID;
- IP;
- email;
- moderation data.

## Blockchain

Blockchain records are public and generally immutable.

Do not publish sensitive personal information on-chain.

## User Responsibility

Users should avoid including identifying information in their own confession, such as:

- full name;
- address;
- phone number;
- private credentials;
- unique personal details that make identification trivial.

The UI should warn users before publication.

## Privacy Evolution (Fase 2 Architecture)

Fase 2 mengadopsi arsitektur privasi kriptografis penuh melalui **Zero-Knowledge Proofs (ZK-SNARKs)** dan **Semaphore Protocol**:

1. **Unlinkability (Pemutusan Hubungan Identitas):**
   - Penulis confession membuktikan keanggotaan/kelayakan (_proof-of-membership_) via Merkle tree tanpa mengungkap alamat wallet ataupun ID pengguna di database.
   - Kolom `confessions.author_user_id` bernilai `NULL` untuk pengiriman berbasis ZK.
2. **Epoch-Based Nullifiers:**
   - Pembatasan frekuensi posting (_rate-limiting_) dan pencegahan spam menggunakan nullifier deterministik per epoch (misal: per jam/hari), bukan query identitas pengguna.
3. **Gas & Network Relaying:**
   - Transaksi on-chain di-broadcast oleh worker relayer publik (`publisher`), sehingga wallet pribadi pengguna tidak pernah berinteraksi langsung dengan kontrak `ConfessionRegistry.sol`.
   - Menggunakan randomized batching dan timing jitter untuk mencegah korelasi waktu antara request HTTP dan konfirmasi blok.
4. **Non-Custodial Identity:**
   - Parameter rahasia identitas ZK (`trapdoor` dan `nullifier`) diturunkan secara deterministik dari tanda tangan wallet pengguna di client dan tidak pernah dikirim atau disimpan di server.

Detail analisis ancaman dan mitigasi dapat dilihat pada [THREAT_MODEL.md](file:///d:/Secret/My-Project/10-Confession-Booth/docs/THREAT_MODEL.md) dan laporan kelayakan teknis pada [ZK_SPIKE_REPORT.md](file:///d:/Secret/My-Project/10-Confession-Booth/docs/ZK_SPIKE_REPORT.md).
