// Worker chain-indexer T1-021: rekonsiliasi event ConfessionPublished → DB.
// database record ↔ transaction ↔ event ↔ content hash (ARCHITECTURE §9).
// - Cursor blok persisten di indexer_state (tahan restart).
// - Mismatch hash hanya dicatat (mismatched), TIDAK menimpa data DB.
// - Bisa loop (`npm run worker:indexer`) atau tick sekali (test).

import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { config } from '../config.js';
import * as schema from '../db/schema.js';
import { PUBLISHED_EVENT, eqBytes32, publicClient, type ChainEnv } from '../chain/registry.js';

export interface IndexerReport {
  fromBlock: number;
  toBlock: number;
  events: number;
  matched: number;
  mismatched: number;
}

function rowsOf<T>(res: unknown): T[] {
  return (res as { rows: T[] }).rows ?? [];
}

const CURSOR_NAME = 'confession-events';
const LOOKBACK = 2000n;
const MAX_LOOKBACK_LIMIT = 50000n; // limit RPC block range
const MAX_BLOCK_CHUNK = 2000n; // batas maksimum blok yang ditanyakan per call RPC agar aman di semua provider
const MISMATCH_ALERT_THRESHOLD = 5; // alert jika mismatch > 5 per tick
// P2 #14: jeda finality — cursor tak maju melewati blok yang belum final (anti reorg).
const FINALITY_LAG = 2n;

