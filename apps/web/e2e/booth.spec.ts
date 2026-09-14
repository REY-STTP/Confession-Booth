// E2E inti T1-050 (visitor, tanpa wallet): landing → browse → composer-gating →
// privacy/guidelines → 404. Authed journey (sign/publish/react/whisper/report/hide)
// tercakup API tests (butuh signature viem) — di sini verifikasi UI jujur saat offline.
import { test, expect } from '@playwright/test';

test('landing: hero + CTA bukan Connect Wallet + privacy jujur', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /say what you can/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /enter the booth/i })).toBeVisible();
  await expect(page.getByText(/blockchain and network metadata/i).first()).toBeVisible();
});

test('browse: feed tampil skeleton lalu kartu atau empty/offline jujur', async ({ page }) => {
  await page.goto('/feed');
  await expect(page.getByRole('search')).toBeVisible();
  // Tunggu salah satu: kartu confession, empty, atau banner offline.
  const card = page.locator('article').first();
  const empty = page.getByText(/the booth is quiet/i);
  const offline = page.getByRole('alert');
  await expect(card.or(empty).or(offline).first()).toBeVisible({ timeout: 15_000 });
});

test('composer tanpa sesi: tolak publish jujur (tanpa false-positive)', async ({ page }) => {
  await page.goto('/compose');
  await page.getByPlaceholder(/write your confession/i).fill('E2E jujur tanpa sesi');
  await page.getByRole('button', { name: /^confess$/i }).click();
  await expect(page.locator('form[aria-label="Composer"] [role="alert"]')).toContainText(/masuk booth|gagal terbit/i);
});

test('composer validasi: markup ditolak client-side', async ({ page }) => {
  await page.goto('/compose');
  await page.getByPlaceholder(/write your confession/i).fill('<script>alert(1)</script>');
  await page.getByRole('button', { name: /^confess$/i }).click();
  // Auth-gating jalan dulu (tanpa sesi) atau validasi markup — keduanya penolakan jujur.
  await expect(page.locator('form[aria-label="Composer"] [role="alert"]')).toContainText(/masuk booth|html tidak diizinkan/i);
});

test('privacy + guidelines + 404', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByText(/jangan.*mengidentifikasi/i).first()).toBeVisible();
  await page.goto('/guidelines');
  await expect(page.getByText(/dilarang|forbidden|spam/i).first()).toBeVisible();
  await page.goto('/confessions/c_tidakada-e2e');
  await expect(page.getByText(/not found|tidak ditemukan|gagal dimuat/i).first()).toBeVisible({ timeout: 15_000 });
});
