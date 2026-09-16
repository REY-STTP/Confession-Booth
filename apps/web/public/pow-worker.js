/**
 * PoW Web Worker - T1H-005: Non-blocking proof-of-work solver
 * Runs in background thread, doesn't freeze main UI thread
 */
/* global self, TextEncoder, crypto */
self.onmessage = async (e) => {
  const { salt, difficulty, maxIterations = 2000000, timeoutMs = 30000 } = e.data;
  const enc = new TextEncoder();
  const target = difficulty;
  const startTime = Date.now();

  for (let n = 0; n < maxIterations; n++) {
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      self.postMessage({ nonce: null, success: false, timeout: true });
      return;
    }

    // Yield periodically to avoid blocking worker thread completely
    if (n % 5000 === 0 && n > 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const h = await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${n}`));
    const bytes = new Uint8Array(h);
    let bits = 0;
    let ok = true;
    for (const b of bytes) {
      for (let i = 7; i >= 0 && bits < target; i--) {
        if ((b >> i) & 1) {
          ok = false;
          break;
        }
        bits += 1;
      }
      if (!ok || bits >= target) break;
    }
    if (ok && bits >= target) {
      self.postMessage({ nonce: String(n), success: true });
      return;
    }
  }
  self.postMessage({ nonce: null, success: false });
};
