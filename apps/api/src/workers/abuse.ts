// Worker abuse terjadwal T1H-005: sinkronkan moderation_score dari report terbuka.
// - kritis (THREAT/DOXXING/SEXUAL_EXPLOITATION): +25/report; lainnya +5; cap 100.
// - Auto-quarantine konservatif: >=3 report kritis OPEN/REVIEWING → QUARANTINED.
// - Tidak menyentuh HIDDEN/REMOVED (putusan manusia final) dan tidak restore.
// Bisa loop (`npm run worker:abuse`) atau tick sekali (test).
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { feedCacheInvalidate } from '../cache.js';

export interface AbuseReport {
  rescored: number;
  quarantined: number;
}

function rowsOf<T>(res: unknown): T[] {
  return (res as { rows: T[] }).rows ?? [];
}

export async function abuseTick(db = getDb()): Promise<AbuseReport> {
  const rescored = rowsOf<{ id: string }>(
    await db.execute(sql`
      UPDATE confessions c SET moderation_score = LEAST(100, sub.score)
      FROM (
        SELECT target_id,
          SUM(CASE WHEN reason_code IN ('THREAT', 'DOXXING', 'SEXUAL_EXPLOITATION') THEN 25 ELSE 5 END) AS score
        FROM reports
        WHERE target_type = 'CONFESSION' AND status IN ('OPEN', 'REVIEWING')
        GROUP BY 1
      ) sub
      WHERE c.id = sub.target_id AND c.status IN ('VISIBLE', 'QUARANTINED')
      RETURNING c.id
    `),
  );
  const quarantined = rowsOf<{ id: string }>(
    await db.execute(sql`
      UPDATE confessions c SET status = 'QUARANTINED'
      WHERE c.status = 'VISIBLE' AND c.id IN (
        SELECT target_id FROM reports
        WHERE target_type = 'CONFESSION' AND status IN ('OPEN', 'REVIEWING')
          AND reason_code IN ('THREAT', 'DOXXING', 'SEXUAL_EXPLOITATION')
        GROUP BY 1 HAVING count(*) >= 3
      )
      RETURNING c.id
    `),
  );
  if (quarantined.length > 0) feedCacheInvalidate();
  return { rescored: rescored.length, quarantined: quarantined.length };
}

const isMain = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('workers/abuse.js');
if (isMain) {
  const everyMs = Number(process.env.ABUSE_INTERVAL_MS ?? 5 * 60_000);
  console.log(`[abuse] loop tiap ${everyMs}ms`);
  const loop = async () => {
    try {
      const { trace } = await import('../trace.js');
      const r = await trace('abuse.tick', () => abuseTick());
      if (r.rescored > 0 || r.quarantined > 0) console.log(`[abuse] ${JSON.stringify(r)}`);
    } catch (e) {
      console.error('[abuse] tick error', e instanceof Error ? e.message : e);
    }
    setTimeout(loop, everyMs);
  };
  void loop();
}
