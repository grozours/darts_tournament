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
    id: 't-team-create',
    name: 'Team Create Cup',
    format: 'TEAM_4_PLAYER',
    status: 'OPEN',
    totalParticipants: 16,
  },
  {
    id: 't-team-ready',
    name: 'Team Ready Cup',
    format: 'TEAM_4_PLAYER',
    status: 'OPEN',
    totalParticipants: 16,
  },
];

const playersByTournament: Record<string, unknown[]> = {
  't-team-create': [
    {
      playerId: 'pl-doc-create',
      name: 'Guide Player',
      firstName: 'Guide',
      lastName: 'Player',
      email: 'player@example.com',
    },
  ],
  't-team-ready': [
    {
      playerId: 'pl-ready-captain',
      name: 'Guide Player',
      firstName: 'Guide',
      lastName: 'Player',
      email: 'player@example.com',
    },
    {
      playerId: 'pl-ready-2',
      name: 'Nina Petit',
      firstName: 'Nina',
      lastName: 'Petit',
      email: 'nina@example.com',
    },
    {
      playerId: 'pl-ready-3',
      name: 'Tom Durand',
      firstName: 'Tom',
      lastName: 'Durand',
      email: 'tom@example.com',
    },
    {
      playerId: 'pl-ready-4',
      name: 'Maya Lambert',
      firstName: 'Maya',
      lastName: 'Lambert',
      email: 'maya@example.com',
    },
  ],
};

const equipesByTournament: Record<string, unknown[]> = {
  't-team-create': [
    {
      id: 'eq-other-create',
      tournamentId: 't-team-create',
      name: 'Team Orion',
      captainPlayerId: 'pl-orion-1',
      passwordProtected: true,
      isRegistered: false,
      createdAt: new Date().toISOString(),
      memberCount: 2,
      members: [
        { playerId: 'pl-orion-1', firstName: 'Alex', lastName: 'Martin', email: 'alex@example.com' },
        { playerId: 'pl-orion-2', firstName: 'Lina', lastName: 'Roux', email: 'lina@example.com' },
      ],
    },
  ],
  't-team-ready': [
    {
      id: 'eq-ready-doc',
      tournamentId: 't-team-ready',
      name: 'Team Guide',
      captainPlayerId: 'pl-ready-captain',
      passwordProtected: true,
      isRegistered: false,
      createdAt: new Date().toISOString(),
      memberCount: 4,
      members: [
        { playerId: 'pl-ready-captain', firstName: 'Guide', lastName: 'Player', email: 'player@example.com' },
        { playerId: 'pl-ready-2', firstName: 'Nina', lastName: 'Petit', email: 'nina@example.com' },
        { playerId: 'pl-ready-3', firstName: 'Tom', lastName: 'Durand', email: 'tom@example.com' },
        { playerId: 'pl-ready-4', firstName: 'Maya', lastName: 'Lambert', email: 'maya@example.com' },
      ],
    },
  ],
};

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

    const equipesMatch = /^\/api\/tournaments\/([^/]+)\/equipes$/.exec(url.pathname);
    if (equipesMatch) {
      const tournamentId = equipesMatch[1] ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ equipes: equipesByTournament[tournamentId] ?? [] }),
      });
      return;
    }

    await route.fallback();
  });
};

test('capture team registration and management screenshots', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'fr');
  });

  await installApiMocks(page);

  const screenshotsDirectory = '../docs/assets/screenshots';

  await page.setViewportSize({ width: 1500, height: 1000 });

  await page.goto('/?status=OPEN');
  await expect(page.getByRole('link', { name: 'Créer son équipe' })).toBeVisible();
  await expect(page.getByRole('button', { name: "S'inscrire" })).toBeVisible();
  await page.screenshot({
    path: `${screenshotsDirectory}/inscription-equipe-carte.png`,
    fullPage: true,
  });

  await page.goto('/?view=equipes&tournamentId=t-team-ready');
  await expect(page.getByRole('heading', { name: 'Équipes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inscrire le groupe' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter membre' })).toBeHidden();
  await page.screenshot({
    path: `${screenshotsDirectory}/gerer-equipe-actions.png`,
    fullPage: true,
  });
});
