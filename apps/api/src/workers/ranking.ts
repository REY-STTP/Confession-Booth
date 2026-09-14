// Worker ranking T1-030 + v2 T1H-002: skor time-decay → feed_scores + cache 60s.
// v2: anti-Sybil (engagement akun <7 hari didiskon 50% proporsional) +
// penalti report terbuka (×0.9/report, floor 0.1).
// - trending = f(reactions, whispers, unique, age, newShare, reports)
// - relatable = UNDERSTAND dominan + penalti report (Most Relatable resmi)
// - Anti-gaming lama tetap: unik per user (COUNT DISTINCT), cap 500/200/200.
// Bisa loop (`npm run worker:ranking`) atau tick sekali (test).
import { sql } from 'drizzle-orm';
import { trendingScoreV2, relatableScoreV2 } from '@booth/shared';
import { getDb } from '../db/client.js';

export interface RankingReport {
  processed: number;
  trending: number;
  relatable: number;
}

interface AggRow {
  id: string;
  created_at: Date;
  reactions: string;
  understand: string;
  whispers: string;
  unique_users: string;
  new_account_reactions: string;
  open_reports: string;
}

function rowsOf<T>(res: unknown): T[] {
  return (res as { rows: T[] }).rows ?? [];
}

/** Satu tick: agregasi VISIBLE → upsert feed_scores (trending + relatable). */
export async function rankingTick(db = getDb(), batch = 500): Promise<RankingReport> {
  const rows = rowsOf<AggRow>(
    await db.execute(sql`
      SELECT c.id, c.created_at,
        COALESCE(r.total, 0) AS reactions,
        COALESCE(r.understand, 0) AS understand,
        COALESCE(w.total, 0) AS whispers,
        COALESCE(u.users, 0) AS unique_users,
        COALESCE(nr.new_reactions, 0) AS new_account_reactions,
        COALESCE(rep.open_reports, 0) AS open_reports
      FROM confessions c
      LEFT JOIN (
        SELECT confession_id, count(*) AS total,
          count(*) FILTER (WHERE reaction_type = 'UNDERSTAND') AS understand
        FROM reactions GROUP BY 1
      ) r ON r.confession_id = c.id
      LEFT JOIN (
        SELECT confession_id, count(*) AS total FROM whispers
        WHERE status = 'VISIBLE' GROUP BY 1
      ) w ON w.confession_id = c.id
      LEFT JOIN (
        SELECT confession_id, count(DISTINCT user_id) AS users FROM (
          SELECT confession_id, user_id FROM reactions
          UNION
          SELECT confession_id, author_user_id AS user_id FROM whispers WHERE status = 'VISIBLE'
        ) s GROUP BY 1
      ) u ON u.confession_id = c.id
      LEFT JOIN (
        SELECT r.confession_id, count(*) AS new_reactions
        FROM reactions r JOIN users us ON us.id = r.user_id
        WHERE us.created_at > now() - interval '7 days'
        GROUP BY 1
      ) nr ON nr.confession_id = c.id
      LEFT JOIN (
        SELECT target_id, count(*) AS open_reports FROM reports
        WHERE target_type = 'CONFESSION' AND status IN ('OPEN', 'REVIEWING')
        GROUP BY 1
      ) rep ON rep.target_id = c.id
      WHERE c.status = 'VISIBLE'
      ORDER BY c.created_at DESC
      LIMIT ${batch}
    `),
  );

  const now = Date.now();
  let t = 0;
  let r = 0;
  for (const row of rows) {
    const ageHours = Math.max(0, (now - new Date(row.created_at).getTime()) / 3600_000);
    // Anti-gaming: cap engagement agar 1 akun spam 100 reaksi tidak mendominasi.
    // Unique constraint DB sudah 1 per (user,type) → max 5/user/confession; di sini cap total.
    const reactions = Math.min(Number(row.reactions), 500);
    const whispers = Math.min(Number(row.whispers), 200);
    const unique = Math.min(Number(row.unique_users), 200);
    const understand = Math.min(Number(row.understand), 500);
    const total = reactions + whispers;
    const engagement = reactions + whispers;
    const newShare = engagement > 0 ? Math.min(Number(row.new_account_reactions), 500) / engagement : 0;
    const openReports = Number(row.open_reports);
    const ts = trendingScoreV2({ reactions, whispers, uniqueEngagement: unique, ageHours, newAccountShare: newShare, openReports });
    const rs = relatableScoreV2({ understand, total, ageHours, openReports });
    await db.execute(sql`
      INSERT INTO feed_scores (confession_id, score_type, score, calculated_at)
      VALUES (${row.id}::uuid, 'trending', ${ts}, now()),
             (${row.id}::uuid, 'relatable', ${rs}, now())
      ON CONFLICT (confession_id, score_type)
      DO UPDATE SET score = EXCLUDED.score, calculated_at = now()
    `);
    t += 1;
    r += 1;
  }
  // Hapus skor milik konten non-VISIBLE agar tidak bocor via fallback.
  await db.execute(sql`
    DELETE FROM feed_scores fs USING confessions c
    WHERE fs.confession_id = c.id AND c.status <> 'VISIBLE'
  `);
  return { processed: rows.length, trending: t, relatable: r };
}

// Loop mode saat dijalankan langsung: node dist/workers/ranking.js
const isMain = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('workers/ranking.js');
if (isMain) {
  const everyMs = Number(process.env.RANKING_INTERVAL_MS ?? 60_000);
  console.log(`[ranking] loop tiap ${everyMs}ms`);
  const loop = async () => {
    try {
      const { trace } = await import('../trace.js');
      const rep = await trace('ranking.tick', () => rankingTick());
      if (rep.processed > 0) console.log(`[ranking] ${JSON.stringify(rep)}`);
    } catch (e) {
      console.error('[ranking] tick error', e instanceof Error ? e.message : e);
    }
    setTimeout(loop, everyMs);
  };
  void loop();
}
