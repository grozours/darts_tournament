import { test, expect } from '@playwright/test';

test('players view renders and filters players', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'en');
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'admin-1', email: 'admin@example.com', name: 'Admin' },
        isAdmin: true,
      }),
    });
  });

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

  await page.route('**/api/tournaments/players/orphans', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ players: [] }),
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

  await page.route('**/api/tournaments/t1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 't1',
        name: 'Spring Open',
        format: 'SINGLE',
        status: 'OPEN',
        totalParticipants: 32,
      }),
    });
  });

  await page.goto('/?view=tournament-players&tournamentId=t1');

  await expect(page.getByRole('heading', { name: 'Alice Smith' })).toBeVisible();
  await expect(page.getByText('"Falcon"')).toBeVisible();
  await expect(page.getByText('Team Rocket')).toHaveCount(0);

  await page.locator('#tournament-players-search').fill('Falcon');

  await expect(page.getByRole('heading', { name: 'Alice Smith' })).toBeVisible();
  await expect(page.getByText('Team Rocket')).toHaveCount(0);
});

test('players view search matches player data and can be reset', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'en');
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'admin-1', email: 'admin@example.com', name: 'Admin' },
        isAdmin: true,
      }),
    });
  });

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

  await page.route('**/api/tournaments/players/orphans', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ players: [] }),
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

  await page.route('**/api/tournaments/t1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 't1',
        name: 'Spring Open',
        format: 'SINGLE',
        status: 'OPEN',
        totalParticipants: 32,
      }),
    });
  });

  await page.goto('/?view=tournament-players&tournamentId=t1');

  const searchInput = page.locator('#tournament-players-search');
  await searchInput.fill('Falcon');

  await expect(page.getByRole('heading', { name: 'Alice Smith' })).toBeVisible();
  await expect(page.getByText('Team Rocket')).toHaveCount(0);

  await searchInput.fill('');
  await expect(page.getByRole('heading', { name: 'Alice Smith' })).toBeVisible();
  await expect(page.getByText('Team Rocket')).toHaveCount(0);
});
