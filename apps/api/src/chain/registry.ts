// Chain layer T1-021: ABI minimal registry + client helpers (viem).
// Hanya hash/reference yang dikirim on-chain — TIDAK PERNAH plaintext (SMART_CONTRACT §5).

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseAbiItem,
  type Account,
  type Chain,
  type Hex,
  type HttpTransport,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export const REGISTRY_ABI = parseAbi([
  'function publish(bytes32 confessionId, bytes32 contentHash, string contentCID, uint16 version)',
  'function exists(bytes32 confessionId) view returns (bool)',
  'function owner() view returns (address)',
  'function publishers(address who) view returns (bool)',
  'function setPublisher(address who, bool allowed)',
  'event PublisherUpdated(address indexed publisher, bool allowed)',
  'event ConfessionPublished(bytes32 indexed confessionId, bytes32 indexed contentHash, address indexed publisher, string contentCID, uint64 timestamp, uint16 version)',
]);

export const PUBLISHED_EVENT = parseAbiItem(
  'event ConfessionPublished(bytes32 indexed confessionId, bytes32 indexed contentHash, address indexed publisher, string contentCID, uint64 timestamp, uint16 version)',
);

export interface ChainEnv {
  rpcUrl: string;
  contractAddress: Hex;
  chainId: number;
}

export function chainDef(chainId: number, rpcUrl: string) {
  return {
    id: chainId,
    name: `booth-${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  } as const;
}

export function publicClient(env: ChainEnv): PublicClient {
  return createPublicClient({
    chain: chainDef(env.chainId, env.rpcUrl),
    transport: http(env.rpcUrl),
  });
}

export function publisherAccount(key: Hex) {
  return privateKeyToAccount(key);
}

export function walletClient(env: ChainEnv, key: Hex): WalletClient<HttpTransport, Chain, Account> {
  return createWalletClient({
    account: publisherAccount(key),
    chain: chainDef(env.chainId, env.rpcUrl),
    transport: http(env.rpcUrl),
  });
}

/** Samakan dua bytes32 hex terlepas dari prefix 0x / kapital. */
export function eqBytes32(a: string, b: string): boolean {
  const norm = (s: string) =>
    (s.startsWith('0x') || s.startsWith('0X') ? s.slice(2) : s).toLowerCase();
  return norm(a) === norm(b);
}

/** 0x-prefixed bytes32 dari hex tanpa prefix (hash internal kita). */
export function toBytes32(hex: string): Hex {
  const h = hex.startsWith('0x') ? hex : `0x${hex}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(h)) throw new Error('INVALID_BYTES32');
  return h as Hex;
}
