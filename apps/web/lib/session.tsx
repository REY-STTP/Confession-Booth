'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { API_URL } from './booth';

type SessionState = 'visitor' | 'connecting' | 'signing' | 'booth';

interface SessionCtx {
  state: SessionState;
  accessToken: string | null;
  signature: string | null;
  error: string;
  enter: () => Promise<void>;
  logout: () => Promise<void>;
  getOrRequestSignature: () => Promise<string>;
  clearSignature: () => void;
}

const Ctx = createContext<SessionCtx>({
  state: 'visitor',
  accessToken: null,
  signature: null,
  error: '',
  enter: async () => {},
  logout: async () => {},
  getOrRequestSignature: async () => '',
  clearSignature: () => {},
});

export function useSession(): SessionCtx {
  return useContext(Ctx);
}

/** T1-031: session in-memory (tanpa localStorage). Access token hanya di RAM.
 *  T1G-fix: pulihkan sesi diam-diam saat mount via cookie refresh HttpOnly
 *  (30 hari) — reload/tab baru tidak lagi melempar ke visitor. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>('visitor');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled || !body.accessToken) return;
        setAccessToken(body.accessToken);
        setState('booth');
      } catch {
        // tanpa cookie refresh valid → tetap visitor, tanpa error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enter = useCallback(async () => {
    setError('');
    try {
      const eth = (
        window as unknown as {
          ethereum?: { request: (a: { method: string; params?: unknown }) => Promise<unknown> };
        }
      ).ethereum;
      if (!eth)
        throw new Error('No Web3 wallet found. Please install MetaMask or an EVM wallet first.');
      setState('connecting');
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      const address = accounts?.[0];
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address))
        throw new Error('Invalid wallet address.');
      // Chain check: harus sama dengan server.
      const chainHex = (await eth.request({ method: 'eth_chainId' })) as string;
      const walletChain = parseInt(chainHex, 16);
      const expected = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111);
      if (walletChain !== expected) {
        throw new Error(`Incorrect network (${walletChain}). Please switch to chain ${expected}.`);
      }
      setState('signing');
      const nRes = await fetch(
        `${API_URL}/api/auth/nonce?address=${address}&chainId=${walletChain}`,
      );
      if (nRes.status === 429)
        throw new Error('Too many requests. Please wait a moment (rate-limit).');
      if (!nRes.ok) {
        const b = await nRes.json().catch(() => ({}));
        throw new Error(b?.error?.code ?? `nonce failed: ${nRes.status}`);
      }
      const { nonce, message } = await nRes.json();
      let sig: string;
      try {
        sig = (await eth.request({
          method: 'personal_sign',
          params: [message, address],
        })) as string;
      } catch {
        throw new Error('Signature request was rejected by user.');
      }
      const vRes = await fetch(`${API_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ address, signature: sig, nonce }),
      });
      if (vRes.status === 401) {
        const b = await vRes.json().catch(() => ({}));
        throw new Error(b?.error?.code ?? 'Verification failed (expired/reuse/domain mismatch).');
      }
      if (!vRes.ok) throw new Error(`verify failed: ${vRes.status}`);
      const body = await vRes.json();
      setAccessToken(body.accessToken ?? null);
      setSignature(sig);
      setState('booth');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed.');
      setState('visitor');
    }
  }, []);

  const getOrRequestSignature = useCallback(async (): Promise<string> => {
    if (signature) return signature;
    const eth = (
      window as unknown as {
        ethereum?: { request: (a: { method: string; params?: unknown }) => Promise<unknown> };
      }
    ).ethereum;
    if (!eth) throw new Error('No Web3 wallet found.');
    const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
    const address = accounts?.[0];
    if (!address) throw new Error('No wallet address found.');
    // P1 #7: pesan ZK diikat ke address + chain + waktu (bukan template statis),
    // agar identitas turunan tidak bisa dipindahkan lintas akun/jaringan.
    const chainHex = (await eth.request({ method: 'eth_chainId' }).catch(() => null)) as
      string | null;
    const chainId = chainHex
      ? parseInt(chainHex, 16)
      : Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111);
    const zkMsg =
      `Confession Booth Zero-Knowledge Stealth Key\n\n` +
      `Sign this message to derive your unlinkable anonymous identity. This costs no gas and is never broadcast.\n\n` +
      `Address: ${address}\nChain ID: ${chainId}\nIssued At: ${new Date().toISOString()}`;
    const sig = (await eth.request({
      method: 'personal_sign',
      params: [zkMsg, address],
    })) as string;
    setSignature(sig);
    return sig;
  }, [signature]);

  // P1 #7: hapus signature dari RAM setelah publish (root identitas sekali pakai).
  const clearSignature = useCallback(() => {
    setSignature(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
      });
    } catch {
      // best-effort
    }
    setAccessToken(null);
    setSignature(null);
    setState('visitor');
  }, [accessToken]);

  const value = useMemo(
    () => ({
      state,
      accessToken,
      signature,
      error,
      enter,
      logout,
      getOrRequestSignature,
      clearSignature,
    }),
    [state, accessToken, signature, error, enter, logout, getOrRequestSignature, clearSignature],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Helper fetch authed (Bearer + cookie refresh). */
export async function apiFetch(
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
}
