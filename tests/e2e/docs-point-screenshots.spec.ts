import { test, expect, type Page } from '@playwright/test';

type UiLanguage = 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'nl';

const screenshotsDirectory = '../docs/assets/screenshots';
const languages: UiLanguage[] = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl'];

const tournaments = [
  {
    id: 'doc-open-1',
    name: 'Open Solo Cup',
    format: 'SINGLE',
    status: 'OPEN',
    totalParticipants: 64,
  },
  {
    id: 'doc-open-double',
    name: 'Open Doublette Cup',
    format: 'DOUBLE',
    status: 'OPEN',
    totalParticipants: 32,
  },
  {
    id: 'doc-open-team',
    name: 'Open Team Cup',
    format: 'TEAM_4_PLAYER',
    status: 'OPEN',
    totalParticipants: 32,
  },
];

const playersByTournament: Record<string, unknown[]> = {
  'doc-open-1': [
    {
      playerId: 'pl-1',
      name: 'Camille Robert',
      firstName: 'Camille',
      lastName: 'Robert',
      email: 'camille@example.com',
      skillLevel: 'INTERMEDIATE',
    },
  ],
  'doc-open-double': [
    {
      playerId: 'pl-20',
      name: 'Léo Martin',
      firstName: 'Léo',
      lastName: 'Martin',
      email: 'leo@example.com',
    },
  ],
  'doc-open-team': [
    {
      playerId: 'pl-30',
      name: 'Guide Player',
      firstName: 'Guide',
      lastName: 'Player',
      email: 'player@example.com',
    },
    {
      playerId: 'pl-31',
      name: 'Nina Petit',
      firstName: 'Nina',
      lastName: 'Petit',
      email: 'nina@example.com',
    },
    {
      playerId: 'pl-32',
      name: 'Tom Durand',
      firstName: 'Tom',
      lastName: 'Durand',
      email: 'tom@example.com',
    },
    {
      playerId: 'pl-33',
      name: 'Maya Lambert',
      firstName: 'Maya',
      lastName: 'Lambert',
      email: 'maya@example.com',
    },
  ],
};

const doublettes = [
  {
    id: 'dbl-open',
    tournamentId: 'doc-open-double',
    name: 'Les Flèches',
    captainPlayerId: 'pl-20',
    passwordProtected: true,
    isRegistered: false,
    createdAt: new Date().toISOString(),
    memberCount: 1,
    members: [
      { playerId: 'pl-20', firstName: 'Léo', lastName: 'Martin', email: 'leo@example.com' },
    ],
  },
];

