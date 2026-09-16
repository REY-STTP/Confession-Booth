# Confession Booth — Environment & Configuration

## Environments

### Local

- localhost frontend;
- local PostgreSQL;
- testnet chain;
- development storage.

### Staging

- public staging URL;
- separate database;
- testnet;
- staging wallet/key;
- production-like monitoring.

### Production

- production domain;
- production database;
- production storage;
- mainnet/testnet according to launch decision;
- restricted deployment credentials.

## Environment Variables

All environment variables are centralized in the monorepo root `.env` (copied from `.env.example`). `apps/api` runtime and maintenance scripts automatically resolve variables from the root workspace (`.env`) when running directly, via npm workspaces, or in Docker.

Example:

```env
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_CHAIN_ID=
NEXT_PUBLIC_CONTRACT_ADDRESS=

DATABASE_URL=

RPC_URL=
RPC_WS_URL=

SESSION_SECRET=

STORAGE_ENDPOINT=
STORAGE_API_KEY=
STORAGE_API_SECRET=

ADMIN_SECRET=
ADMIN_WALLETS=
MODERATOR_WALLETS=

# Publisher gas/nonce management (T1H-002)
PUBLISHER_MAX_FEE_PER_GAS=
PUBLISHER_MAX_PRIORITY_FEE_PER_GAS=
PUBLISHER_USE_NONCE_MANAGER=

# Body limit (T1-024)
BODY_LIMIT=102400

# Redis cache (T1H-002)
REDIS_URL=

# PoW difficulty (T1H-005)
POW_DIFFICULTY=14

# CAPTCHA provider (T1H-005)
CAPTCHA_SECRET=
```

Never expose server-only variables through `NEXT_PUBLIC_*`.

## Key Management

Deployment wallets must not be embedded in frontend code.

Prefer:

- hardware wallet;
- multisig;
- deployment-only signer;
- secret manager.

## Backup

Back up:

- PostgreSQL;
- configuration metadata;
- moderation records;
- deployment artifacts.

Do not treat blockchain as a backup for the entire application.
