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

  await page.goto('/?view=single');

  await expect(page.getByText('Alice Smith (Falcon)')).toBeVisible();
  await expect(page.getByText('Team Rocket')).toHaveCount(0);

  await page.getByPlaceholder('Search name, team, email, tournament...').fill('Falcon');

  await expect(page.getByText('Alice Smith (Falcon)')).toBeVisible();
  await expect(page.getByText('Team Rocket')).toHaveCount(0);
});

test('players view search matches tournament names and can be reset', async ({ page }) => {
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

  await page.goto('/?view=single');

  const searchInput = page.getByPlaceholder('Search name, team, email, tournament...');
  await searchInput.fill('Spring Open');

  await expect(page.getByText('Alice Smith (Falcon)')).toBeVisible();
  await expect(page.getByText('Team Rocket')).toHaveCount(0);

  await searchInput.fill('');
  await expect(page.getByText('Alice Smith (Falcon)')).toBeVisible();
  await expect(page.getByText('Team Rocket')).toHaveCount(0);
});
