import { test, expect } from '@playwright/test';

test('pool stages view renders live pool stages', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'en');
  });

  await page.route('**/api/auth/dev-autologin', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ mode: 'anonymous', availableModes: ['anonymous', 'player', 'admin'] }),
    });
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unauthorized' }),
    });
  });

  await page.route(/\/api\/tournaments\/live-summary\?statuses=LIVE(?:&.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tournaments: [
          {
            id: 'tournament-1',
            name: 'Live Tournament',
            status: 'LIVE',
            targets: [
              { id: 'target-1', targetNumber: 1, targetCode: 'T1', status: 'AVAILABLE' },
            ],
            poolStages: [
              {
                id: 'stage-1',
                stageNumber: 1,
                name: 'Main Stage',
                status: 'IN_PROGRESS',
                playersPerPool: 2,
                pools: [
                  {
                    id: 'pool-1',
                    poolNumber: 1,
                    name: 'Pool A',
                    status: 'IN_PROGRESS',
                    assignments: [
                      {
                        id: 'assignment-1',
                        player: { id: 'player-1', firstName: 'Alice', lastName: 'Ace' },
                      },
                      {
                        id: 'assignment-2',
                        player: { id: 'player-2', firstName: 'Bob', lastName: 'Bull' },
                      },
                    ],
                    matches: [
                      {
                        id: 'match-1',
                        matchNumber: 1,
                        roundNumber: 1,
                        status: 'SCHEDULED',
                        playerMatches: [
                          {
                            player: { id: 'player-1', firstName: 'Alice', lastName: 'Ace' },
                            playerPosition: 1,
                          },
                          {
                            player: { id: 'player-2', firstName: 'Bob', lastName: 'Bull' },
                            playerPosition: 2,
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
            brackets: [],
          },
        ],
      }),
    });
  });

  await page.goto('/?view=pool-stages&status=LIVE');

  await expect(page.getByText('Main Stage')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pool 1 of 1: Pool A' })).toBeVisible();
});