const adminLiveView = {
  id: 'doc-live-admin',
  name: 'Open Live Admin',
  format: 'SINGLE',
  status: 'LIVE',
  startTime: new Date().toISOString(),
  targets: [
    {
      id: 'target-1',
      targetNumber: 1,
      status: 'IN_USE',
      currentMatchId: 'm-target-active',
    },
    {
      id: 'target-2',
      targetNumber: 2,
      status: 'FREE',
    },
  ],
  poolStages: [
    {
      id: 'stage-admin-1',
      stageNumber: 1,
      name: 'Phase de poules A',
      status: 'IN_PROGRESS',
      poolCount: 1,
      playersPerPool: 3,
      advanceCount: 2,
      rankingDestinations: [
        { position: 1, destinationType: 'BRACKET', bracketId: 'bracket-admin-1' },
        { position: 2, destinationType: 'BRACKET', bracketId: 'bracket-admin-1' },
        { position: 3, destinationType: 'ELIMINATED' },
      ],
      pools: [
        {
          id: 'pool-admin-1',
          poolNumber: 1,
          name: 'Poule 1',
          status: 'IN_PROGRESS',
          assignments: [
            {
              id: 'ass-admin-1',
              player: { id: 'pla', firstName: 'Alex', lastName: 'Martin' },
            },
            {
              id: 'ass-admin-2',
              player: { id: 'plb', firstName: 'Brice', lastName: 'Dupont' },
            },
            {
              id: 'ass-admin-3',
              player: { id: 'plc', firstName: 'Chloe', lastName: 'Bernard' },
            },
          ],
          matches: [
            {
              id: 'm-pool-1',
              matchNumber: 1,
              roundNumber: 1,
              status: 'COMPLETED',
              playerMatches: [
                { playerPosition: 1, player: { id: 'pla', firstName: 'Alex', lastName: 'Martin' }, scoreTotal: 2 },
                { playerPosition: 2, player: { id: 'plb', firstName: 'Brice', lastName: 'Dupont' }, scoreTotal: 1 },
              ],
            },
            {
              id: 'm-pool-2',
              matchNumber: 2,
              roundNumber: 1,
              status: 'COMPLETED',
              playerMatches: [
                { playerPosition: 1, player: { id: 'plb', firstName: 'Brice', lastName: 'Dupont' }, scoreTotal: 2 },
                { playerPosition: 2, player: { id: 'plc', firstName: 'Chloe', lastName: 'Bernard' }, scoreTotal: 0 },
              ],
            },
            {
              id: 'm-pool-3',
              matchNumber: 3,
              roundNumber: 1,
              status: 'COMPLETED',
              playerMatches: [
                { playerPosition: 1, player: { id: 'plc', firstName: 'Chloe', lastName: 'Bernard' }, scoreTotal: 2 },
                { playerPosition: 2, player: { id: 'pla', firstName: 'Alex', lastName: 'Martin' }, scoreTotal: 0 },
              ],
            },
            {
              id: 'm-pool-queue',
              matchNumber: 4,
              roundNumber: 2,
              status: 'SCHEDULED',
              playerMatches: [
                { playerPosition: 1, player: { id: 'pla', firstName: 'Alex', lastName: 'Martin' }, scoreTotal: 0 },
                { playerPosition: 2, player: { id: 'plb', firstName: 'Brice', lastName: 'Dupont' }, scoreTotal: 0 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'stage-admin-2',
      stageNumber: 2,
      name: 'Phase de poules B',
      status: 'COMPLETED',
      poolCount: 1,
      playersPerPool: 2,
      advanceCount: 2,
      rankingDestinations: [
        { position: 1, destinationType: 'BRACKET', bracketId: 'bracket-admin-1' },
        { position: 2, destinationType: 'BRACKET', bracketId: 'bracket-admin-1' },
      ],
      pools: [],
    },
  ],
  brackets: [
    {
      id: 'bracket-admin-1',
      name: 'Winner bracket',
      bracketType: 'WINNER',
      status: 'IN_PROGRESS',
      totalRounds: 2,
      targetIds: ['target-1', 'target-2'],
      entries: [
        { id: 'entry-1', seedNumber: 1, player: { id: 'pla', firstName: 'Alex', lastName: 'Martin' } },
        { id: 'entry-2', seedNumber: 2, player: { id: 'plb', firstName: 'Brice', lastName: 'Dupont' } },
        { id: 'entry-3', seedNumber: 3, player: { id: 'plc', firstName: 'Chloe', lastName: 'Bernard' } },
      ],
      matches: [
        {
          id: 'm-target-active',
          matchNumber: 5,
          roundNumber: 1,
          status: 'IN_PROGRESS',
          targetId: 'target-1',
          target: { id: 'target-1', targetNumber: 1 },
          playerMatches: [
            { playerPosition: 1, player: { id: 'pla', firstName: 'Alex', lastName: 'Martin' }, scoreTotal: 2 },
            { playerPosition: 2, player: { id: 'plb', firstName: 'Brice', lastName: 'Dupont' }, scoreTotal: 1 },
          ],
        },
        {
          id: 'm-target-queue',
          matchNumber: 6,
          roundNumber: 1,
          status: 'SCHEDULED',
          playerMatches: [
            { playerPosition: 1, player: { id: 'plb', firstName: 'Brice', lastName: 'Dupont' }, scoreTotal: 0 },
            { playerPosition: 2, player: { id: 'plc', firstName: 'Chloe', lastName: 'Bernard' }, scoreTotal: 0 },
          ],
        },
      ],
    },
  ],
};

const equipes = [
  {
    id: 'eq-ready-doc',
    tournamentId: 'doc-open-team',
    name: 'Team Guide',
    captainPlayerId: 'pl-30',
    passwordProtected: true,
    isRegistered: false,
    createdAt: new Date().toISOString(),
    memberCount: 4,
    members: [
      { playerId: 'pl-30', firstName: 'Guide', lastName: 'Player', email: 'player@example.com' },
      { playerId: 'pl-31', firstName: 'Nina', lastName: 'Petit', email: 'nina@example.com' },
      { playerId: 'pl-32', firstName: 'Tom', lastName: 'Durand', email: 'tom@example.com' },
      { playerId: 'pl-33', firstName: 'Maya', lastName: 'Lambert', email: 'maya@example.com' },
    ],
  },
];

const installCommonTournamentMocks = async (page: Page) => {
  await page.route('**/api/tournaments**', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname === '/api/tournaments/live-summary') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tournaments: [adminLiveView] }),
      });
      return;
    }

    const liveViewMatch = /^\/api\/tournaments\/([^/]+)\/live$/.exec(requestUrl.pathname);
    if (liveViewMatch) {
      const tournamentId = liveViewMatch[1] ?? '';
      if (tournamentId === adminLiveView.id) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(adminLiveView),
        });
        return;
      }
    }

    if (requestUrl.pathname === '/api/tournaments') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tournaments }),
      });
      return;
    }

    const playersMatch = /^\/api\/tournaments\/([^/]+)\/players$/.exec(requestUrl.pathname);
    if (playersMatch) {
      const tournamentId = playersMatch[1] ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ players: playersByTournament[tournamentId] ?? [] }),
      });
      return;
    }

    const doublettesMatch = /^\/api\/tournaments\/([^/]+)\/doublettes$/.exec(requestUrl.pathname);
    if (doublettesMatch) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ doublettes }),
      });
      return;
    }

    const equipesMatch = /^\/api\/tournaments\/([^/]+)\/equipes$/.exec(requestUrl.pathname);
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

