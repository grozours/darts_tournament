import { expect, test, type Page } from '@playwright/test';

type ModeConfiguration = {
  view: 'doublettes' | 'equipes';
  requiredMembers: number;
  listKey: 'doublettes' | 'equipes';
  registerButtonLabel: RegExp;
};

type GroupMember = {
  playerId: string;
  firstName: string;
  lastName: string;
  email: string;
  joinedAt: string;
};

type GroupEntity = {
  id: string;
  name: string;
  captainPlayerId: string;
  isRegistered: boolean;
  createdAt: string;
  members: GroupMember[];
};

const tournamentId = '11111111-1111-4111-8111-111111111111';

const modeConfigurations: ModeConfiguration[] = [
  {
    view: 'doublettes',
    requiredMembers: 2,
    listKey: 'doublettes',
    registerButtonLabel: /Register doublette|Inscrire une doublette/i,
  },
  {
    view: 'equipes',
    requiredMembers: 4,
    listKey: 'equipes',
    registerButtonLabel: /Register team|Inscrire une équipe/i,
  },
];

const joinLabel = /Join|Rejoindre/i;
const editLabel = /Edit|Modifier/i;
const saveLabel = /Save|Enregistrer/i;
const createLabel = /Create|Créer/i;
const unregisterLabel = /Unregister|désinscrire/i;

const createMember = (playerId: string, email: string, firstName: string, lastName: string): GroupMember => ({
  playerId,
  email,
  firstName,
  lastName,
  joinedAt: new Date().toISOString(),
});

const toResponseGroup = (group: GroupEntity) => ({
  ...group,
  memberCount: group.members.length,
});

const escapeRegex = (value: string): string => value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const installCommonAuthRoutes = async (
  page: Page,
  profile: { id: string; email: string; name: string; isAdmin: boolean }
) => {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'en');
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: profile.id, email: profile.email, name: profile.name },
        isAdmin: profile.isAdmin,
      }),
    });
  });

  await page.route(`**/api/tournaments/${tournamentId}/players`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        players: [
          {
            playerId: profile.id,
            firstName: profile.name,
            lastName: 'User',
            email: profile.email,
          },
        ],
      }),
    });
  });
};

const installGroupRoutes = async (
  page: Page,
  configuration: ModeConfiguration,
  groups: GroupEntity[],
  actor: { id: string; email: string; firstName: string; lastName: string }
) => {
  let sequence = 1;

  const basePath = `/api/tournaments/${tournamentId}/${configuration.view}`;
  const escapedBasePath = escapeRegex(basePath);

  const listPattern = new RegExp(String.raw`${escapedBasePath}(\?.*)?$`);
  const joinPattern = new RegExp(String.raw`${escapedBasePath}/[^/?]+/join(\?.*)?$`);
  const registerPattern = new RegExp(String.raw`${escapedBasePath}/[^/?]+/register(\?.*)?$`);
  const unregisterPattern = new RegExp(String.raw`${escapedBasePath}/[^/?]+/unregister(\?.*)?$`);
  const patchPattern = new RegExp(String.raw`${escapedBasePath}/[^/?]+(\?.*)?$`);

  await page.route(listPattern, async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          [configuration.listKey]: groups.map(toResponseGroup),
        }),
      });
      return;
    }

    if (method === 'POST') {
      const payload = route.request().postDataJSON() as { name?: string };
      const idPrefix = configuration.view === 'doublettes' ? 'd' : 'e';
      const created: GroupEntity = {
        id: `${idPrefix}-${sequence++}`,
        name: payload.name ?? `${idPrefix.toUpperCase()} Group`,
        captainPlayerId: actor.id,
        isRegistered: false,
        createdAt: new Date().toISOString(),
        members: [createMember(actor.id, actor.email, actor.firstName, actor.lastName)],
      };

      groups.unshift(created);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(toResponseGroup(created)),
      });
      return;
    }

    await route.continue();
  });

  await page.route(joinPattern, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const groupId = path.split('/').at(-2) ?? '';
    const group = groups.find((entry) => entry.id === groupId);

    if (!group) {
      await route.fulfill({ status: 404, body: JSON.stringify({ error: 'Not found' }) });
      return;
    }

    const isAlreadyMember = group.members.some((member) => member.playerId === actor.id);
    if (!isAlreadyMember) {
      group.members.push(createMember(actor.id, actor.email, actor.firstName, actor.lastName));
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(toResponseGroup(group)),
    });
  });

  await page.route(registerPattern, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const groupId = path.split('/').at(-2) ?? '';
    const group = groups.find((entry) => entry.id === groupId);

    if (!group) {
      await route.fulfill({ status: 404, body: JSON.stringify({ error: 'Not found' }) });
      return;
    }

    group.isRegistered = true;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(toResponseGroup(group)),
    });
  });

  await page.route(unregisterPattern, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const groupId = path.split('/').at(-2) ?? '';
    const group = groups.find((entry) => entry.id === groupId);

    if (!group) {
      await route.fulfill({ status: 404, body: JSON.stringify({ error: 'Not found' }) });
      return;
    }

    group.isRegistered = false;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(toResponseGroup(group)),
    });
  });

  await page.route(patchPattern, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.continue();
      return;
    }

    const path = new URL(route.request().url()).pathname;
    const groupId = path.split('/').at(-1) ?? '';
    const group = groups.find((entry) => entry.id === groupId);

    if (!group) {
      await route.fulfill({ status: 404, body: JSON.stringify({ error: 'Not found' }) });
      return;
    }

    const payload = route.request().postDataJSON() as { name?: string };
    if (payload.name?.trim()) {
      group.name = payload.name.trim();
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(toResponseGroup(group)),
    });
  });
};

