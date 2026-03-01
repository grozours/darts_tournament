import { test, expect, type Page } from '@playwright/test';

const screenshotsDirectory = '../docs/assets/screenshots';
const languages = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl'] as const;
const accountTypes = ['anonymous', 'player', 'admin'] as const;
const shouldCaptureDocsScreenshots = process.env.UPDATE_DOC_SCREENSHOTS === 'true';

test.skip(!shouldCaptureDocsScreenshots, 'Set UPDATE_DOC_SCREENSHOTS=true to refresh docs screenshots.');

const installAnonymousAuthMock = async (page: Page) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unauthorized' }),
    });
  });
};

test('capture docs screenshots for all profiles and languages', async ({ page }) => {
  test.setTimeout(180_000);

  await installAnonymousAuthMock(page);

  await page.setViewportSize({ width: 1500, height: 1000 });

  for (const lang of languages) {
    await page.goto('/?view=doc');
    await page.evaluate((selectedLang) => {
      localStorage.setItem('lang', selectedLang);
    }, lang);

    for (const accountType of accountTypes) {
      await page.goto(`/?view=doc&docProfile=${accountType}`);
      await expect(page).toHaveURL(/\?view=doc/);
      await page.screenshot({
        path: `${screenshotsDirectory}/documentation-${accountType}-${lang}.png`,
        fullPage: true,
      });
    }
  }
});
