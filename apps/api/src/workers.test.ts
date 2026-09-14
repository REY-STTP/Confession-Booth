// Integrasi 1C (TESTING §3): API → PG → chain lokal → publisher → indexer.
// Membutuhkan: node hardhat lokal (di-spawn otomatis) + DB migrasi.
// - publisher: PENDING_CHAIN → tx nyata → CONFIRMED + tx_hash + block.
// - indexer: event → rekonsiliasi, cursor persisten, mismatch tercatat tanpa timpa data.
// - storage: ganti adapter → bentuk record sama, provider/CID ikut adapter.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePrivateKey, mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import { toHex } from 'viem';
import { sql } from 'drizzle-orm';
import { buildApp } from './server.js';
import { getDb } from './db/client.js';
import { publisherTick } from './workers/publisher.js';
import { indexerTick } from './workers/indexer.js';
import { DbInlineAdapter, defaultStorage, getStorage, setStorage, type StorageAdapter } from './storage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CONTRACTS = join(ROOT, 'contracts');
const RPC = 'http://127.0.0.1:8545';
const CHAIN_ID = 31337;
// Akun dev #0 bawaan hardhat (mnemonic standar) — HANYA untuk test lokal.
const PUBLISHER_KEY = toHex(
  mnemonicToAccount('test test test test test test test test test test test junk').getHdKey().privateKey!,
);

const app = await buildApp();
const db = getDb();
let node: ChildProcess | null = null;
let contractAddress = '';

