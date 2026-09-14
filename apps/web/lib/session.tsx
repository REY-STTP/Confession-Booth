'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { API_URL } from './booth';

type SessionState = 'visitor' | 'connecting' | 'signing' | 'booth';

interface SessionCtx {
  state: SessionState;
  accessToken: string | null;
  error: string;
  enter: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionCtx>({
  state: 'visitor',
  accessToken: null,
  error: '',
  enter: async () => {},
  logout: async () => {},
});

export function useSession(): SessionCtx {
  return useContext(Ctx);
}

/** T1-031: session in-memory (tanpa localStorage). Access token hanya di RAM. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>('visitor');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  const enter = useCallback(async () => {
    setError('');
    try {
      const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown }) => Promise<unknown> } }).ethereum;
      if (!eth) throw new Error('Wallet tidak ditemukan. Install MetaMask / wallet EVM dulu.');
      setState('connecting');
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      const address = accounts?.[0];
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error('Alamat wallet invalid.');
      // Chain check: harus sama dengan server.
      const chainHex = (await eth.request({ method: 'eth_chainId' })) as string;
      const walletChain = parseInt(chainHex, 16);
      const expected = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111);
      if (walletChain !== expected) {
        throw new Error(`Chain salah (${walletChain}). Pindah ke chain ${expected} dulu.`);
      }
      setState('signing');
      const nRes = await fetch(`${API_URL}/api/auth/nonce?address=${address}&chainId=${walletChain}`);
      if (nRes.status === 429) throw new Error('Terlalu sering. Tunggu sebentar (rate-limit).');
      if (!nRes.ok) {
        const b = await nRes.json().catch(() => ({}));
        throw new Error(b?.error?.code ?? `nonce failed: ${nRes.status}`);
      }
      const { nonce, message } = await nRes.json();
      let signature: string;
      try {
        signature = (await eth.request({ method: 'personal_sign', params: [message, address] })) as string;
      } catch {
        throw new Error('Signature ditolak user.');
      }
      const vRes = await fetch(`${API_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ address, signature, nonce }),
      });
      if (vRes.status === 401) {
        const b = await vRes.json().catch(() => ({}));
        throw new Error(b?.error?.code ?? 'Verifikasi gagal (expired/reuse/domain).');
      }
      if (!vRes.ok) throw new Error(`verify failed: ${vRes.status}`);
      const body = await vRes.json();
      setAccessToken(body.accessToken ?? null);
      setState('booth');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Auth gagal.');
      setState('visitor');
    }
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
    setState('visitor');
  }, [accessToken]);

  const value = useMemo(() => ({ state, accessToken, error, enter, logout }), [state, accessToken, error, enter, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Helper fetch authed (Bearer + cookie refresh). */
export async function apiFetch(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
}
