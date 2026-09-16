// Worker chain-indexer T1-021: rekonsiliasi event ConfessionPublished → DB.
// database record ↔ transaction ↔ event ↔ content hash (ARCHITECTURE §9).
// - Cursor blok persisten di indexer_state (tahan restart).
// - Mismatch hash hanya dicatat (mismatched), TIDAK menimpa data DB.
// - Bisa loop (`npm run worker:indexer`) atau tick sekali (test).

import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { config } from '../config.js';
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

export async function indexerTick(db = getDb(), env?: ChainEnv): Promise<IndexerReport> {
  const E: ChainEnv = env ?? {
    rpcUrl: process.env.RPC_URL ?? '',
    contractAddress: (config.contractAddress ||
      '0x0000000000000000000000000000000000000000') as never,
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

  // Batasi blok per-tick dengan MAX_BLOCK_CHUNK
  const targetTo = from + MAX_BLOCK_CHUNK < latest ? from + MAX_BLOCK_CHUNK : latest;

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
    for (const log of logs) {
      const a = log.args as unknown as { confessionId: string; contentHash: string };
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
        // Persist mismatch untuk investigasi
        await db
          .execute(
            sql`
          INSERT INTO indexer_mismatches (confession_id, onchain_hash, db_hash, block_number, tx_hash, detected_at)
          VALUES (${a.confessionId}, ${a.contentHash}, ${found.content_hash}, ${Number(log.blockNumber)}, ${log.transactionHash}, now())
          ON CONFLICT DO NOTHING
        `,
          )
          .catch(() => {}); // ignore if table doesn't exist
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
