// Validasi server T1-004 — SATU sumber kebenaran: @booth/shared.
// API tidak boleh punya aturan sendiri; file ini hanya alias + adaptor error.
// JANGAN percaya validasi client (web memakai modul yang sama, tapi server tetap cek ulang).

import {
  CONFESSION_MAX as SHARED_CONF_MAX,
  WHISPER_MAX as SHARED_WHIS_MAX,
  countChars as sharedCount,
  validateConfession as sharedValidateConfession,
  validateWhisper as sharedValidateWhisper,
  validateReportDetails as sharedValidateDetails,
  isCategorySlug,
  isReactionType,
  isReportReason,
} from '@booth/shared';

export const CONFESSION_MAX = SHARED_CONF_MAX;
export const WHISPER_MAX = SHARED_WHIS_MAX;

export function countChars(s: string): number {
  return sharedCount(s);
}

export function checkContent(content: unknown, max: number): { ok: boolean; errors: string[] } {
  if (max === CONFESSION_MAX) return sharedValidateConfession(content);
  if (max === WHISPER_MAX) return sharedValidateWhisper(content);
  // Fallback generik (tidak dipakai route saat ini): tiru aturan dasar.
  const r = sharedValidateConfession(content);
  if (r.ok && sharedCount(content as string) > max) return { ok: false, errors: ['CONTENT_TOO_LONG'] };
  return r;
}

export function isCategory(s: unknown): boolean {
  return isCategorySlug(s);
}

export function isReaction(s: unknown): boolean {
  return isReactionType(s);
}

export function isReason(s: unknown): boolean {
  return isReportReason(s);
}

export function validateReportDetails(s: unknown): { ok: boolean; errors: string[] } {
  return sharedValidateDetails(s);
}
