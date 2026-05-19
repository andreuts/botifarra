import { test, expect } from '@playwright/test';

test.describe('Language selector', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any persisted language setting
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.removeItem('botifarra-settings');
      localStorage.setItem(
        'botifarra-auth',
        JSON.stringify({ state: { user: { username: 'languser', accessToken: 'fake' } }, version: 0 }),
      );
    });
    await page.goto('/');
  });

  test('language selector lists Català and English only (no Español)', async ({ page }) => {
    await page.locator('button.settings-gear').first().click();
    const select = page.locator('#language-select');
    await expect(select).toBeVisible();

    const options = await select.locator('option').allTextContents();
    expect(options).toContain('Català');
    expect(options).toContain('English');
    expect(options).not.toContain('Español');
    expect(options).toHaveLength(2);
  });

  test('selecting English changes nav labels immediately', async ({ page }) => {
    await page.locator('button.settings-gear').first().click();
    await page.locator('#language-select').selectOption('en');

    // Nav history link should now read in English
    await expect(page.locator('nav a[href="/history"]')).toHaveText('Match History');
  });

  test('English language setting persists after reload', async ({ page }) => {
    await page.locator('button.settings-gear').first().click();
    await page.locator('#language-select').selectOption('en');
    await page.locator('button.settings-close').click();
    await page.reload();

    await expect(page.locator('nav a[href="/history"]')).toHaveText('Match History');
  });

  test('stale "es" language falls back to Catalan on load', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'botifarra-settings',
        JSON.stringify({ state: { language: 'es', soundEnabled: true, soundVolume: 0.7 }, version: 0 }),
      );
    });
    await page.reload();

    // Nav history link should be in Catalan (fallback)
    await expect(page.locator('nav a[href="/history"]')).toHaveText('Historial de partides');

    // No console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    expect(errors).toHaveLength(0);
  });
});
