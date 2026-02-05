import { test, expect } from '@playwright/test';

test('players view renders and filters players', async ({ page }) => {
  await page.route('**/api/tournaments', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tournaments: [
          { id: 't1', name: 'Spring Open', format: 'SINGLE' },
          { id: 't2', name: 'Doubles Night', format: 'DOUBLE' },
        ],
      }),
    });
  });

  await page.route('**/api/tournaments/t1/players', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        players: [
          {
            playerId: 'p1',
            firstName: 'Alice',
            lastName: 'Smith',
            surname: 'Falcon',
            name: 'Alice Smith',
            email: 'alice@example.com',
          },
        ],
      }),
    });
  });

  await page.route('**/api/tournaments/t2/players', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        players: [
          {
            playerId: 'p2',
            firstName: 'Bob',
            lastName: 'Lee',
            teamName: 'Team Rocket',
            name: 'Bob Lee',
            email: 'bob@example.com',
          },
        ],
      }),
    });
  });

  await page.goto('/?view=players');

  await expect(page.getByText('Players')).toBeVisible();
  await expect(page.getByText('Alice Smith (Falcon)')).toBeVisible();
  await expect(page.getByText('Team Rocket')).toBeVisible();

  await page.getByPlaceholder('Search name, team, email, phone, tournament...').fill('Rocket');

  await expect(page.getByText('Team Rocket')).toBeVisible();
  await expect(page.getByText('Alice Smith (Falcon)')).toHaveCount(0);
});
