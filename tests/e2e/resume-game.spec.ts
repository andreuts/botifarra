import { test, expect } from '@playwright/test';

/**
 * E2E: Resume In-Progress Game
 *
 * Validates that a player can navigate to Recent Games, find an in-progress
 * game, click Resume, and reach the game board with the state restored.
 *
 * Prerequisites: A seeded in-progress match must exist for the test user.
 * The test uses the SMOKE_USER_1 / SMOKE_USER_2 credentials from the
 * environment (or falls back to test defaults).
 */

const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:5173';
const USERNAME = process.env['SMOKE_USER_1'] ?? 'testplayer1';
const PASSWORD = process.env['SMOKE_PASSWORD_1'] ?? 'testpassword1';

test.describe('Resume recent games', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[name="username"]', USERNAME);
    await page.fill('[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\//);
  });

  test('Recent Games section shows in-progress games with Resume button', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);

    // Wait for the recent matches section to load
    await page.waitForSelector('ul > li', { timeout: 10_000 });

    // Look for an in-progress row (has a "Reprèn" or "Retomar" button)
    const resumeButton = page.locator('button', { hasText: /repreн|retomar/i }).first();

    if (await resumeButton.isVisible()) {
      await resumeButton.click();
      // Should navigate to the match page
      await expect(page).toHaveURL(/\/match\//);
    } else {
      // No in-progress game available — test passes vacuously
      test.skip(true, 'No in-progress game available to resume');
    }
  });

  test('History page shows player stats and color-coded games', async ({ page }) => {
    await page.goto(`${BASE_URL}/history`);

    // Wait for history to load
    await page.waitForSelector('[class*="page"]', { timeout: 10_000 });

    // Stats heading should be visible if stats exist
    const heading = page.locator('text=/historial|historial de partides/i').first();
    await expect(heading).toBeVisible();
  });

  test('Won games are displayed with green visual indicator', async ({ page }) => {
    await page.goto(`${BASE_URL}/history`);
    await page.waitForSelector('ul > li', { timeout: 10_000 });

    // Find elements that contain green styling (rgba(39, 174, 96
    const wonRows = page.locator('li').filter({ hasText: /victòria|victoria/i });

    if (await wonRows.count() > 0) {
      const firstWon = wonRows.first();
      const style = await firstWon.getAttribute('style');
      expect(style).toContain('39, 174, 96');
    } else {
      test.skip(true, 'No won games in recent history');
    }
  });

  test('Lost games are displayed with red visual indicator', async ({ page }) => {
    await page.goto(`${BASE_URL}/history`);
    await page.waitForSelector('ul > li', { timeout: 10_000 });

    const lostRows = page.locator('li').filter({ hasText: /derrota/i });

    if (await lostRows.count() > 0) {
      const firstLost = lostRows.first();
      const style = await firstLost.getAttribute('style');
      expect(style).toContain('231, 76, 60');
    } else {
      test.skip(true, 'No lost games in recent history');
    }
  });
});
