import { test, expect, type Page } from '@playwright/test';

type TournamentSummary = {
  id: string;
  name: string;
  format: string;
  status: string;
  totalParticipants: number;
};

const tournaments: TournamentSummary[] = [
  {
    id: 't-open-single',
    name: 'Open Solo Cup',
    format: 'SINGLE',
    status: 'OPEN',
    totalParticipants: 64,
  },
  {
    id: 't-open-double',
    name: 'Open Doublette Cup',
    format: 'DOUBLE',
    status: 'OPEN',
    totalParticipants: 32,
  },
  {
    id: 't-open-team',
    name: 'Open Team Cup',
    format: 'TEAM_4_PLAYER',
    status: 'OPEN',
    totalParticipants: 32,
  },
];

const playersByTournament: Record<string, unknown[]> = {
  't-open-single': [
    {
      playerId: 'pl-1',
      name: 'Camille Robert',
      firstName: 'Camille',
      lastName: 'Robert',
      email: 'camille@example.com',
      skillLevel: 'INTERMEDIATE',
    },
    {
      playerId: 'pl-2',
      name: 'Nina Petit',
      firstName: 'Nina',
      lastName: 'Petit',
      email: 'nina@example.com',
      skillLevel: 'ADVANCED',
    },
  ],
};

const doublettes = [
  {
    id: 'dbl-registered',
    tournamentId: 't-open-double',
    name: 'Les Aigles',
    captainPlayerId: 'pl-20',
    passwordProtected: true,
    isRegistered: true,
    createdAt: new Date().toISOString(),
    memberCount: 2,
    members: [
      { playerId: 'pl-20', firstName: 'Léo', lastName: 'Martin', email: 'leo@example.com' },
      { playerId: 'pl-21', firstName: 'Mila', lastName: 'Bernard', email: 'mila@example.com' },
    ],
  },
  {
    id: 'dbl-open',
    tournamentId: 't-open-double',
    name: 'Les Flèches',
    captainPlayerId: 'pl-22',
    passwordProtected: true,
    isRegistered: false,
    createdAt: new Date().toISOString(),
    memberCount: 1,
    members: [
      { playerId: 'pl-22', firstName: 'Alex', lastName: 'Martin', email: 'alex@example.com' },
    ],
  },
];

const equipes = [
  {
    id: 'eq-registered',
    tournamentId: 't-open-team',
    name: 'Team Phoenix',
    captainPlayerId: 'pl-30',
    passwordProtected: true,
    isRegistered: true,
    createdAt: new Date().toISOString(),
    memberCount: 4,
    members: [
      { playerId: 'pl-30', firstName: 'Tom', lastName: 'Durand', email: 'tom@example.com' },
      { playerId: 'pl-31', firstName: 'Noa', lastName: 'Dupont', email: 'noa@example.com' },
      { playerId: 'pl-32', firstName: 'Zoe', lastName: 'Garnier', email: 'zoe@example.com' },
      { playerId: 'pl-33', firstName: 'Maya', lastName: 'Lambert', email: 'maya@example.com' },
    ],
  },
  {
    id: 'eq-open',
    tournamentId: 't-open-team',
    name: 'Team Horizon',
    captainPlayerId: 'pl-34',
    passwordProtected: true,
    isRegistered: false,
    createdAt: new Date().toISOString(),
    memberCount: 2,
    members: [
      { playerId: 'pl-34', firstName: 'Iris', lastName: 'Moreau', email: 'iris@example.com' },
      { playerId: 'pl-35', firstName: 'Liam', lastName: 'Garcia', email: 'liam@example.com' },
    ],
  },
];

const installApiMocks = async (page: Page) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'player-doc-1',
          email: 'player@example.com',
          name: 'Guide Player',
        },
        isAdmin: false,
      }),
    });
  });

  await page.route('**/api/tournaments**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/api/tournaments') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tournaments }),
      });
      return;
    }

    const playersMatch = /^\/api\/tournaments\/([^/]+)\/players$/.exec(url.pathname);
    if (playersMatch) {
      const tournamentId = playersMatch[1] ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ players: playersByTournament[tournamentId] ?? [] }),
      });
      return;
    }

    const doublettesMatch = /^\/api\/tournaments\/([^/]+)\/doublettes$/.exec(url.pathname);
    if (doublettesMatch) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ doublettes }),
      });
      return;
    }

    const equipesMatch = /^\/api\/tournaments\/([^/]+)\/equipes$/.exec(url.pathname);
    if (equipesMatch) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ equipes }),
      });
      return;
    }

    await route.fallback();
  });
};

test('capture join guide screenshots (simple, doublette, equipe)', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'fr');
  });

  await installApiMocks(page);

  const screenshotsDirectory = '../docs/assets/screenshots';

  await page.setViewportSize({ width: 1500, height: 1000 });

  await page.goto('/?view=registration-players');
  await expect(page.getByText('Tournois individuels')).toBeVisible();
  await page.screenshot({
    path: `${screenshotsDirectory}/rejoindre-tournoi-simple.png`,
    fullPage: true,
  });

  await page.goto('/?view=doublettes&tournamentId=t-open-double');
  await expect(page.getByRole('heading', { name: 'Doublettes' })).toBeVisible();
  await page.getByRole('button', { name: 'Rejoindre' }).first().click();
  await expect(page.getByPlaceholder('Entrez le mot de passe du groupe')).toBeVisible();
  await page.screenshot({
    path: `${screenshotsDirectory}/rejoindre-tournoi-doublette.png`,
    fullPage: true,
  });

  await page.goto('/?view=equipes&tournamentId=t-open-team');
  await expect(page.getByRole('heading', { name: 'Équipes' })).toBeVisible();
  await page.getByRole('button', { name: 'Rejoindre' }).first().click();
  await expect(page.getByPlaceholder('Entrez le mot de passe du groupe')).toBeVisible();
  await page.screenshot({
    path: `${screenshotsDirectory}/rejoindre-tournoi-equipe.png`,
    fullPage: true,
  });
});