const installAnonymousApiMocks = async (page: Page) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unauthorized' }),
    });
  });
};

const installPlayerApiMocks = async (page: Page) => {
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
};

const installAdminApiMocks = async (page: Page) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'admin-doc-1',
          email: 'admin@example.com',
          name: 'Guide Admin',
        },
        isAdmin: true,
      }),
    });
  });

  await page.route('**/api/tournament-presets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        presets: [
          {
            id: 'preset-admin-1',
            name: 'Preset championnat',
            presetType: 'custom',
            totalParticipants: 16,
            targetCount: 4,
            isSystem: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            templateConfig: {
              format: 'SINGLE',
              stages: [
                { name: 'Phase 1', poolCount: 4, playersPerPool: 4, advanceCount: 2 },
              ],
              brackets: [
                { name: 'Winner bracket', totalRounds: 3 },
              ],
              routingRules: [
                { stageNumber: 1, position: 1, destinationType: 'BRACKET', destinationBracketName: 'Winner bracket' },
                { stageNumber: 1, position: 2, destinationType: 'BRACKET', destinationBracketName: 'Winner bracket' },
                { stageNumber: 1, position: 3, destinationType: 'ELIMINATED' },
                { stageNumber: 1, position: 4, destinationType: 'ELIMINATED' },
              ],
            },
          },
        ],
      }),
    });
  });

  await page.route('**/api/match-format-presets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        presets: [
          {
            id: 'format-admin-1',
            key: 'BO5_501',
            durationMinutes: 25,
            segments: [
              { game: '501_DO', targetCount: 1 },
              { game: 'CRICKET', targetCount: 1 },
            ],
            isSystem: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    });
  });
};

