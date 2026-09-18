'use client';

// P2 #18: solver PoW browser terpusat (dipakai composer + whisper).
// Clamp difficulty: server jahat/bug tak boleh mengunci UI (maks 2M iterasi / 30s).
export async function solvePowBrowser(salt: string, difficulty: number): Promise<string | null> {
  if (!/^[0-9a-fA-F]+$/.test(salt) || !Number.isInteger(difficulty) || difficulty > 24) {
    return null;
  }
  return new Promise<string | null>((resolve) => {
    const worker = new Worker('/pow-worker.js');
    const timeoutMs = 30000;
    const timer = setTimeout(() => {
      worker.terminate();
      resolve(null);
    }, timeoutMs + 1000);

    worker.onmessage = (e) => {
      clearTimeout(timer);
      resolve(e.data.nonce);
      worker.terminate();
    };
    worker.onerror = () => {
      clearTimeout(timer);
      resolve(null);
      worker.terminate();
    };
    worker.postMessage({ salt, difficulty, timeoutMs });
  });
}

export interface PowChallenge {
  token?: string;
  difficulty?: number;
}

/** Ambil challenge PoW dari respons 429-POW_REQUIRED, bila ada. */
export function extractPowChallenge(body: unknown): PowChallenge | null {
  const err = (body as { error?: { code?: string; challenge?: PowChallenge } })?.error;
  if (
    err?.code === 'POW_REQUIRED' &&
    err.challenge?.token &&
    typeof err.challenge.difficulty === 'number'
  ) {
    return err.challenge;
  }
  return null;
}
