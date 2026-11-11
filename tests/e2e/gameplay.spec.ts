import { test, expect, signInAs } from './fixtures.js';

test('a player can finish a practice round against bots', async ({ page }) => {
  test.setTimeout(240_000);

  await signInAs(page);
  await page.getByRole('button', { name: 'Practice vs bot' }).click();
  await expect(page).toHaveURL('/play?mode=practice');

  const scoreboard = page.getByRole('region', { name: 'Scoreboard' });
  const hand = page.getByRole('group', { name: 'Your hand' });
  const handCards = hand.locator(':scope > div');
  await expect(scoreboard).toBeVisible({ timeout: 30_000 });
  await expect(handCards).toHaveCount(12);
  await expect(page.getByText('Practice', { exact: true })).toBeVisible();

  // The first dealer is the human in the E2E room, so this exercises the
  // trump declaration command as well as the card play commands below.
  await page.getByRole('button', { name: 'Declare Oros' }).click();
  await expect(page.locator('[aria-label="Trump: Coins"]')).toBeVisible();

  const result = page.getByText(/^(Victory!|Defeat)$/);
  const deadline = Date.now() + 220_000;

  while (Date.now() < deadline) {
    if (await result.isVisible()) break;

    const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
    if (await continueButton.isVisible()) {
      await continueButton.click();
      continue;
    }

    const turnPrompt = page.getByText(/your turn.*play a card/i);
    if (await turnPrompt.isVisible()) {
      const playable = hand.locator('[role="button"]:not([aria-disabled="true"])').first();
      const label = await playable.getAttribute('aria-label');
      const cardsBeforePlay = await handCards.count();

      await playable.click();
      const selected = hand.getByRole('button', { name: label! });
      await expect(selected).toHaveAttribute('aria-pressed', 'true');
      await selected.click();
      await expect(handCards).toHaveCount(cardsBeforePlay - 1, {
        timeout: 10_000,
      });
      continue;
    }

    await page.waitForTimeout(100);
  }

  await expect(result).toBeVisible({ timeout: 1_000 });
  await expect(scoreboard).toContainText('12/12');
  await expect(page.getByText('Final Score', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Back to Lobby', exact: true }).click();
  await expect(page).toHaveURL('/');
});
