import { test, expect, signInAs } from './fixtures.js';

test.describe('Authentication and app shell', () => {
  test('unauthenticated users are sent to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('login page renders its required fields and registration link', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/username|usuari/i)).toBeVisible();
    await expect(page.getByLabel(/password|contrasenya/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|inicia sessi/i })).toBeVisible();

    await page.getByRole('link', { name: /register|registra/i }).click();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('successful login establishes a session and opens the lobby', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/username|usuari/i).fill('smokeuser');
    await page.getByLabel(/password|contrasenya/i).fill('test-password');
    await page.getByRole('button', { name: /sign in|inicia sessi/i }).click();

    await expect(page).toHaveURL('/');
    await expect(page.locator('nav .app-nav-username')).toHaveText('smokeuser');
  });

  test('successful registration returns to login', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel(/username|usuari/i).fill('new-player');
    await page.getByLabel(/password|contrasenya/i).fill('secure-password');
    await page.getByRole('button', { name: /register|registra/i }).click();

    await expect(page).toHaveURL(/\/login$/);
  });

  test('authenticated shell shows the user and avoids a duplicate app title', async ({ page }) => {
    await signInAs(page, 'smokeuser');
    await expect(page.locator('nav .app-nav-username')).toHaveText('smokeuser');

    const duplicateTitles = page.locator('main h1, [role="main"] h1, .page-content h1').filter({
      hasText: /botifarra/i,
    });
    await expect(duplicateTitles).toHaveCount(0);
  });
});
