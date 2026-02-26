import { test, expect } from '@playwright/test';

test('language toggle cycles and persists selection', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('lang')) {
      localStorage.setItem('lang', 'fr');
    }
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

  await page.route(/\/api\/tournaments(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tournaments: [] }),
    });
  });

  await page.goto('/?status=DRAFT');
  await page.waitForLoadState('networkidle');

  const languageToggle = page.getByRole('button', { name: 'Toggle language' });

  await expect(languageToggle).toHaveText('FR');
  await expect(page.getByRole('link', { name: 'Terminés' })).toBeVisible();

  await languageToggle.click();
  await expect(languageToggle).toHaveText('EN');
  await expect(page.getByRole('link', { name: 'Finished' })).toBeVisible();

  await languageToggle.click();
  await expect(languageToggle).toHaveText('ES');
  await expect(page.getByRole('link', { name: 'Finalizados' })).toBeVisible();

  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(languageToggle).toHaveText('ES');
});
