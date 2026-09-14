// Abuse scoring dasar T1-005: velocity + duplikat + report-count → flag moderasi.
// - Skor 0..100, disimpan ke confessions.moderation_score (wiring di 1B).
// - Eskalasi CAPTCHA/PoW penuh di Fase 1.5; di sini hanya keputusan stub
//   `challenge: 'none' | 'captcha'` saat ambang terlampaui.

export interface AbuseSignals {
  /** Aksi sejenis dalam 1 jam terakhir oleh subject yang sama. */
  recentCount: number;
  /** Konten kanonis duplikat milik user dalam 10 mnt terakhir? */
  isDuplicate: boolean;
  /** Jumlah report OPEN terhadap target (untuk reaksi/whisper berulang). */
  openReports: number;
}

export interface AbuseVerdict {
  score: number;
  flag: boolean;
  challenge: 'none' | 'captcha';
}

const DUPLICATE_WEIGHT = 45;
const VELOCITY_WEIGHT = 12; // per aksi terakhir
const REPORT_WEIGHT = 15; // per report terbuka
const FLAG_THRESHOLD = 50;

export function scoreAbuse(s: AbuseSignals): AbuseVerdict {
  const score = Math.min(
    100,
    s.recentCount * VELOCITY_WEIGHT + (s.isDuplicate ? DUPLICATE_WEIGHT : 0) + s.openReports * REPORT_WEIGHT,
  );
  const flag = score >= FLAG_THRESHOLD;
  return { score, flag, challenge: flag ? 'captcha' : 'none' };
}
