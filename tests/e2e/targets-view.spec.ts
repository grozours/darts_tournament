import { test, expect } from '@playwright/test';

test('targets view renders live targets and queue', async ({ page }) => {
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
              {
                id: 'target-1',
                targetNumber: 1,
                targetCode: 'A1',
                status: 'AVAILABLE',
              },
            ],
            poolStages: [
              {
                id: 'stage-1',
                stageNumber: 1,
                name: 'Main Stage',
                status: 'IN_PROGRESS',
                pools: [
                  {
                    id: 'pool-1',
                    poolNumber: 1,
                    name: 'Pool A',
                    assignments: [
                      { id: 'assignment-1', player: { id: 'player-1', firstName: 'Alice', lastName: 'Smith' } },
                      { id: 'assignment-2', player: { id: 'player-2', firstName: 'Bob', lastName: 'Lee' } },
                    ],
                    matches: [
                      {
                        id: 'match-1',
                        matchNumber: 1,
                        roundNumber: 1,
                        status: 'SCHEDULED',
                        playerMatches: [
                          { player: { id: 'player-1', firstName: 'Alice', lastName: 'Smith' }, playerPosition: 1 },
                          { player: { id: 'player-2', firstName: 'Bob', lastName: 'Lee' }, playerPosition: 2 },
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

  await page.goto('/?view=targets');

  await expect(page.getByText('A1')).toBeVisible();
  await expect(page.getByText('Match queue')).toBeVisible();
});
