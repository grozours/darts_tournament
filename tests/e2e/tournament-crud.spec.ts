import { test, expect } from '@playwright/test';

type TournamentEntity = {
  id: string;
  name: string;
  location?: string;
  format: string;
  durationType: string;
  startTime: string;
  endTime: string;
  totalParticipants: number;
  targetCount: number;
  targetStartNumber: number;
  shareTargets: boolean;
  status: string;
};

test('UI tournament CRUD: create, edit and delete', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'en');
  });

  let tournaments: TournamentEntity[] = [];
  let sequence = 1;

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

  await page.route('**/api/tournaments/presets', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ presets: [] }),
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/tournaments/*/pool-stages', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ poolStages: [] }),
    });
  });

  await page.route('**/api/tournaments/*/brackets', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ brackets: [] }),
    });
  });

  await page.route('**/api/tournaments/*/targets', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ targets: [] }),
    });
  });

  await page.route('**/api/tournaments/*/players', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ players: [] }),
    });
  });

  await page.route(/\/api\/tournaments\/[^/?]+$/, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const tournamentId = url.pathname.split('/').at(-1);
    const tournament = tournaments.find((item) => item.id === tournamentId);

    if (method === 'GET') {
      if (!tournament) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not found' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(tournament),
      });
      return;
    }

    if (method === 'PUT') {
      if (!tournament) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not found' }),
        });
        return;
      }
      const payload = request.postDataJSON() as Partial<TournamentEntity>;
      const updated = { ...tournament, ...payload };
      tournaments = tournaments.map((item) => (item.id === tournament.id ? updated : item));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated),
      });
      return;
    }

    if (method === 'DELETE') {
      tournaments = tournaments.filter((item) => item.id !== tournamentId);
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    await route.continue();
  });

  await page.route('**/api/tournaments', async (route) => {
    const request = route.request();
    const method = request.method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tournaments }),
      });
      return;
    }

    if (method === 'POST') {
      const payload = request.postDataJSON() as Partial<TournamentEntity>;
      const created: TournamentEntity = {
        id: `e2e-tournament-${sequence++}`,
        name: payload.name ?? 'Tournament',
        location: payload.location,
        format: payload.format ?? 'SINGLE',
        durationType: payload.durationType ?? 'FULL_DAY',
        startTime: payload.startTime ?? new Date().toISOString(),
        endTime: payload.endTime ?? new Date().toISOString(),
        totalParticipants: Number(payload.totalParticipants ?? 16),
        targetCount: Number(payload.targetCount ?? 2),
        targetStartNumber: Number(payload.targetStartNumber ?? 1),
        shareTargets: Boolean(payload.shareTargets ?? true),
        status: 'DRAFT',
      };
      tournaments = [created, ...tournaments];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    await route.continue();
  });

  const createdName = 'E2E Tournament CRUD';
  const updatedName = 'E2E Tournament CRUD Updated';

  await page.goto('/?view=create-tournament');
  await page.waitForLoadState('networkidle');

  await page.fill('#tournament-name', createdName);
  await page.selectOption('#tournament-format', 'SINGLE');
  await page.selectOption('#duration-type', 'FULL_DAY');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 20);
  const endDate = new Date(startDate.getTime() + 4 * 60 * 60 * 1000);

  await page.fill('#start-time', startDate.toISOString().slice(0, 16));
  await page.fill('#end-time', endDate.toISOString().slice(0, 16));
  await page.fill('#total-participants', '16');
  await page.fill('#target-count', '3');

  await page.getByRole('button', { name: /create tournament/i }).click();
  await page.waitForURL('**/?status=DRAFT');

  expect(tournaments).toHaveLength(1);

  await page.goto('/?status=DRAFT');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: createdName })).toBeVisible();

  const createdCard = page.locator('div').filter({ has: page.getByRole('heading', { name: createdName }) }).first();
  await createdCard.getByRole('button', { name: 'Edit' }).click();

  await expect(page).toHaveURL(/view=edit-tournament/);
  await page.getByRole('textbox', { name: /^Name$/ }).fill(updatedName);

  const updateRequest = page.waitForResponse((response) => (
    /\/api\/tournaments\/e2e-tournament-\d+$/.test(response.url())
    && response.request().method() === 'PUT'
  ));

  await page.getByRole('button', { name: 'Save changes' }).click();
  await updateRequest;

  await page.goto('/?status=DRAFT');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: new RegExp(`^${updatedName}$`) })).toBeVisible();
  await expect(page.getByRole('heading', { name: new RegExp(`^${createdName}$`) })).toHaveCount(0);

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });

  const updatedCard = page.locator('div').filter({ has: page.getByRole('heading', { name: updatedName }) }).first();
  await updatedCard.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('heading', { name: updatedName })).toHaveCount(0);
  expect(tournaments).toHaveLength(0);
});
