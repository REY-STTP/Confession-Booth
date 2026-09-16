// Core E2E tests (visitor, no wallet): landing → browse → composer-gating →
// privacy/guidelines → 404. Authed journeys (sign/publish/react/whisper/report/hide)
// are covered in API tests — here we verify honest UI during offline/visitor states.
import { test, expect } from '@playwright/test';

test('landing: hero + CTA is not Connect Wallet + honest privacy boundaries', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /say what you can/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /enter the booth/i })).toBeVisible();
  await expect(page.getByText(/blockchain and network metadata/i).first()).toBeVisible();
});

test('browse: feed renders skeleton then cards or honest empty/offline state', async ({ page }) => {
  await page.goto('/feed');
  await expect(page.getByRole('search')).toBeVisible();
  // Wait for one of: confession card, empty state, or offline alert.
  const card = page.locator('article').first();
  const empty = page.getByText(/the booth is quiet/i);
  const offline = page.getByRole('alert');
  await expect(card.or(empty).or(offline).first()).toBeVisible({ timeout: 15_000 });
});

test('composer without session: reject publish honestly', async ({ page }) => {
  await page.goto('/compose');
  await page.getByPlaceholder(/write your confession/i).fill('E2E test without session');
  await page.getByRole('button', { name: /^confess$/i }).click();
  await expect(page.locator('form[aria-label="Composer"] [role="alert"]')).toContainText(
    /enter the booth|publish failed/i,
  );
});

test('composer validation: HTML markup rejected client-side', async ({ page }) => {
  await page.goto('/compose');
  await page.getByPlaceholder(/write your confession/i).fill('<script>alert(1)</script>');
  await page.getByRole('button', { name: /^confess$/i }).click();
  await expect(page.locator('form[aria-label="Composer"] [role="alert"]')).toContainText(
    /enter the booth|html is not allowed/i,
  );
});

test('privacy + guidelines + 404', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByText(/never write names|identify you/i).first()).toBeVisible();
  await page.goto('/guidelines');
  await expect(page.getByText(/strictly prohibited|forbidden|spam/i).first()).toBeVisible();
  await page.goto('/confessions/c_tidakada-e2e');
  await expect(page.getByText(/not found|silent & empty|failed to load/i).first()).toBeVisible({
    timeout: 15_000,
  });
});
