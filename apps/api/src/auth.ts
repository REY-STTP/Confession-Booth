// Auth wallet T1-002: nonce challenge gaya SIWE/EIP-4361 + sesi token.
// - Challenge: domain-bound, random, kedaluwarsa 5 mnt, sekali pakai (replay protection).
// - Verifikasi signature server-side via viem (ECDSA murni, tanpa RPC untuk EOA).
// - Token sesi: 32 byte acak, disimpan sebagai sha256 (bukan mentah).
// - Raw signature/nonce TIDAK disimpan lebih lama dari operasional (nonce hash saja).

import { randomBytes, createHash } from 'node:crypto';
import { and, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { getAddress, isAddress, verifyMessage } from 'viem';
import * as schema from './db/schema.js';
import { config } from './config.js';

export class AuthError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status = 401) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function sha256hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

export interface ChallengeParams {
  address: string;
  chainId?: number;
  domain?: string;
  now?: number;
}

export function buildMessage(p: {
  domain: string;
  address: string;
  nonce: string;
  chainId: number;
  issuedAt: string;
  expiresAt: string;
}): string {
  return (
    `${config.appName} sign-in\n` +
    `\n` +
    `Sign in to ${p.domain} to enter the booth. This signature proves you own this wallet. It costs nothing.\n` +
    `\n` +
    `Address: ${p.address}\n` +
    `Nonce: ${p.nonce}\n` +
    `Chain ID: ${p.chainId}\n` +
    `Issued At: ${p.issuedAt}\n` +
    `Expires At: ${p.expiresAt}`
  );
}

/** Terbitkan challenge baru. Address dinormalisasi lowercase (SCHEMA §3).
 *  T1-023: address wajib, chainId wajib valid (integer positif, allowlist = config.chainId). */
export async function issueNonce(db: NodePgDatabase<typeof schema>, p: ChallengeParams) {
  if (!p.address || !isAddress(p.address))
    throw new AuthError('INVALID_ADDRESS', 'Invalid wallet address.', 400);
  const address = p.address.toLowerCase();
  const checksum = getAddress(address);
  const domain = p.domain ?? config.appDomain;
  const chainId = p.chainId ?? config.chainId;
  if (
    !Number.isInteger(chainId) ||
    (chainId as number) <= 0 ||
    !Number.isSafeInteger(chainId as number)
  ) {
    throw new AuthError('INVALID_CHAIN', 'Invalid chain id.', 400);
  }
  if ((chainId as number) !== config.chainId) {
    throw new AuthError('INVALID_CHAIN', 'Unsupported chain id.', 400);
  }
  const now = p.now ?? Date.now();
  const nonce = randomBytes(24).toString('hex');
  const issuedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + config.nonceTtlMs).toISOString();
  const message = buildMessage({ domain, address: checksum, nonce, chainId, issuedAt, expiresAt });

  await db.insert(schema.authNonces).values({
    nonceHash: sha256hex(nonce),
    domain,
    address,
    chainId,
    issuedAt: new Date(now),
    expiresAt: new Date(expiresAt),
  });

  return { nonce, message, expiresAt };
}

export interface VerifiedSession {
  user: { id: string; walletAddress: string; role: 'USER' | 'MODERATOR' | 'ADMIN'; status: string };
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
}

