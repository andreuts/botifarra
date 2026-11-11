import { test as base, expect, type Page } from '@playwright/test';

const EMPTY_STATS = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  currentElo: 1000,
  averageEloChange: 0,
  eloHistory: [],
  rankedEloHistory: [],
  topPlayedWith: [],
  topPlayedAgainst: [],
};

async function mockApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    let status = 200;
    let body: unknown;

    if (pathname === '/api/auth/login' && request.method() === 'POST') {
      const credentials = request.postDataJSON() as { username?: string };
      const username = credentials.username ?? 'e2e-player';
      body = { accessToken: 'e2e-access-token', userId: `${username}-id`, username };
    } else if (pathname === '/api/auth/register' && request.method() === 'POST') {
      const credentials = request.postDataJSON() as { username?: string };
      const username = credentials.username ?? 'e2e-player';
      body = { userId: `${username}-id`, username };
    } else if (pathname === '/api/matches/queue/status') {
      body = { inQueue: false, queueSize: 0 };
    } else if (pathname === '/api/matches/queue/join' && request.method() === 'POST') {
      status = 202;
      body = { queueSize: 1 };
    } else if (pathname === '/api/matches/queue/leave' && request.method() === 'POST') {
      body = { left: true };
    } else if (pathname === '/api/matches') {
      body = [];
    } else if (/^\/api\/matches\/[^/]+\/resume$/.test(pathname) && request.method() === 'POST') {
      body = { roomId: 'resumed-room' };
    } else if (pathname === '/api/rooms/create' && request.method() === 'POST') {
      body = { inviteCode: 'ABC123' };
    } else if (/^\/api\/rooms\/[^/]+\/join$/.test(pathname) && request.method() === 'POST') {
      body = { roomId: 'invite-room', inviteCode: pathname.split('/')[3] };
    } else if (pathname === '/api/users/me/stats') {
      body = EMPTY_STATS;
    } else if (pathname === '/api/friends') {
      body = { friends: [], incoming: [], outgoing: [] };
    } else if (pathname === '/api/pair-invite/pending') {
      body = [];
    } else {
      status = 501;
      body = { error: `No E2E API fixture for ${request.method()} ${pathname}` };
    }

    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await mockApi(page);
    await use(page);
  },
});

export { expect };

export async function signInAs(page: Page, username = 'e2e-player', path = '/') {
  await page.goto('/login');
  await page.evaluate((name) => {
    localStorage.setItem(
      'botifarra-auth',
      JSON.stringify({
        state: {
          user: { userId: `${name}-id`, username: name, accessToken: 'e2e-access-token' },
        },
        version: 0,
      }),
    );
    localStorage.setItem(
      'botifarra-settings',
      JSON.stringify({
        state: { language: 'en', soundEnabled: false, soundVolume: 0 },
        version: 0,
      }),
    );
    localStorage.setItem('i18nextLng', 'en');
  }, username);
  await page.goto(path);
}

export async function mockRecentGames(page: Page, matches: unknown[]) {
  await page.route('**/api/matches', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(matches) }),
  );
}
