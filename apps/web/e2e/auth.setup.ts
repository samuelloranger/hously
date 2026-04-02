import { test as setup, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth/state.json');

/**
 * Logs in once before the test suite and saves browser storage state
 * so authenticated tests don't need to re-login.
 *
 * Required env vars (fall back to dev defaults):
 *   TEST_EMAIL    — registered Hously user email
 *   TEST_PASSWORD — that user's password
 */
setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_EMAIL ?? 'test@example.com';
  const password = process.env.TEST_PASSWORD ?? 'Password123!';

  await page.goto('/login');

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();

  // Wait until we land on an authenticated page
  await expect(page).toHaveURL(/\/(dashboard|board|$)/, { timeout: 15_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
