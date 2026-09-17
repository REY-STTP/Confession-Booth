# Confession Booth

> **"Say what you can't say."** An encrypted, anonymous confession sanctuary where identity is optional and expression is the product.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black.svg)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.2-green.svg)](https://www.fastify.io/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)

---

## Overview

**Confession Booth** is a decentralized, privacy-first web application designed for honest, unburdened expression. It provides a dignified digital sanctuary for secrets, regrets, and unspoken thoughts without social comparison, follower graphs, or algorithmic tracking.

The system uses **Zero-Knowledge (ZK) cryptography** and **Ethereum Sepolia on-chain anchoring** to guarantee cryptographic authenticity and tamper-resistance — while ensuring plaintext confessions never touch the blockchain and authors remain strictly unlinkable.

---

## Core Philosophy & Privacy Guarantees

1. **Anonymous Presence (Zero Wallet Requirement)**
   - Anyone can browse, search, and read public confessions freely without connecting a Web3 wallet or creating an account.
   - Public feeds never display wallet addresses, centralized user IDs, or follower networks. All public authors appear as `Anonymous #NNNN`.

2. **Zero Plaintext On-Chain**
   - Plaintext confessions are **never** stored on the blockchain.
   - Only cryptographic digests (`SHA-256 contentHash`), IPFS content identifiers (`CID`), timestamps, and policy versions are anchored to the Sepolia smart contract.

3. **ZK Stealth & Unlinkable Publishing**
   - In **ZK Stealth Mode**, membership proofs are generated locally inside the user's browser using Merkle Proofs and Epoch Nullifiers.
   - The submission payload is dispatched to the backend API **without authentication headers or session tokens**, making it mathematically impossible for the database or server to correlate a confession with a wallet address.

4. **Honest Privacy Boundaries**
   - We do not make false promises of magical anonymity. Network-level metadata, RPC endpoints, and distinct writing patterns can create correlation risks. The platform actively reminds authors not to include personally identifiable details.

5. **In-Memory Ephemeral Sessions**
   - Access tokens are stored exclusively in RAM (no `localStorage` or `sessionStorage` token leakage).
   - Sessions are protected via secure, HttpOnly refresh cookies with automatic expiry upon window closure.

---

## Key Features

- **The Language of Empathy**: Replaces addictive vanity counters with quiet signals of understanding:
  - `I understand` (Resonance)
  - `Sending love` (Support)
  - `I feel this` (Shared sorrow)
  - `That’s wild` (Honest disbelief)
  - `I shouldn’t laugh` (Dark humor relief)
- **Anonymous Whispers**: Deep, threaded discussions beneath confessions. Authors can reply anonymously with distinctive **OP (Original Poster)** badges.
- **Community Sanctuaries (Rooms)**: Themed conversational spaces with dedicated community guidelines:
  - `#campus-life`: University secrets, academic pressure, and campus friendships.
  - `#workplace-burnout`: Career stress, imposter syndrome, and corporate culture.
  - `#unsent-letters`: Unspoken words, longings, and letters never sent.
  - `#deep-existential`: Philosophy, purpose of life, and quiet reflections.
  - `#midnight-thoughts`: Late-night thoughts when the world is asleep.
- **Midnight Archive**: An atmospheric nocturnal feed activated during late hours (00:00 – 04:00 WIB) with quiet introspection modes.
- **Soulbound Reputation Badges**: Non-transferable cryptographic reputation earned through positive community contributions:
  - `Empathetic Listener`: Community members who actively offer resonance and understanding.
  - `Midnight Soul`: Frequent nocturnal confessors in the midnight window.
  - `Chain Weaver`: Active participants in anonymous whisper threads.
  - `Stealth Confessor`: Authors publishing via Zero-Knowledge stealth proofs.
- **Cryptographic Proof Inspector**: Interactive card component allowing visitors to verify SHA-256 canonical content digests, Sepolia block heights, and Etherscan transaction records.
- **Transparent Moderation**: Audited, policy-based moderation workflow (<3 clicks to hide, triage, or dismiss violations) backed by immutable audit trails without revealing moderator identities.

---

## Monorepo Architecture

```text
10-Confession-Booth/
├── apps/
│   ├── web/               # Next.js 16 (App Router), Tailwind CSS, Lucide Icons, Radix UI, Sonner
│   │   ├── app/           # Routes: feed, compose, confessions, rooms, trending, relatable, midnight, settings, guidelines, privacy, mod, admin
│   │   ├── components/    # Reusable UI (CategoryPills, FeedTabs, ProofInspector, ReportDialog, ZkStepper, WhisperThread)
│   │   ├── lib/           # Web client API helpers, session state provider, ZK browser proof generator
│   │   └── e2e/           # Playwright end-to-end test suite
│   └── api/               # Fastify backend, Drizzle ORM, Zod validation, EIP-712 auth, cryptographic workers
│       ├── src/           # API routes, services, middleware (PoW challenge, rate-limiting, error handler)
│       └── scripts/       # DB migration scripts, seeder, confession reset utility
├── packages/
│   └── shared/            # Single source of truth for validation schemas, emotion categories, badge metadata, and types
├── contracts/             # Solidity smart contracts (ConfessionRegistry.sol on Sepolia) & Hardhat toolchain
└── docker-compose.yml     # Local infrastructure services (PostgreSQL)
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `v10.x` or higher
- **PostgreSQL**: `v15+` (Local Docker or cloud PostgreSQL such as Neon)
- **MetaMask / EVM Wallet**: For signing sessions and ZK stealth proofs

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/REY-STTP/Confession-Booth.git
cd Confession-Booth
npm install
```

### 2. Configure Environment Variables

Copy the template configuration:

```bash
cp .env.example .env
```

Key environment variables:

| Variable                       | Description                                            | Default / Example                             |
| :----------------------------- | :----------------------------------------------------- | :-------------------------------------------- |
| `DATABASE_URL`                 | PostgreSQL connection URI                              | `postgres://booth:booth@localhost:5432/booth` |
| `NEXT_PUBLIC_APP_URL`          | Frontend URL                                           | `http://localhost:3000`                       |
| `NEXT_PUBLIC_API_URL`          | Backend Fastify API URL                                | `http://localhost:4000`                       |
| `NEXT_PUBLIC_CHAIN_ID`         | Ethereum Chain ID (Sepolia)                            | `11155111`                                    |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Sepolia ConfessionRegistry Address                     | `0xa8302048773DD213B9D311c2abda199B14339188`  |
| `SESSION_SECRET`               | 32+ character random string for JWT / sessions         | `change-me-min-32-chars-in-production`        |
| `ADMIN_SECRET`                 | Secret token for administrative health & metric routes | `change-me-admin-only`                        |
| `POW_DIFFICULTY`               | Client-side Proof-of-Work difficulty bits (anti-spam)  | `14`                                          |
| `CORS_ORIGIN`                  | Allowed CORS origins for API requests                  | `http://localhost:3000`                       |

### 3. Start Database Service

```bash
docker compose up -d postgres
```

### 4. Run Migrations & Setup

```bash
npm run build --workspace @booth/shared
npm run db:migrate --workspace @booth/api
```

_(Optional) Seed room categories and baseline configuration:_

```bash
node apps/api/scripts/db/seed.mjs
```

### 5. Launch Development Servers

Run both the Web frontend (`:3000`) and API backend (`:4000`) concurrently:

```bash
npm run dev
```

Alternatively, run each workspace individually:

```bash
npm run dev:web   # Starts Next.js on http://localhost:3000
npm run dev:api   # Starts Fastify on http://localhost:4000
```

---

## Available Scripts

From the repository root, you can execute workspace-aware commands:

| Command                | Description                                                          |
| :--------------------- | :------------------------------------------------------------------- |
| `npm run dev`          | Runs all workspace dev servers concurrently                          |
| `npm run dev:web`      | Starts only the Next.js web application                              |
| `npm run dev:api`      | Starts only the Fastify backend API                                  |
| `npm run build`        | Builds all packages (`@booth/shared`, `@booth/api`, `@booth/web`)    |
| `npm run typecheck`    | Validates TypeScript types across all workspaces with `tsc --noEmit` |
| `npm run test`         | Runs Fastify backend unit and integration tests                      |
| `npm run lint`         | Runs ESLint verification across the entire project                   |
| `npm run format`       | Automatically formats codebase via Prettier                          |
| `npm run format:check` | Checks code formatting compliance without modifying files            |

### Running End-to-End (E2E) Browser Tests

Playwright tests verify user flows including visitor mode, gating, HTML sanitization, and offline fallbacks:

```bash
cd apps/web
npx playwright test
```

---

## Security & Anti-Abuse Protections

- **Proof-of-Work (PoW) Hashcash Challenge**: Requires client browsers to solve a cryptographic SHA-256 puzzle before submitting confessions, mitigating automated denial-of-service and bot spam.
- **Client & Server Input Sanitization**: HTML tags, scripts, and Markdown styling are disallowed — confessions remain strict plaintext (maximum 500 characters for confessions, 300 characters for whispers).
- **Dual-Layer Rate Limiting**: Distributed rate-limiting by IP address and per-epoch nullifier.
- **Deterministic Nullifiers**: Prevents double-publishing and replay attacks in ZK Stealth Mode without linking back to author identity.
- **Audit Trails**: All moderation actions require cryptographic identification and policy references, logged immutably for compliance.

---

## Epilogue

> _"The booth stands between the unspoken word and the silent world. Speak your truth, leave what burdens you behind, and step back into the world renewed."_

Built with radical privacy and pure empathy.
