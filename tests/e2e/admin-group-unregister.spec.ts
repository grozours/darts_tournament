import { expect, test } from '@playwright/test';

const adminProfile = {
  user: { id: 'admin-1', email: 'admin@example.com', name: 'Admin' },
  isAdmin: true,
};

const unregisterLabel = /unregister|désinscrire/i;

const mockAdminAuth = async (page: Parameters<typeof test>[0]['page']) => {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'en');
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adminProfile),
    });
  });
};

test('admin unregisters registered doublette from groups card and tournament card', async ({ page }) => {
  await mockAdminAuth(page);

  let doubletteRegistered = true;
  let unregisterCalls = 0;

  await page.route('**/api/tournaments**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/api/tournaments' || route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tournaments: [{ id: 't-double', name: 'Double Open', format: 'DOUBLE', status: 'OPEN', totalParticipants: 16 }],
      }),
    });
  });

  await page.route('**/api/tournaments/t-double/players', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        players: [{ playerId: 'p-admin', email: 'admin@example.com', firstName: 'Admin', lastName: 'User' }],
      }),
    });
  });

  await page.route('**/api/tournaments/t-double/doublettes', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        doublettes: [
          {
            id: 'd-1',
            name: 'Duo One',
            captainPlayerId: 'p-admin',
            isRegistered: doubletteRegistered,
            createdAt: new Date().toISOString(),
            memberCount: 2,
            members: [
              { playerId: 'p-admin', firstName: 'Admin', lastName: 'User', email: 'admin@example.com', joinedAt: new Date().toISOString() },
              { playerId: 'p-captain', firstName: 'Cap', lastName: 'One', email: 'cap@example.com', joinedAt: new Date().toISOString() },
            ],
          },
        ],
      }),
    });
  });

  await page.route('**/api/tournaments/t-double/doublettes/d-1/unregister', async (route) => {
    unregisterCalls += 1;
    doubletteRegistered = false;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'd-1', isRegistered: false }),
    });
  });

  await page.goto('/?view=doublettes&tournamentId=t-double');
  await expect(page.getByText('Duo One')).toBeVisible();

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole('button', { name: unregisterLabel }).click();

  await expect.poll(() => unregisterCalls).toBe(1);
  await expect(page.getByRole('button', { name: unregisterLabel })).toHaveCount(0);

  doubletteRegistered = true;
  await page.goto('/?status=OPEN');
  await expect(page.getByRole('heading', { name: 'Double Open' })).toBeVisible();

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole('button', { name: unregisterLabel }).click();

  await expect.poll(() => unregisterCalls).toBe(2);
});

test('admin unregisters registered equipe from groups card and tournament card', async ({ page }) => {
  await mockAdminAuth(page);

  let equipeRegistered = true;
  let unregisterCalls = 0;

  await page.route('**/api/tournaments**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/api/tournaments' || route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tournaments: [{ id: 't-team', name: 'Team Open', format: 'TEAM_4_PLAYER', status: 'OPEN', totalParticipants: 16 }],
      }),
    });
  });

  await page.route('**/api/tournaments/t-team/players', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        players: [{ playerId: 'p-admin', email: 'admin@example.com', firstName: 'Admin', lastName: 'User' }],
      }),
    });
  });

  await page.route('**/api/tournaments/t-team/equipes', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        equipes: [
          {
            id: 'e-1',
            name: 'Team One',
            captainPlayerId: 'p-admin',
            isRegistered: equipeRegistered,
            createdAt: new Date().toISOString(),
            memberCount: 4,
            members: [
              { playerId: 'p-admin', firstName: 'Admin', lastName: 'User', email: 'admin@example.com', joinedAt: new Date().toISOString() },
              { playerId: 'p-captain', firstName: 'Cap', lastName: 'One', email: 'cap@example.com', joinedAt: new Date().toISOString() },
              { playerId: 'p-3', firstName: 'Three', lastName: 'User', email: 'three@example.com', joinedAt: new Date().toISOString() },
              { playerId: 'p-4', firstName: 'Four', lastName: 'User', email: 'four@example.com', joinedAt: new Date().toISOString() },
            ],
          },
        ],
      }),
    });
  });

  await page.route('**/api/tournaments/t-team/equipes/e-1/unregister', async (route) => {
    unregisterCalls += 1;
    equipeRegistered = false;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'e-1', isRegistered: false }),
    });
  });

  await page.goto('/?view=equipes&tournamentId=t-team');
  await expect(page.getByText('Team One')).toBeVisible();

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole('button', { name: unregisterLabel }).click();

  await expect.poll(() => unregisterCalls).toBe(1);
  await expect(page.getByRole('button', { name: unregisterLabel })).toHaveCount(0);

  equipeRegistered = true;
  await page.goto('/?status=OPEN');
  await expect(page.getByRole('heading', { name: 'Team Open' })).toBeVisible();

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole('button', { name: unregisterLabel }).click();

  await expect.poll(() => unregisterCalls).toBe(2);
});
