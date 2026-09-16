// Worker publication-publisher T1-021.
// PENDING_CHAIN/FAILED → kirim tx publish() → SUBMITTED → CONFIRMED.
// - Hanya hash + ID + CID kosong + version yang on-chain (hash-only, SMART_CONTRACT §7).
// - Retry backoff 5 mnt untuk FAILED; attempts tercatat.
// - Bisa dijalankan berkala: `npm run worker:publisher` (loop) atau tick sekali (test).

import type { Hex } from 'viem';
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { config } from '../config.js';
import {
  REGISTRY_ABI,
  publicClient,
  toBytes32,
  walletClient,
  type ChainEnv,
} from '../chain/registry.js';

export interface PublisherEnv extends ChainEnv {
  publisherKey: Hex;
  batch?: number;
  /** Timeout receipt per tx (default 60s; test memakai nilai kecil). */
  receiptTimeoutMs?: number;
  /** Konfirmasi blok yang ditunggu (default 3 untuk reorg safety; 1 pada local testnet / dev). */
  confirmations?: number;
  /** Gas price config untuk EIP-1559 */
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  /** Nonce management: manual nonce tracking untuk menghindari stuck tx */
  useNonceManager?: boolean;
}

export interface PublisherReport {
  processed: number;
  confirmed: number;
  failed: number;
}

interface PendingRow {
  id: string;
  onchain_confession_id: string;
  content_hash: string;
  transaction_hash: string | null;
  attempts: number;
}

function rowsOf<T>(res: unknown): T[] {
  return (res as { rows: T[] }).rows ?? [];
}

/** Satu tick: proses batch publikasi tertunda.
 *  `filter.onchainIds` membatasi scope (dipakai test agar paralel aman). */
export async function publisherTick(
  db = getDb(),
  env?: PublisherEnv,
  filter?: { onchainIds?: string[] },
): Promise<PublisherReport> {
  const E: PublisherEnv = env ?? {
    rpcUrl: process.env.RPC_URL ?? '',
    contractAddress: (config.contractAddress ||
      '0x0000000000000000000000000000000000000000') as Hex,
    chainId: config.chainId,
    publisherKey: (process.env.PUBLISHER_KEY ?? '0x') as Hex,
    // Gas/nonce config dari config.ts (env vars)
    maxFeePerGas: config.publisherMaxFeePerGas,
    maxPriorityFeePerGas: config.publisherMaxPriorityFeePerGas,
    useNonceManager: config.publisherUseNonceManager,
  };
  if (!E.rpcUrl || !E.publisherKey || E.publisherKey === '0x') {
    console.warn('[publisher] RPC_URL/PUBLISHER_KEY belum di-set — lewati (tetap PENDING_CHAIN).');
    return { processed: 0, confirmed: 0, failed: 0 };
  }
  const batch = E.batch ?? 10;
  const scope =
    filter?.onchainIds && filter.onchainIds.length > 0
      ? sql`AND p.onchain_confession_id IN (${sql.join(
          filter.onchainIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;
  const pending = rowsOf<PendingRow>(
    await db.execute(sql`
      SELECT p.id, p.onchain_confession_id, p.content_hash, p.transaction_hash, p.attempts
      FROM publications p
      WHERE p.status IN ('PENDING_CHAIN', 'FAILED')
        AND (p.submitted_at IS NULL OR p.submitted_at < now() - interval '5 minutes')
        ${scope}
      ORDER BY p.submitted_at NULLS FIRST LIMIT ${batch}
    `),
  );

  const report: PublisherReport = { processed: pending.length, confirmed: 0, failed: 0 };
  if (pending.length === 0) return report;

  const pub = publicClient(E);
  const wallet = walletClient(E, E.publisherKey);

  // T1H-002: Nonce manager untuk menghindari stuck tx
  let currentNonce: number | null = null;
  async function getNextNonce(): Promise<number> {
    if (currentNonce === null) {
      currentNonce = await pub.getTransactionCount({ address: wallet.account.address });
    }
    return currentNonce++;
  }

  for (const p of pending) {
    try {
      let hash = p.transaction_hash as Hex | null;
      if (!hash) {
        const nonce = E.useNonceManager ? await getNextNonce() : undefined;
        const gasPriceConfig =
          E.maxFeePerGas || E.maxPriorityFeePerGas
            ? {
                maxFeePerGas: E.maxFeePerGas,
                maxPriorityFeePerGas: E.maxPriorityFeePerGas,
              }
            : undefined;

        hash = await wallet.writeContract({
          address: E.contractAddress,
          abi: REGISTRY_ABI,
          functionName: 'publish',
          args: [toBytes32(p.onchain_confession_id), toBytes32(p.content_hash), '', 1],
          nonce,
          ...gasPriceConfig,
        });
        await db.execute(sql`
          UPDATE publications SET status = 'SUBMITTED', transaction_hash = ${hash},
            submitted_at = now(), attempts = attempts + 1, failure_reason = NULL
          WHERE id = ${p.id}::uuid
        `);
      }
      const confirmations = E.confirmations ?? (E.chainId === 31337 ? 1 : 3);
      const receipt = await pub.waitForTransactionReceipt({
        hash,
        confirmations, // T1H-002: 3 confirmations untuk reorg safety (1 pada local testnet 31337)
        timeout: E.receiptTimeoutMs ?? 60_000,
      });
      // T1H-002: Verify transaction still valid after confirmations (reorg check)
      const verified = await pub.getTransactionReceipt({ hash });
      if (!verified || verified.blockNumber !== receipt.blockNumber) {
        throw new Error('Transaction reorged or replaced');
      }
      await db.execute(sql`
        UPDATE publications SET status = 'CONFIRMED', block_number = ${Number(receipt.blockNumber)},
          confirmed_at = now(), failure_reason = NULL
        WHERE id = ${p.id}::uuid
      `);
      report.confirmed += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 500) : String(e).slice(0, 500);
      await db.execute(sql`
        UPDATE publications SET status = 'FAILED', submitted_at = now(),
          attempts = attempts + 1, failure_reason = ${msg}
        WHERE id = ${p.id}::uuid
      `);
      report.failed += 1;
    }
  }
  return report;
}

// Loop mode saat dijalankan langsung: node dist/workers/publisher.js
const isMain = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('workers/publisher.js');
if (isMain) {
  const everyMs = Number(process.env.PUBLISHER_INTERVAL_MS ?? 15_000);
  console.log(`[publisher] loop tiap ${everyMs}ms`);
  const loop = async () => {
    try {
      const r = await publisherTick();
      if (r.processed > 0) console.log(`[publisher] ${JSON.stringify(r)}`);
    } catch (e) {
      console.error('[publisher] tick error', e instanceof Error ? e.message : e);
    }
    setTimeout(loop, everyMs);
  };
  void loop();
}
