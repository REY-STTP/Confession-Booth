import pg from 'pg';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();
const rootEnv = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '.env');
if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });

async function emptyConfessions() {
  const client = await pool.connect();
  try {
    console.log('Starting transaction to empty submitted confessions...');
    await client.query('BEGIN');

    const r = await client.query('DELETE FROM reactions');
    console.log(`Deleted ${r.rowCount} reactions.`);

    const w = await client.query('DELETE FROM whispers');
    console.log(`Deleted ${w.rowCount} whispers.`);

    const rep = await client.query(
      "DELETE FROM reports WHERE target_type IN ('CONFESSION', 'WHISPER')",
    );
    console.log(`Deleted ${rep.rowCount} reports.`);

    const mod = await client.query(
      "DELETE FROM moderation_actions WHERE target_type IN ('CONFESSION', 'WHISPER')",
    );
    console.log(`Deleted ${mod.rowCount} moderation actions.`);

    const pub = await client.query('DELETE FROM publications');
    console.log(`Deleted ${pub.rowCount} publications.`);

    const fs = await client.query('DELETE FROM feed_scores');
    console.log(`Deleted ${fs.rowCount} feed scores.`);

    const en = await client.query("DELETE FROM epoch_nullifiers WHERE scope = 'confess'");
    console.log(`Deleted ${en.rowCount} epoch nullifiers.`);

    const conf = await client.query('DELETE FROM confessions');
    console.log(`Deleted ${conf.rowCount} confessions.`);

    const co = await client.query(`
      DELETE FROM content_objects
      WHERE id NOT IN (SELECT content_object_id FROM confessions UNION SELECT content_object_id FROM whispers)
    `);
    console.log(`Deleted ${co.rowCount} unreferenced content objects.`);

    await client.query('COMMIT');
    console.log('SUCCESS: All submitted confessions and related rows have been emptied!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to empty confessions, rolled back:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

emptyConfessions();