/** Verifikasi signature + konsumsi nonce sekali pakai + terbitkan sesi. */
export async function verifyAndLogin(
  db: NodePgDatabase<typeof schema>,
  p: { address: string; signature: string; nonce: string; now?: number },
): Promise<VerifiedSession> {
  if (!isAddress(p.address)) throw new AuthError('INVALID_ADDRESS', 'Invalid wallet address.', 400);
  const address = p.address.toLowerCase();
  const now = p.now ?? Date.now();

  const rows = await db
    .select()
    .from(schema.authNonces)
    .where(eq(schema.authNonces.nonceHash, sha256hex(p.nonce)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new AuthError('UNKNOWN_NONCE', 'Unknown or invalid challenge.', 401);
  if (row.consumedAt) throw new AuthError('NONCE_REUSED', 'Challenge already used.', 401);
  if (row.expiresAt.getTime() <= now)
    throw new AuthError('NONCE_EXPIRED', 'Challenge expired.', 401);
  if (row.domain !== config.appDomain)
    throw new AuthError('WRONG_DOMAIN', 'Challenge domain mismatch.', 401);
  if (row.address !== address)
    throw new AuthError('ADDRESS_MISMATCH', 'Challenge address mismatch.', 401);
  if (row.chainId !== config.chainId)
    throw new AuthError('INVALID_CHAIN', 'Challenge chain mismatch.', 401);

  const message = buildMessage({
    domain: row.domain,
    address: getAddress(address),
    nonce: p.nonce,
    chainId: row.chainId,
    issuedAt: row.issuedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  });

  let valid = false;
  try {
    valid = await verifyMessage({
      address: getAddress(address),
      message,
      signature: p.signature as `0x${string}`,
    });
  } catch {
    valid = false;
  }
  if (!valid) throw new AuthError('BAD_SIGNATURE', 'Signature verification failed.', 401);

  const accessToken = randomBytes(32).toString('hex');
  const refreshToken = randomBytes(32).toString('hex');
  const accessExpiresAt = new Date(now + config.accessTtlMs);
  const refreshExpiresAt = new Date(now + config.refreshTtlMs);

  const user = await db.transaction(async (tx) => {
    await tx
      .update(schema.authNonces)
      .set({ consumedAt: new Date(now) })
      .where(eq(schema.authNonces.id, row.id));

    const found = await tx
      .select()
      .from(schema.users)
      .where(eq(schema.users.walletAddress, address))
      .limit(1);
    let u = found[0];

    // Bootstrap/persistent roles via environment variables (ADMIN_WALLETS, MODERATOR_WALLETS)
    const adminWallets = (process.env.ADMIN_WALLETS ?? '')
      .toLowerCase()
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean);
    const modWallets = (process.env.MODERATOR_WALLETS ?? '')
      .toLowerCase()
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean);

    const envRole: 'ADMIN' | 'MODERATOR' | null = adminWallets.includes(address)
      ? 'ADMIN'
      : modWallets.includes(address)
        ? 'MODERATOR'
        : null;

    if (!u) {
      // First login: set wallet_first_tx_at to now (wallet age = first on-chain interaction)
      const ins = await tx
        .insert(schema.users)
        .values({
          walletAddress: address,
          chainId: row.chainId,
          lastSeenAt: new Date(now),
          walletFirstTxAt: new Date(now),
          status: 'ACTIVE',
          ...(envRole ? { role: envRole } : {}),
        })
        .returning();
      u = ins[0];
    } else {
      if (u.status === 'BANNED') {
        const err = new Error('Akun ini telah diblokir.');
        (err as unknown as { statusCode: number }).statusCode = 403;
        throw err;
      }
      // Update lastSeenAt and chainId; only set wallet_first_tx_at if null (first verified login)
      // JANGAN reset status ke 'ACTIVE' agar status BANNED/RESTRICTED tidak hilang
      const upd = await tx
        .update(schema.users)
        .set({
          lastSeenAt: new Date(now),
          chainId: row.chainId,
          ...(envRole ? { role: envRole } : {}),
          ...(u.walletFirstTxAt === null ? { walletFirstTxAt: new Date(now) } : {}),
        })
        .where(eq(schema.users.id, u.id))
        .returning();
      u = upd[0];
    }
    await tx.insert(schema.sessions).values([
      { userId: u.id, tokenHash: sha256hex(accessToken), expiresAt: accessExpiresAt },
      { userId: u.id, tokenHash: sha256hex(refreshToken), expiresAt: refreshExpiresAt },
    ]);
    return u;
  });

  return {
    user: { id: user.id, walletAddress: user.walletAddress, role: user.role, status: user.status },
    accessToken,
    accessExpiresAt: accessExpiresAt.toISOString(),
    refreshToken,
    refreshExpiresAt: refreshExpiresAt.toISOString(),
  };
}

export interface AuthContext {
  id: string;
  walletAddress: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
  status: 'ACTIVE' | 'BANNED' | 'RESTRICTED';
}

/** Resolve Bearer token → konteks user, atau null bila tidak valid. */
export async function authenticate(
  db: NodePgDatabase<typeof schema>,
  rawToken: string,
): Promise<AuthContext | null> {
  const rows = await db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(eq(schema.sessions.tokenHash, sha256hex(rawToken)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.session.revokedAt) return null;
  if (row.session.expiresAt.getTime() <= Date.now()) return null;
  return {
    id: row.user.id,
    walletAddress: row.user.walletAddress,
    role: row.user.role,
    status: row.user.status,
  };
}

export async function revokeToken(
  db: NodePgDatabase<typeof schema>,
  rawToken: string,
): Promise<void> {
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(schema.sessions.tokenHash, sha256hex(rawToken)), isNull(schema.sessions.revokedAt)),
    );
}

