import { test, expect } from '@playwright/test';

test('pool stages view renders live pool stages', async ({ page }) => {
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
              { id: 'target-1', targetNumber: 1, targetCode: 'T1', status: 'AVAILABLE' },
            ],
            poolStages: [
              {
                id: 'stage-1',
                stageNumber: 1,
                name: 'Main Stage',
                status: 'IN_PROGRESS',
                playersPerPool: 2,
                pools: [
                  {
                    id: 'pool-1',
                    poolNumber: 1,
                    name: 'Pool A',
                    status: 'IN_PROGRESS',
                    assignments: [
                      {
                        id: 'assignment-1',
                        player: { id: 'player-1', firstName: 'Alice', lastName: 'Ace' },
                      },
                      {
                        id: 'assignment-2',
                        player: { id: 'player-2', firstName: 'Bob', lastName: 'Bull' },
                      },
                    ],
                    matches: [
                      {
                        id: 'match-1',
                        matchNumber: 1,
                        roundNumber: 1,
                        status: 'SCHEDULED',
                        playerMatches: [
                          {
                            player: { id: 'player-1', firstName: 'Alice', lastName: 'Ace' },
                            playerPosition: 1,
                          },
                          {
                            player: { id: 'player-2', firstName: 'Bob', lastName: 'Bull' },
                            playerPosition: 2,
                          },
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

  await page.goto('/?view=pool-stages&status=LIVE');

  await expect(page.getByText('Main Stage')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pool 1 of 1: Pool A' })).toBeVisible();
});

test('pool stages view shows stopwatch timing tooltip on tournament card', async ({ page }) => {
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
            startTime: '2026-04-10T10:00:00.000Z',
            targets: [
              { id: 'target-1', targetNumber: 1, targetCode: 'T1', status: 'AVAILABLE' },
            ],
            poolStages: [
              {
                id: 'stage-1',
                stageNumber: 1,
                name: 'Main Stage',
                status: 'IN_PROGRESS',
                playersPerPool: 2,
                pools: [
                  {
                    id: 'pool-1',
                    poolNumber: 1,
                    name: 'Pool A',
                    status: 'IN_PROGRESS',
                    assignments: [
                      {
                        id: 'assignment-1',
                        player: { id: 'player-1', firstName: 'Alice', lastName: 'Ace' },
                      },
                      {
                        id: 'assignment-2',
                        player: { id: 'player-2', firstName: 'Bob', lastName: 'Bull' },
                      },
                    ],
                    matches: [
                      {
                        id: 'match-1',
                        matchNumber: 1,
                        roundNumber: 1,
                        status: 'SCHEDULED',
                        playerMatches: [
                          {
                            player: { id: 'player-1', firstName: 'Alice', lastName: 'Ace' },
                            playerPosition: 1,
                          },
                          {
                            player: { id: 'player-2', firstName: 'Bob', lastName: 'Bull' },
                            playerPosition: 2,
                          },
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

  await page.goto('/?view=pool-stages&status=LIVE');

  const stopwatch = page.locator('span[aria-label*="Estimated duration"]').first();
  await expect(stopwatch).toBeVisible();
  await expect(stopwatch).toHaveText('⏱️');
  await expect(stopwatch).toHaveAttribute('title', /Estimated duration:/);
  await expect(stopwatch).toHaveAttribute('title', /Start:/);
});

test('screen mode centers active bracket section', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'en');

    const calls: Array<{
      id: string;
      block?: ScrollLogicalPosition;
      inline?: ScrollLogicalPosition;
      behavior?: ScrollBehavior;
    }> = [];
    (globalThis as unknown as { __scrollIntoViewCalls?: typeof calls }).__scrollIntoViewCalls = calls;

    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function patchedScrollIntoView(arg?: boolean | ScrollIntoViewOptions) {
      const options = typeof arg === 'object' && arg ? arg : undefined;
      calls.push({
        id: (this as HTMLElement).id || '',
        block: options?.block,
        inline: options?.inline,
        behavior: options?.behavior,
      });
      original.call(this, arg as boolean & ScrollIntoViewOptions);
    };
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

  const liveView = {
    id: 'tournament-1',
    name: 'Live Tournament',
    format: 'SINGLE',
    status: 'LIVE',
    targets: [],
    poolStages: [
      {
        id: 'stage-1',
        stageNumber: 1,
        name: 'Main Stage',
        status: 'COMPLETED',
        poolCount: 1,
        playersPerPool: 2,
        advanceCount: 1,
        pools: [],
      },
    ],
    brackets: [
      {
        id: 'bracket-1',
        name: 'Bracket One',
        bracketType: 'WINNER',
        status: 'IN_PROGRESS',
        totalRounds: 2,
        entries: [
          { id: 'entry-1', seedNumber: 1, player: { id: 'player-1', firstName: 'Alice', lastName: 'Ace' } },
          { id: 'entry-2', seedNumber: 2, player: { id: 'player-2', firstName: 'Bob', lastName: 'Bull' } },
        ],
        matches: [
          {
            id: 'match-1',
            matchNumber: 1,
            roundNumber: 1,
            status: 'IN_PROGRESS',
            playerMatches: [
              { playerPosition: 1, player: { id: 'player-1', firstName: 'Alice', lastName: 'Ace' }, scoreTotal: 1 },
              { playerPosition: 2, player: { id: 'player-2', firstName: 'Bob', lastName: 'Bull' }, scoreTotal: 0 },
            ],
          },
        ],
      },
      {
        id: 'bracket-2',
        name: 'Bracket Two',
        bracketType: 'LOSER',
        status: 'IN_PROGRESS',
        totalRounds: 2,
        entries: [
          { id: 'entry-3', seedNumber: 3, player: { id: 'player-3', firstName: 'Cleo', lastName: 'Check' } },
          { id: 'entry-4', seedNumber: 4, player: { id: 'player-4', firstName: 'Duke', lastName: 'Dart' } },
        ],
        matches: [
          {
            id: 'match-2',
            matchNumber: 2,
            roundNumber: 1,
            status: 'SCHEDULED',
            playerMatches: [
              { playerPosition: 1, player: { id: 'player-3', firstName: 'Cleo', lastName: 'Check' }, scoreTotal: 0 },
              { playerPosition: 2, player: { id: 'player-4', firstName: 'Duke', lastName: 'Dart' }, scoreTotal: 0 },
            ],
          },
        ],
      },
    ],
  };

  await page.route(/\/api\/tournaments\/live-summary\?statuses=LIVE(?:&.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tournaments: [liveView] }),
    });
  });

  await page.route('**/api/tournaments/tournament-1/live', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(liveView),
    });
  });

  await page.goto('/?view=brackets&status=LIVE&screen=1&tournamentId=tournament-1&bracketId=bracket-2');
  await expect(page.locator('#bracket-tournament-1-bracket-2')).toBeVisible();

  await expect
    .poll(async () => page.evaluate(() => {
      const bucket = (globalThis as unknown as {
        __scrollIntoViewCalls?: Array<{ id: string; block?: string }>;
      }).__scrollIntoViewCalls ?? [];
      return bucket.some((call) => call.id === 'bracket-tournament-1-bracket-2' && call.block === 'center');
    }))
    .toBe(true);
});

test('screen mode rotates across multiple live tournaments', async ({ page }) => {
  test.setTimeout(80_000);

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

  const liveTournaments = [
    {
      id: 'tournament-a',
      name: 'Live A',
      format: 'SINGLE',
      status: 'LIVE',
      targets: [],
      poolStages: [
        {
          id: 'stage-a1',
          stageNumber: 1,
          name: 'Stage A1',
          status: 'IN_PROGRESS',
          poolCount: 1,
          playersPerPool: 2,
          pools: [],
        },
      ],
      brackets: [],
    },
    {
      id: 'tournament-b',
      name: 'Live B',
      format: 'SINGLE',
      status: 'LIVE',
      targets: [],
      poolStages: [
        {
          id: 'stage-b1',
          stageNumber: 1,
          name: 'Stage B1',
          status: 'IN_PROGRESS',
          poolCount: 1,
          playersPerPool: 2,
          pools: [],
        },
      ],
      brackets: [],
    },
    {
      id: 'tournament-c',
      name: 'Live C',
      format: 'SINGLE',
      status: 'LIVE',
      targets: [],
      poolStages: [
        {
          id: 'stage-c1',
          stageNumber: 1,
          name: 'Stage C1',
          status: 'IN_PROGRESS',
          poolCount: 1,
          playersPerPool: 2,
          pools: [],
        },
      ],
      brackets: [],
    },
  ];

  await page.route('**/api/tournaments/live-summary**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tournaments: liveTournaments }),
    });
  });

  await page.route(/\/api\/tournaments\/([^/]+)\/live$/, async (route) => {
    const match = /\/api\/tournaments\/([^/]+)\/live$/.exec(route.request().url());
    const tournamentId = match?.[1] ?? '';
    const view = liveTournaments.find((item) => item.id === tournamentId) ?? liveTournaments[0];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(view),
    });
  });

  await page.goto('/?screen=1&status=LIVE');

  await expect(page).toHaveURL(/tournamentId=tournament-a/, { timeout: 15_000 });
  await expect(page).toHaveURL(/tournamentId=tournament-b/, { timeout: 30_000 });
  await expect(page).toHaveURL(/tournamentId=tournament-c/, { timeout: 45_000 });
});
