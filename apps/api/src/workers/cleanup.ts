// AUDIT SEC-004 / DB-003 / DB-004: Periodic cleanup worker for stale DB rows.
// Cleans up: expired auth nonces, expired sessions, old rate-limit buckets,
// expired idempotency keys, and consumed PoW solutions (P0 #4).
// Run: `node dist/workers/cleanup.js` or add to cron (every hour recommended).

import pg from 'pg';

async function cleanup() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[cleanup] DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString, max: 2 });

  try {
    console.log('[cleanup] Starting periodic cleanup…');

    // SEC-004: Delete expired auth nonces (past expiry)
    const nonces = await pool.query(
      `DELETE FROM auth_nonces WHERE expires_at < now() RETURNING id`,
    );
    console.log(`[cleanup] Deleted ${nonces.rowCount ?? 0} expired nonces`);

    // SEC-004: Delete expired sessions (keep 7 days past expiry for audit trail)
    const sessions = await pool.query(
      `DELETE FROM sessions WHERE expires_at < now() - interval '7 days' RETURNING id`,
    );
    console.log(`[cleanup] Deleted ${sessions.rowCount ?? 0} expired sessions`);

    // DB-003: Delete old rate_limit_buckets (older than 2 hours)
    const buckets = await pool.query(
      `DELETE FROM rate_limit_buckets WHERE window_start < now() - interval '2 hours' RETURNING id`,
    );
    console.log(`[cleanup] Deleted ${buckets.rowCount ?? 0} expired rate-limit buckets`);

    // DB-004: Delete expired idempotency keys
    const idem = await pool.query(
      `DELETE FROM idempotency_keys WHERE expires_at < now() RETURNING key`,
    );
    console.log(`[cleanup] Deleted ${idem.rowCount ?? 0} expired idempotency keys`);

    // P0 #4: Delete consumed/expired PoW solutions (single-use records, TTL 10 mnt)
    const pow = await pool.query(
      `DELETE FROM pow_solutions WHERE expires_at < now() RETURNING solution_hash`,
    );
    console.log(`[cleanup] Deleted ${pow.rowCount ?? 0} expired PoW solutions`);

    console.log('[cleanup] Done.');
  } catch (err) {
    console.error('[cleanup] Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanup();