/** Refresh: tukar refresh token dengan pasangan baru (rotasi).
 *  Race-condition safe: SELECT FOR UPDATE di dalam transaksi atomik. */
export async function rotateRefresh(
  db: NodePgDatabase<typeof schema>,
  rawRefresh: string,
  now = Date.now(),
): Promise<{
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
}> {
  const tokenHash = sha256hex(rawRefresh);
  const accessToken = randomBytes(32).toString('hex');
  const nextRefresh = randomBytes(32).toString('hex');
  const accessExpiresAt = new Date(now + config.accessTtlMs);
  const refreshExpiresAt = new Date(now + config.refreshTtlMs);

  // Seluruh operasi dalam satu transaksi serializable: SELECT FOR UPDATE -> revoke -> insert
  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ session: schema.sessions, user: schema.users })
      .from(schema.sessions)
      .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
      .where(eq(schema.sessions.tokenHash, tokenHash))
      .limit(1)
      .for('update'); // Lock row sampai transaksi selesai

    const row = rows[0];
    if (!row || row.session.revokedAt || row.session.expiresAt.getTime() <= now) {
      throw new AuthError('INVALID_REFRESH', 'Invalid refresh token.', 401);
    }
    // T1-023: akun BANNED/RESTRICTED tidak boleh rotate refresh.
    if (row.user.status !== 'ACTIVE') {
      throw new AuthError('FORBIDDEN', 'Account restricted.', 403);
    }
    // Refresh token harus berumur panjang — tolak token akses (sisa < 25 jam) sebagai refresh.
    const remaining = row.session.expiresAt.getTime() - now;
    if (remaining < 25 * 3600_000)
      throw new AuthError('INVALID_REFRESH', 'Invalid refresh token.', 401);

    // Revoke old token
    await tx
      .update(schema.sessions)
      .set({ revokedAt: new Date(now) })
      .where(eq(schema.sessions.id, row.session.id));

    // Insert new tokens atomically
    await tx.insert(schema.sessions).values([
      { userId: row.user.id, tokenHash: sha256hex(accessToken), expiresAt: accessExpiresAt },
      { userId: row.user.id, tokenHash: sha256hex(nextRefresh), expiresAt: refreshExpiresAt },
    ]);

    return row.user.id; // return userId untuk konfirmasi
  });

  // Jika sampai sini, transaksi sukses
  return {
    accessToken,
    accessExpiresAt: accessExpiresAt.toISOString(),
    refreshToken: nextRefresh,
    refreshExpiresAt: refreshExpiresAt.toISOString(),
  };
}

/** T1-023: cleanup nonce/sesi kedaluwarsa. Dipanggil cron/manual, cegah tabel tumbuh tanpa batas. */
export async function cleanupAuthExpired(
  db: NodePgDatabase<typeof schema>,
  now = Date.now(),
): Promise<{ nonces: number; sessions: number }> {
  const { lt } = await import('drizzle-orm');
  const noncesResult = await db
    .delete(schema.authNonces)
    .where(lt(schema.authNonces.expiresAt, new Date(now)));
  const sessionsResult = await db
    .delete(schema.sessions)
    .where(lt(schema.sessions.expiresAt, new Date(now - 7 * 24 * 3600_000)));
  return { nonces: noncesResult.rowCount ?? 0, sessions: sessionsResult.rowCount ?? 0 };
}

/** T1-023: batasi sesi aktif per user (revoke tertua bila > 20). */
export async function enforceSessionCap(
  db: NodePgDatabase<typeof schema>,
  userId: string,
  cap = 20,
): Promise<void> {
  // Gunakan Drizzle ORM: subquery untuk dapatkan ID sesi tertua yang melebihi cap
  const { sql } = await import('drizzle-orm');
  const oldestSessions = await db
    .select({ id: schema.sessions.id })
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.userId, userId),
        isNull(schema.sessions.revokedAt),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(schema.sessions.createdAt))
    .offset(cap)
    .limit(100); // safety limit

  if (oldestSessions.length > 0) {
    await db
      .update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(
        inArray(
          schema.sessions.id,
          oldestSessions.map((s) => s.id),
        ),
      );
  }
}
