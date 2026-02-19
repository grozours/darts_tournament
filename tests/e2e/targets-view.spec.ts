import { test, expect } from '@playwright/test';

test('targets view renders live targets and queue', async ({ page }) => {
  await page.route('**/api/tournaments?status=LIVE', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tournaments: [{ id: 'tournament-1', status: 'LIVE' }],
      }),
    });
  });

  await page.route('**/api/tournaments/tournament-1/live', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'tournament-1',
        name: 'Live Tournament',
        status: 'LIVE',
        targets: [
          {
            id: 'target-1',
            targetNumber: 1,
            targetCode: 'A1',
            status: 'AVAILABLE',
            currentMatchId: undefined,
          },
        ],
        poolStages: [
          {
            id: 'stage-1',
            stageNumber: 1,
            name: 'Main Stage',
            pools: [
              {
                id: 'pool-1',
                poolNumber: 1,
                name: 'Pool A',
                matches: [
                  {
                    id: 'match-1',
                    matchNumber: 1,
                    roundNumber: 1,
                    status: 'SCHEDULED',
                    playerMatches: [
                      { player: { firstName: 'Alice', lastName: 'Smith' } },
                      { player: { firstName: 'Bob', lastName: 'Lee' } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        brackets: [],
      }),
    });
  });

  await page.goto('/?view=targets');

  await expect(page.getByRole('heading', { name: 'Live Tournament' })).toBeVisible();
  await expect(page.getByText('A1')).toBeVisible();
  await expect(page.getByText('Free')).toBeVisible();
  await expect(page.getByText('Match queue')).toBeVisible();
});
