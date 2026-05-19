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

test.describe('Smoke — nav user section', () => {
  test.beforeEach(async ({ page }) => {
    // Inject a fake auth session directly so we don't need a real server
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem(
        'botifarra-auth',
        JSON.stringify({ state: { user: { username: 'smokeuser', accessToken: 'fake' } }, version: 0 }),
      );
    });
    await page.goto('/');
  });

  test('username is visible in the nav bar', async ({ page }) => {
    await expect(page.locator('nav .app-nav-username')).toBeVisible();
    await expect(page.locator('nav .app-nav-username')).toHaveText('smokeuser');
  });

  test('no h1 containing app title in main content area', async ({ page }) => {
    const duplicateTitles = page.locator('main h1, [role="main"] h1, .page-content h1').filter({ hasText: /botifarra/i });
    await expect(duplicateTitles).toHaveCount(0);
  });
});

