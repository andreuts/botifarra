import { test, expect, signInAs } from './fixtures.js';

test.describe('Lobby game flows', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page);
  });

  test('joins and leaves solo matchmaking with the selected ranked option', async ({ page }) => {
    let joinPayload: Record<string, unknown> | undefined;
    let leaveRequested = false;

    await page.route('**/api/matches/queue/join', async (route) => {
      joinPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: '{"queueSize":1}',
      });
    });
    await page.route('**/api/matches/queue/leave', async (route) => {
      leaveRequested = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"left":true}' });
    });

    await page.getByRole('checkbox', { name: 'Ranked' }).first().check();
    await page.getByRole('button', { name: 'Quick Match (Solo)' }).click();
    const cancel = page.getByRole('button', { name: /cancel/i });
    await expect(cancel).toBeVisible();
    expect(joinPayload).toEqual({ mode: 'single', ranked: true });

    await cancel.click();
    await expect(page.getByRole('button', { name: 'Quick Match (Solo)' })).toBeVisible();
    await expect.poll(() => leaveRequested).toBe(true);
  });

  test('pair quick match opens the friends flow with ranked choice preserved', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Ranked' }).nth(1).check();
    await page.getByRole('button', { name: 'Quick Match (Pair)' }).click();

    await expect(page).toHaveURL('/friends?ranked=true');
    await expect(page.getByRole('heading', { name: 'Friends' })).toBeVisible();
  });

  test('creates a private room and displays its shareable invite code', async ({ page }) => {
    await page.getByRole('button', { name: 'Create room' }).click();

    await expect(page.getByText('ABC123', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Enter room' }).click();
    await expect(page).toHaveURL(/\/match\/invite-room\?mode=botifarra$/);
  });

  test('joins a private room using an uppercase invite code', async ({ page }) => {
    let joinedPath = '';
    await page.route('**/api/rooms/*/join', async (route) => {
      joinedPath = new URL(route.request().url()).pathname;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ roomId: 'invite-room', inviteCode: 'AB12' }),
      });
    });

    await page.getByPlaceholder('Enter code').fill('ab12');
    await page.getByRole('button', { name: 'Join', exact: true }).click();

    await expect(page).toHaveURL(/\/match\/invite-room\?mode=botifarra$/);
    expect(joinedPath).toBe('/api/rooms/AB12/join');
  });

  test('keeps private room join disabled until a usable invite code is entered', async ({
    page,
  }) => {
    const join = page.getByRole('button', { name: 'Join', exact: true });
    await expect(join).toBeDisabled();

    await page.getByPlaceholder('Enter code').fill('AB1');
    await expect(join).toBeDisabled();

    await page.getByPlaceholder('Enter code').fill('AB12');
    await expect(join).toBeEnabled();
  });
});
