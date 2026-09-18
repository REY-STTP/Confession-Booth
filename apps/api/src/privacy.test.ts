// Privacy log/scan T1-050 (TESTING §7): respons publik + metrics + error tanpa identitas,
// log tanpa plaintext. Dijalankan dengan DB (lihat content.test.ts).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp } from './server.js';
import { metricsSnapshot } from './metrics.js';
import { assertPublicSafe } from '@booth/shared';

const app = await buildApp();
await app.ready();

describe('privacy: metrics + error tanpa identitas (T1-050)', () => {
  it('/api/metrics tanpa wallet/user/ip/session/notes', async () => {
    const secret = process.env.ADMIN_SECRET;
    const headers: Record<string, string> = secret ? { 'x-admin-secret': secret } : {};
    const res = await app.inject({ method: 'GET', url: '/api/metrics', headers });
    assert.equal(res.statusCode, 200);
    const leaks = assertPublicSafe(res.json());
    assert.deepEqual(leaks, []);
    assert.ok(!JSON.stringify(res.json()).includes('booth_refresh'));
  });
  it('/api/metrics menolak akses tanpa x-admin-secret (SEC-001 + P1 #6: min 32 char)', async () => {
    const prevSecret = process.env.ADMIN_SECRET;
    try {
      process.env.ADMIN_SECRET = 'temp-test-admin-secret-xyz-000000';
      const res = await app.inject({ method: 'GET', url: '/api/metrics' });
      assert.equal(res.statusCode, 403);

      const okRes = await app.inject({
        method: 'GET',
        url: '/api/metrics',
        headers: { 'x-admin-secret': 'temp-test-admin-secret-xyz-000000' },
      });
      assert.equal(okRes.statusCode, 200);

      // Secret pendek (<32) = tidak terkonfigurasi → 503 walau header cocok.
      process.env.ADMIN_SECRET = 'short';
      const weak = await app.inject({
        method: 'GET',
        url: '/api/metrics',
        headers: { 'x-admin-secret': 'short' },
      });
      assert.equal(weak.statusCode, 503);
    } finally {
      if (prevSecret !== undefined) {
        process.env.ADMIN_SECRET = prevSecret;
      } else {
        delete process.env.ADMIN_SECRET;
      }
    }
  });
  it('metricsSnapshot tidak memuat secret', () => {
    const s = JSON.stringify(metricsSnapshot());
    assert.ok(!/0x[a-fA-F0-9]{40}/.test(s));
    assert.ok(!/booth_refresh|signature|mnemonic/i.test(s));
  });
  it('P2 #15: /api/metrics?format=prom exposition valid + tetap butuh secret', async () => {
    const secret = process.env.ADMIN_SECRET;
    assert.ok(secret && secret.length >= 32);
    const denied = await app.inject({ method: 'GET', url: '/api/metrics?format=prom' });
    assert.equal(denied.statusCode, 403);
    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics?format=prom',
      headers: { 'x-admin-secret': secret },
    });
    assert.equal(res.statusCode, 200);
    assert.ok(res.headers['content-type']?.includes('text/plain'));
    const body = res.body as string;
    assert.ok(body.includes('booth_requests_total'));
    assert.ok(body.includes('booth_alert'));
    assert.ok(!/0x[a-fA-F0-9]{40}/.test(body));
  });
  it('404/400 tanpa stack trace', async () => {
    const nf = await app.inject({ method: 'GET', url: '/api/tidak-ada-e2e' });
    assert.equal(nf.statusCode, 404);
    assert.ok(!JSON.stringify(nf.json()).match(/stack|at .*node_modules/i));
    const bad = await app.inject({ method: 'GET', url: '/api/feed?cursor=!!!' });
    assert.equal(bad.statusCode, 400);
    assert.ok(!JSON.stringify(bad.json()).match(/stack/i));
  });
  it('source server tanpa log isi confession/signature mentah', () => {
    const src = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
    const hits = src
      .split('\n')
      .filter((l) => /console\.(log|error)/.test(l) && /content|signature|body_text/i.test(l));
    assert.deepEqual(hits, []);
  });
});