for (const configuration of modeConfigurations) {
  test.describe(`${configuration.view} targeted UI flows`, () => {
    test('player profile: creates a group', async ({ page }) => {
      await installCommonAuthRoutes(page, {
        id: 'p-player',
        email: 'player@example.com',
        name: 'Player',
        isAdmin: false,
      });

      const groups: GroupEntity[] = [];
      await installGroupRoutes(page, configuration, groups, {
        id: 'p-player',
        email: 'player@example.com',
        firstName: 'Player',
        lastName: 'One',
      });

      await page.goto(`/?view=${configuration.view}&tournamentId=${tournamentId}`);
      await expect(page.getByText(/No group found|Aucun groupe/i)).toBeVisible();

      await page.getByPlaceholder(/^Group name$|^Nom du groupe$/i).fill('My Group');
      await page.getByPlaceholder(/^Group password$|^Mot de passe du groupe$/i).fill('secret');
      await page.getByRole('button', { name: createLabel }).click();

      await expect(page.getByText('My Group')).toBeVisible();
      await expect.poll(() => groups.length).toBe(1);
    });

    test('player profile: joins an existing group', async ({ page }) => {
      await installCommonAuthRoutes(page, {
        id: 'p-player',
        email: 'player@example.com',
        name: 'Player',
        isAdmin: false,
      });

      const groups: GroupEntity[] = [
        {
          id: configuration.view === 'doublettes' ? 'd-join' : 'e-join',
          name: 'Join Group',
          captainPlayerId: 'p-captain',
          isRegistered: false,
          createdAt: new Date().toISOString(),
          members: [createMember('p-captain', 'captain@example.com', 'Cap', 'Tain')],
        },
      ];

      await installGroupRoutes(page, configuration, groups, {
        id: 'p-player',
        email: 'player@example.com',
        firstName: 'Player',
        lastName: 'One',
      });

      await page.goto(`/?view=${configuration.view}&tournamentId=${tournamentId}`);
      await expect(page.getByText('Join Group')).toBeVisible();

      await page.getByRole('button', { name: joinLabel }).first().click();
      await page.getByPlaceholder(/Enter group password|Mot de passe du groupe/i).fill('secret');
      await page.getByRole('button', { name: joinLabel }).nth(1).click();

      await expect.poll(() => groups[0]?.members.some((member) => member.playerId === 'p-player')).toBe(true);
  await expect(page.getByRole('button', { name: joinLabel })).toHaveCount(0);
    });

    test('captain profile: edits, registers and unregisters group', async ({ page }) => {
      await installCommonAuthRoutes(page, {
        id: 'p-captain',
        email: 'captain@example.com',
        name: 'Captain',
        isAdmin: false,
      });

      const extraMembers = Array.from({ length: configuration.requiredMembers - 1 }, (_, index) => (
        createMember(`p-${index + 2}`, `member${index + 2}@example.com`, `Member${index + 2}`, 'User')
      ));

      const groups: GroupEntity[] = [
        {
          id: configuration.view === 'doublettes' ? 'd-cap' : 'e-cap',
          name: 'Captain Group',
          captainPlayerId: 'p-captain',
          isRegistered: false,
          createdAt: new Date().toISOString(),
          members: [createMember('p-captain', 'captain@example.com', 'Captain', 'User'), ...extraMembers],
        },
      ];

      await installGroupRoutes(page, configuration, groups, {
        id: 'p-captain',
        email: 'captain@example.com',
        firstName: 'Captain',
        lastName: 'User',
      });

      await page.goto(`/?view=${configuration.view}&tournamentId=${tournamentId}`);
      await expect(page.getByText('Captain Group')).toBeVisible();

      await page.getByRole('button', { name: editLabel }).click();
      await page.locator('input[value="Captain Group"]').fill('Captain Group Updated');
      await page.getByRole('button', { name: saveLabel }).click();
      await expect(page.getByText('Captain Group Updated')).toBeVisible();

      await page.getByRole('button', { name: configuration.registerButtonLabel }).click();
      await expect.poll(() => groups[0]?.isRegistered).toBe(true);
      await expect(page.getByRole('button', { name: unregisterLabel })).toBeVisible();

      page.once('dialog', async (dialog) => {
        await dialog.accept();
      });
      await page.getByRole('button', { name: unregisterLabel }).click();

      await expect.poll(() => groups[0]?.isRegistered).toBe(false);
      await expect(page.getByRole('button', { name: configuration.registerButtonLabel })).toBeVisible();
    });
  });
}