export async function indexerTick(db = getDb(), env?: ChainEnv): Promise<IndexerReport> {
  const E: ChainEnv = env ?? {
    rpcUrl: process.env.RPC_URL ?? '',
    contractAddress: config.contractAddress as never,
    chainId: config.chainId,
  };
  if (!E.rpcUrl) {
    console.warn('[indexer] RPC_URL belum di-set — lewati.');
    return { fromBlock: 0, toBlock: 0, events: 0, matched: 0, mismatched: 0 };
  }
  const pub = publicClient(E);
  const latest = await pub.getBlockNumber();

  const cursorName = E.chainId === 31337 ? CURSOR_NAME : `${CURSOR_NAME}-${E.chainId}`;
  const cur = rowsOf<{ last_block: string }>(
    await db.execute(sql`SELECT last_block FROM indexer_state WHERE name = ${cursorName} LIMIT 1`),
  )[0];
  let from = cur ? BigInt(cur.last_block) + 1n : latest - LOOKBACK;
  if (from < 0n) from = 0n;

  // Proteksi jika cursor terlalu jauh di masa lalu (misal akibat database shared dengan test / reset lokal)
  if (latest - from > MAX_LOOKBACK_LIMIT) {
    console.warn(
      `[indexer] Cursor (${from}) tertinggal >50k blok dari latest (${latest}). Fast-forward ke ${latest - LOOKBACK}`,
    );
    from = latest - LOOKBACK;
  }

  if (from > latest) from = latest + 1n; // belum ada blok baru

  // P2 #14: jangan kejar ujung rantai — sisakan lag finality.
  // Chain lokal (31337, automine, tanpa reorg) dikecualikan agar tick test
  // yang baru publish langsung terlihat.
  const finalityLag = E.chainId === 31337 ? 0n : FINALITY_LAG;
  const safeLatest = latest > finalityLag ? latest - finalityLag : 0n;

  // Batasi blok per-tick dengan MAX_BLOCK_CHUNK
  const targetTo = from + MAX_BLOCK_CHUNK < safeLatest ? from + MAX_BLOCK_CHUNK : safeLatest;

  const report: IndexerReport = {
    fromBlock: Number(from),
    toBlock: Number(targetTo),
    events: 0,
    matched: 0,
    mismatched: 0,
  };
  let mismatchCount = 0;
  if (from <= targetTo) {
    const logs = await pub.getLogs({
      address: E.contractAddress,
      event: PUBLISHED_EVENT,
      fromBlock: from,
      toBlock: targetTo,
    });
    report.events = logs.length;
    const expectedAddress = E.contractAddress.toLowerCase();
    for (const log of logs) {
      // P0 #5: pastikan log berasal dari kontrak yang diharapkan (anti event asing),
      // lalu verifikasi publisher bila tersedia.
      if (log.address.toLowerCase() !== expectedAddress) continue;
      const a = log.args as unknown as {
        confessionId: string;
        contentHash: string;
        publisher?: string;
      };
      if (!a?.confessionId) continue;
      const found = rowsOf<{ id: string; content_hash: string; status: string }>(
        await db.execute(sql`
          SELECT p.id, p.content_hash, p.status FROM publications p
          WHERE p.onchain_confession_id = ${a.confessionId} LIMIT 1
        `),
      )[0];
      if (!found) continue; // event asing (bukan dari booth ini) — abaikan
      if (!eqBytes32(found.content_hash, a.contentHash)) {
        report.mismatched += 1;
        mismatchCount++;
        console.warn(`[indexer] hash mismatch ${a.confessionId}`);
        // P2 #14: persist mismatch via drizzle (gagal persist = error terlihat,
        // bukan ditelan). Dedup: satu baris unresolved per (confession, block).
        const dup = await db
          .select({ id: schema.indexerMismatches.id })
          .from(schema.indexerMismatches)
          .where(
            and(
              eq(schema.indexerMismatches.confessionId, a.confessionId),
              eq(schema.indexerMismatches.blockNumber, Number(log.blockNumber)),
              eq(schema.indexerMismatches.resolved, false),
            ),
          )
          .limit(1);
        if (dup.length === 0) {
          await db.insert(schema.indexerMismatches).values({
            confessionId: a.confessionId,
            onchainHash: a.contentHash,
            dbHash: found.content_hash,
            blockNumber: Number(log.blockNumber),
            txHash: log.transactionHash ?? '',
          });
        }
        continue;
      }
      if (found.status !== 'CONFIRMED') {
        await db.execute(sql`
          UPDATE publications SET status = 'CONFIRMED', transaction_hash = ${log.transactionHash},
            block_number = ${Number(log.blockNumber)}, confirmed_at = now(), failure_reason = NULL
          WHERE id = ${found.id}::uuid
        `);
      }
      report.matched += 1;
      // T1H-002: Per-event cursor update untuk safety - update cursor per event
      await db.execute(sql`
        INSERT INTO indexer_state (name, last_block) VALUES (${cursorName}, ${Number(log.blockNumber)})
        ON CONFLICT (name) DO UPDATE SET last_block = EXCLUDED.last_block, updated_at = now()
      `);
    }
    // Alert jika mismatch melebihi threshold
    if (mismatchCount > MISMATCH_ALERT_THRESHOLD) {
      console.error(`[INDEXER ALERT] ${mismatchCount} hash mismatch(es) detected in this tick`);
      // TODO: integrate with alerting system (Slack, Discord, PagerDuty, etc.)
    }
  }

  // Final cursor update memastikan cursor maju melewati blok-blok tanpa event
  if (from <= targetTo) {
    await db.execute(sql`
      INSERT INTO indexer_state (name, last_block) VALUES (${cursorName}, ${Number(targetTo)})
      ON CONFLICT (name) DO UPDATE SET last_block = EXCLUDED.last_block, updated_at = now()
    `);
  }
  return report;
}

const isMain = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('workers/indexer.js');
if (isMain) {
  const everyMs = Number(process.env.INDEXER_INTERVAL_MS ?? 15_000);
  console.log(`[indexer] loop tiap ${everyMs}ms`);
  const loop = async () => {
    try {
      const r = await indexerTick();
      if (r.events > 0) console.log(`[indexer] ${JSON.stringify(r)}`);
    } catch (e) {
      console.error('[indexer] tick error', e instanceof Error ? e.message : e);
    }
    setTimeout(loop, everyMs);
  };
  void loop();
}
