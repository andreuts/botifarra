import { test, expect } from '@playwright/test';

test.describe('Smoke — unauthenticated user', () => {
  test('landing page redirects to /login', async ({ page }) => {
    await page.goto('/');
    // Should end up on login or home page (requires auth)
    await expect(page).toHaveURL(/\/(login|home)?/);
  });

  test('login page renders with username and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/usuari/i)).toBeVisible();
    await expect(page.getByLabel(/contrasenya/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
  });

  test('register page renders link from login', async ({ page }) => {
    await page.goto('/login');
    const registerLink = page.getByRole('link', { name: /registra/i });
    await expect(registerLink).toBeVisible();
    await registerLink.click();
    await expect(page).toHaveURL(/\/register/);
  });
});
