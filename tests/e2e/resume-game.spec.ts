import { test, expect, mockRecentGames, signInAs } from './fixtures.js';

const inProgressMatch = {
  matchId: 'match-in-progress',
  mode: 'public',
  ranked: false,
  status: 'in-progress',
  players: [
    { userId: 'player-1', username: 'e2e-player', seat: 0, connected: true },
    { userId: 'player-2', username: 'teammate', seat: 2, connected: false },
    { userId: 'player-3', username: 'opponent-a', seat: 1, connected: true },
    { userId: 'player-4', username: 'opponent-b', seat: 3, connected: true },
  ],
  scores: [24, 12],
  targetScore: 101,
  createdAt: '2026-01-10T12:00:00.000Z',
  outcome: 'in-progress',
  myTeam: 0,
  finishedAt: null,
  hasSnapshot: true,
};

const completedGames = [
  {
    ...inProgressMatch,
    matchId: 'match-won',
    status: 'finished',
    outcome: 'won',
    scores: [72, 0],
    finishedAt: '2026-01-09T12:00:00.000Z',
    hasSnapshot: false,
  },
  {
    ...inProgressMatch,
    matchId: 'match-lost',
    status: 'finished',
    outcome: 'lost',
    scores: [12, 60],
    finishedAt: '2026-01-08T12:00:00.000Z',
    hasSnapshot: false,
  },
];

test.describe('Recent games and history', () => {
  test('sends the selected match to resume and opens the returned room', async ({ page }) => {
    await mockRecentGames(page, [inProgressMatch]);
    await signInAs(page);
    const roomResponse = await page.request.get('http://127.0.0.1:3101/e2e/resume-room');
    expect(roomResponse.ok()).toBe(true);
    const { roomId } = (await roomResponse.json()) as { roomId: string };
    let resumedMatchId = '';
    await page.route('**/api/matches/match-in-progress/resume', async (route) => {
      resumedMatchId = new URL(route.request().url()).pathname.split('/')[3] ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ roomId }),
      });
    });

    const resume = page.getByRole('button', { name: /resume in-progress match/i });
    await expect(resume).toBeVisible();
    await resume.click();

    await expect(page).toHaveURL(new RegExp(`/match/${roomId}\\?mode=botifarra$`));
    expect(resumedMatchId).toBe('match-in-progress');
    const scoreboard = page.getByRole('region', { name: 'Scoreboard' });
    const hand = page.getByRole('group', { name: 'Your hand' });
    await expect(scoreboard).toBeVisible();
    await expect(scoreboard).toContainText('1/12');
    await expect(page.locator('[aria-label="Trump: Coins"]')).toBeVisible();
    await expect(hand.locator(':scope > div')).toHaveCount(11);
  });

  test('does not offer resume when an in-progress game has no saved snapshot', async ({ page }) => {
    await mockRecentGames(page, [{ ...inProgressMatch, hasSnapshot: false }]);
    await signInAs(page);

    await expect(page.getByRole('listitem', { name: 'In progress' })).toBeVisible();
    await expect(page.getByRole('button', { name: /resume in-progress match/i })).toHaveCount(0);
  });

  test('history displays wins and losses with their expected outcome colors', async ({ page }) => {
    await mockRecentGames(page, completedGames);
    await signInAs(page, 'e2e-player', '/history');

    await expect(page.getByRole('heading', { name: 'Match History' })).toBeVisible();
    const won = page.getByRole('listitem', { name: 'Won' });
    const lost = page.getByRole('listitem', { name: 'Lost' });
    await expect(won).toHaveAttribute('style', /rgba\(39, 174, 96, 0\.12\)/);
    await expect(lost).toHaveAttribute('style', /rgba\(231, 76, 60, 0\.12\)/);
    await expect(page.getByText('Overall statistics')).toBeVisible();
  });
});