async function rpcReady(tries = 60): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      });
      if (r.ok) return true;
    } catch {
      /* belum siap */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

let ipN = 100;
const ip = () => `10.40.0.${(ipN++ % 100) + 1}`;
const rnd = (p: string) => `${p} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

async function loginAndPublish(content: string) {
  const acc = privateKeyToAccount(generatePrivateKey());
  const myIp = ip();
  const nRes = await app.inject({ method: 'GET', url: `/api/auth/nonce?address=${acc.address}`, remoteAddress: myIp });
  assert.equal(nRes.statusCode, 200);
  const { nonce, message } = nRes.json();
  const sig = await acc.signMessage({ message });
  const vRes = await app.inject({
    method: 'POST', url: '/api/auth/verify', remoteAddress: myIp,
    payload: { address: acc.address, signature: sig, nonce },
  });
  assert.equal(vRes.statusCode, 200);
  const token = vRes.json().accessToken as string;
  const pRes = await app.inject({
    method: 'POST', url: '/api/confessions', remoteAddress: ip(),
    headers: { authorization: `Bearer ${token}` },
    payload: { category: 'deep', content },
  });
  assert.equal(pRes.statusCode, 201);
  return pRes.json().publicId as string;
}

function rowsOf<T>(res: unknown): T[] {
  return (res as { rows: T[] }).rows ?? [];
}

async function onchainIdOf(publicId: string): Promise<string> {
  const r = rowsOf<{ onchain_confession_id: string }>(
    await db.execute(sql`SELECT p.onchain_confession_id FROM publications p JOIN confessions c ON c.id = p.confession_id WHERE c.public_id = ${publicId}`),
  )[0];
  return r.onchain_confession_id;
}

before(async () => {
  await app.ready();
  // Bersihkan sisa run sebelumnya (hanya baris lebih tua dari run ini — aman paralel).
  const t0 = new Date().toISOString();
  await db.execute(sql`DELETE FROM reports WHERE created_at < ${t0}::timestamptz`);
  await db.execute(sql`DELETE FROM moderation_actions WHERE created_at < ${t0}::timestamptz`);
  await db.execute(sql`DELETE FROM confessions WHERE created_at < ${t0}::timestamptz`);
  // Cursor lama menunjuk blok chain yang sudah mati (node lokal restart tiap run).
  await db.execute(sql`DELETE FROM indexer_state WHERE name = 'confession-events'`);
  node = spawn('npx', ['hardhat', 'node', '--port', '8545'], {
    cwd: CONTRACTS,
    stdio: 'ignore',
    detached: false,
    shell: true,
  });
  assert.ok(await rpcReady(), 'hardhat node tidak siap');
  const dep = spawnSync('npx', ['hardhat', 'run', 'scripts/deploy.ts', '--network', 'localhost'], {
    cwd: CONTRACTS,
    encoding: 'utf8',
    shell: true,
  });
  assert.equal(dep.status, 0, dep.stderr?.slice(-2000));
  const deployed = JSON.parse(readFileSync(join(CONTRACTS, 'deployed', 'localhost.json'), 'utf8'));
  contractAddress = deployed.address;
  assert.match(contractAddress, /^0x[0-9a-fA-F]{40}$/);
});

after(async () => {
  // shell:true membungkus proses (Windows) — bunuh sepohon agar node tidak yatim.
  if (node?.pid) {
    try {
      if (process.platform === 'win32') {
        const { execSync } = await import('node:child_process');
        execSync(`taskkill /PID ${node.pid} /T /F`);
      } else {
        node.kill('SIGKILL');
      }
    } catch {
      /* sudah mati */
    }
    node = null;
  }
  setStorage(defaultStorage);
  await app.close().catch(() => {});
});

describe('publisher worker (T1-021)', () => {
  it('PENDING_CHAIN → tx nyata → CONFIRMED + hash + blok', async () => {
    const pid = await loginAndPublish(rnd('rantai nyata'));
    const before = rowsOf<{ status: string }>(
      await db.execute(sql`SELECT status FROM publications WHERE confession_id = (SELECT id FROM confessions WHERE public_id = ${pid})`),
    )[0];
    assert.equal(before.status, 'PENDING_CHAIN');

    const rep = await publisherTick(db, {
      rpcUrl: RPC,
      contractAddress: contractAddress as `0x${string}`,
      chainId: CHAIN_ID,
      publisherKey: PUBLISHER_KEY,
      receiptTimeoutMs: 20_000,
    }, { onchainIds: [await onchainIdOf(pid)] });
    assert.equal(rep.processed, 1);
    assert.equal(rep.failed, 0);

    const after = rowsOf<{ status: string; transaction_hash: string; block_number: number; attempts: number }>(
      await db.execute(sql`SELECT status, transaction_hash, block_number, attempts FROM publications WHERE confession_id = (SELECT id FROM confessions WHERE public_id = ${pid})`),
    )[0];
    assert.equal(after.status, 'CONFIRMED');
    assert.match(after.transaction_hash, /^0x[0-9a-f]{64}$/);
    assert.ok(Number(after.block_number) > 0);
    assert.ok(Number(after.attempts) >= 1);

    const proof = await app.inject({ method: 'GET', url: `/api/confessions/${pid}/proof` });
    assert.equal(proof.json().status, 'CONFIRMED');
    assert.equal(proof.json().txHash, after.transaction_hash);
  });

  it('tanpa RPC_URL/PUBLISHER_KEY → aman dilewati (tetap PENDING)', async () => {
    const rep = await publisherTick(db, {
      rpcUrl: '',
      contractAddress: contractAddress as `0x${string}`,
      chainId: CHAIN_ID,
      publisherKey: '0x' as `0x${string}`,
    });
    assert.deepEqual(rep, { processed: 0, confirmed: 0, failed: 0 });
  });
});

describe('indexer worker (T1-021)', () => {
  it('event → matched; tick ulang idempoten; cursor tersimpan', async () => {
    const r1 = await indexerTick(db, { rpcUrl: RPC, contractAddress: contractAddress as `0x${string}`, chainId: CHAIN_ID });
    assert.ok(r1.events >= 1);
    assert.ok(r1.matched >= 1);
    assert.equal(r1.mismatched, 0);

    const cur = rowsOf<{ last_block: string }>(await db.execute(sql`SELECT last_block FROM indexer_state WHERE name = 'confession-events'`))[0];
    assert.ok(cur && Number(cur.last_block) > 0);

    const r2 = await indexerTick(db, { rpcUrl: RPC, contractAddress: contractAddress as `0x${string}`, chainId: CHAIN_ID });
    assert.equal(r2.matched, 0);
    assert.equal(r2.mismatched, 0);
  });

  it('hash mismatch dicatat tanpa menimpa data', async () => {
    const pid = await loginAndPublish(rnd('mismatch'));
    await publisherTick(db, {
      rpcUrl: RPC, contractAddress: contractAddress as `0x${string}`,
      chainId: CHAIN_ID, publisherKey: PUBLISHER_KEY, receiptTimeoutMs: 20_000,
    }, { onchainIds: [await onchainIdOf(pid)] });
    const pub = rowsOf<{ id: string; content_hash: string }>(
      await db.execute(sql`SELECT id, content_hash FROM publications WHERE confession_id = (SELECT id FROM confessions WHERE public_id = ${pid})`),
    )[0];
    // Rusak hash di DB, putar ulang cursor ke 10 blok lalu.
    await db.execute(sql`UPDATE publications SET content_hash = '00' WHERE id = ${pub.id}::uuid`);
    await db.execute(sql`UPDATE indexer_state SET last_block = last_block - 10 WHERE name = 'confession-events'`);
    const r = await indexerTick(db, { rpcUrl: RPC, contractAddress: contractAddress as `0x${string}`, chainId: CHAIN_ID });
    assert.ok(r.mismatched >= 1);
    const kept = rowsOf<{ content_hash: string }>(await db.execute(sql`SELECT content_hash FROM publications WHERE id = ${pub.id}::uuid`))[0];
    assert.equal(kept.content_hash, '00'); // tidak ditimpa indexer
    await db.execute(sql`UPDATE publications SET content_hash = ${pub.content_hash} WHERE id = ${pub.id}::uuid`);
  });
});

describe('storage adapter (T1-022)', () => {
  it('DbInlineAdapter: provider db:inline, cid null', async () => {
    const ref = await new DbInlineAdapter().put('abc', 'isi');
    assert.deepEqual(ref, { provider: 'db:inline', cid: null });
    assert.equal(getStorage().name, 'db:inline');
  });

  it('ganti adapter → bentuk record sama, ref ikut adapter', async () => {
    class FakeIpfsAdapter implements StorageAdapter {
      readonly name = 'ipfs:fake';
      async put(contentHash: string) {
        return { provider: 'ipfs:fake', cid: `bafkfake${contentHash.slice(0, 8)}` };
      }
    }
    setStorage(new FakeIpfsAdapter());
    try {
      const pid = await loginAndPublish(rnd('adapter swap'));
      const row = rowsOf<{ storage_provider: string; storage_cid: string }>(
        await db.execute(sql`SELECT co.storage_provider, co.storage_cid FROM content_objects co JOIN confessions c ON c.content_object_id = co.id WHERE c.public_id = ${pid}`),
      )[0];
      assert.equal(row.storage_provider, 'ipfs:fake');
      assert.ok(row.storage_cid.startsWith('bafkfake'));
      // Bentuk publik tidak berubah oleh adapter.
      const detail = await app.inject({ method: 'GET', url: `/api/confessions/${pid}` });
      assert.equal(detail.statusCode, 200);
      assert.match(detail.json().author.displayName, /^Anonymous #\d{4}$/);
    } finally {
      setStorage(defaultStorage);
    }
  });
});
