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
