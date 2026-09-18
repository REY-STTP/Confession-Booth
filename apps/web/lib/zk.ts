/**
 * Browser-safe cryptographic utilities for Fase 2 ZK Anonymous Credentials.
 * Uses Web Crypto API (SubtleCrypto) supported natively in all modern browsers.
 */
// P1 #11: normalisasi dari SSOT shared (hapus duplikat lokal).
import { normalizeForDedup } from '@booth/shared/constants';

export { normalizeForDedup };

export const EPOCH_DURATION_MS = 3_600_000; // 1 jam per epoch

export function getCurrentEpoch(timestampMs: number = Date.now()): number {
  return Math.floor(timestampMs / EPOCH_DURATION_MS);
}

export async function sha256Browser(message: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(message));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface AnonymousIdentity {
  trapdoor: string;
  nullifier: string;
  commitment: string;
}

export async function deriveAnonymousIdentityBrowser(
  signature: string,
): Promise<AnonymousIdentity> {
  const normSig = signature.toLowerCase().replace(/^0x/, '');
  const trapdoor = await sha256Browser(`booth:trapdoor:${normSig}`);
  const nullifier = await sha256Browser(`booth:nullifier:${normSig}`);
  const commitment = await sha256Browser(`booth:commitment:${trapdoor}:${nullifier}`);
  return { trapdoor, nullifier, commitment };
}

export async function computeEpochNullifierBrowser(
  identityNullifier: string,
  epoch: number,
  scope: 'confess' | 'whisper' | 'react' = 'confess',
): Promise<string> {
  return await sha256Browser(`booth:epoch-nullifier:${identityNullifier}:${epoch}:${scope}`);
}

export interface MerkleProof {
  leaf: string;
  root: string;
  path: string[];
  indices: number[];
}

export async function buildMerkleTreeBrowser(leaves: string[]): Promise<{
  root: string;
  levels: string[][];
}> {
  if (leaves.length === 0) {
    const emptyRoot = await sha256Browser('booth:merkle:empty');
    return { root: emptyRoot, levels: [[emptyRoot]] };
  }

  const levels: string[][] = [leaves.slice()];
  while (levels[levels.length - 1].length > 1) {
    const current = levels[levels.length - 1];
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = i + 1 < current.length ? current[i + 1] : left;
      // P2 #21: HARUS identik dengan @booth/shared buildMerkleTree
      // (domain separation node) — root client ≡ server.
      const combined = await sha256Browser(`booth:merkle:node:${left}:${right}`);
      next.push(combined);
    }
    levels.push(next);
  }

  return {
    root: levels[levels.length - 1][0],
    levels,
  };
}

export async function getMerkleProofBrowser(
  leaves: string[],
  leafIndex: number,
): Promise<MerkleProof> {
  if (leafIndex < 0 || leafIndex >= leaves.length) {
    throw new Error('Leaf index out of bounds');
  }

  const { root, levels } = await buildMerkleTreeBrowser(leaves);
  const path: string[] = [];
  const indices: number[] = [];

  let idx = leafIndex;
  for (let l = 0; l < levels.length - 1; l++) {
    const level = levels[l];
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : Math.min(idx + 1, level.length - 1);
    path.push(level[siblingIdx]);
    indices.push(isRight ? 1 : 0);
    idx = Math.floor(idx / 2);
  }

  return {
    leaf: leaves[leafIndex],
    root,
    path,
    indices,
  };
}

export async function canonicalHashBrowser(body: string): Promise<string> {
  return await sha256Browser(normalizeForDedup(body));
}

export interface AnonymousSignalProof {
  merkleRoot: string;
  nullifierHash: string;
  epoch: number;
  scope: 'confess';
  signal: string;
  proof: string;
}

export async function createAnonymousSignalProofBrowser(params: {
  identity: AnonymousIdentity;
  merkleProof: MerkleProof;
  signal: string;
  epoch: number;
  scope?: 'confess';
}): Promise<AnonymousSignalProof> {
  const scope = params.scope ?? 'confess';
  const nullifierHash = await computeEpochNullifierBrowser(
    params.identity.nullifier,
    params.epoch,
    scope,
  );
  const challenge = await sha256Browser(
    `${params.merkleProof.root}:${nullifierHash}:${params.epoch}:${scope}:${params.signal}`,
  );
  const proof = await sha256Browser(`${params.identity.trapdoor}:${challenge}`);

  return {
    merkleRoot: params.merkleProof.root,
    nullifierHash,
    epoch: params.epoch,
    scope,
    signal: params.signal,
    proof,
  };
}