test('capture point-related screenshots for docs steps across languages', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await installCommonTournamentMocks(page);

  await installAnonymousApiMocks(page);

  for (const lang of languages) {
    await page.goto('/?status=OPEN');
    await page.evaluate((selectedLang) => {
      localStorage.setItem('lang', selectedLang);
    }, lang);

    await page.goto('/?status=OPEN');
    await expect(page).toHaveURL(/\?status=OPEN/);
    await page.screenshot({
      path: `${screenshotsDirectory}/doc-anonyme-vues-${lang}.png`,
      fullPage: true,
    });

    await page.goto('/?view=registration-players');
    await expect(page).toHaveURL(/\?view=registration-players/);
    await page.screenshot({
      path: `${screenshotsDirectory}/doc-anonyme-inscrits-${lang}.png`,
      fullPage: true,
    });

    await page.goto('/?view=account');
    await expect(page).toHaveURL(/\?view=account/);
    await page.screenshot({
      path: `${screenshotsDirectory}/doc-anonyme-connexion-${lang}.png`,
      fullPage: true,
    });
  }

  await page.unroute('**/api/auth/me');
  await installPlayerApiMocks(page);

  for (const lang of languages) {
    await page.goto('/?view=registration-players');
    await page.evaluate((selectedLang) => {
      localStorage.setItem('lang', selectedLang);
    }, lang);

    await page.goto('/?view=registration-players');
    await expect(page).toHaveURL(/\?view=registration-players/);
    await page.screenshot({
      path: `${screenshotsDirectory}/doc-joueur-simple-${lang}.png`,
      fullPage: true,
    });

    await page.goto('/?view=doublettes&tournamentId=doc-open-double');
    await expect(page).toHaveURL(/\?view=doublettes/);
    await expect(page.locator('main')).toBeVisible();
    await page.screenshot({
      path: `${screenshotsDirectory}/doc-joueur-doublette-${lang}.png`,
      fullPage: true,
    });

    await page.goto('/?view=equipes&tournamentId=doc-open-team');
    await expect(page).toHaveURL(/\?view=equipes/);
    await expect(page.locator('main')).toBeVisible();
    await page.screenshot({
      path: `${screenshotsDirectory}/doc-joueur-validation-${lang}.png`,
      fullPage: true,
    });
  }

  await page.unroute('**/api/auth/me');
  await installAdminApiMocks(page);

  for (const lang of languages) {
    await page.goto('/?view=create-tournament');
    await page.evaluate((selectedLang) => {
      localStorage.setItem('lang', selectedLang);
    }, lang);
    await page.goto('/?view=create-tournament');
    await expect(page).toHaveURL(/\?view=create-tournament/);
    await page.screenshot({
      path: `${screenshotsDirectory}/doc-admin-creation-${lang}.png`,
      fullPage: true,
    });

    await page.goto('/?view=pool-stages&tournamentId=doc-live-admin');
    await expect(page).toHaveURL(/\?view=pool-stages/);
    await page.screenshot({
      path: `${screenshotsDirectory}/doc-admin-poules-${lang}.png`,
      fullPage: true,
    });

    await page.goto('/?view=brackets&tournamentId=doc-live-admin');
    await expect(page).toHaveURL(/\?view=brackets/);
    await page.screenshot({
      path: `${screenshotsDirectory}/doc-admin-arbres-${lang}.png`,
      fullPage: true,
    });

    await page.goto('/?view=pool-stages&tournamentId=doc-live-admin');
    await expect(page).toHaveURL(/\?view=pool-stages/);
    const headToHeadBonus = page.locator('span', { hasText: '(+1)' }).first();
    await expect(headToHeadBonus).toBeVisible();
    await headToHeadBonus.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${screenshotsDirectory}/doc-admin-leaderboard-${lang}.png`,
      fullPage: false,
    });

    await page.goto('/?view=tournament-preset-editor');
    await expect(page).toHaveURL(/\?view=tournament-preset-editor/);
    await page.screenshot({
      path: `${screenshotsDirectory}/doc-admin-presets-${lang}.png`,
      fullPage: true,
    });

    await page.goto('/?view=match-formats');
    await expect(page).toHaveURL(/\?view=match-formats/);
    await page.screenshot({
      path: `${screenshotsDirectory}/doc-admin-formats-${lang}.png`,
      fullPage: true,
    });

    await page.goto('/?view=targets&tournamentId=doc-live-admin');
    await expect(page).toHaveURL(/\?view=targets/);
    await page.screenshot({
      path: `${screenshotsDirectory}/doc-admin-cibles-${lang}.png`,
      fullPage: true,
    });
  }
});
