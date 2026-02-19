import { test, expect } from '@playwright/test';
import path from 'node:path';

test.describe('Tournament Creation workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lang', 'en');
    });
    await page.goto('/tournaments/create');
    await page.waitForLoadState('networkidle');
  });

  test('should create tournament with all required fields', async ({ page }) => {
    await page.fill('[data-testid="tournament-name"]', 'E2E Test Tournament');
    await page.selectOption('[data-testid="tournament-format"]', 'SINGLE');
    await page.selectOption('[data-testid="duration-type"]', 'FULL_DAY');

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const startTime = futureDate.toISOString().slice(0, 16);
    const endTime = new Date(futureDate.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);

    await page.fill('[data-testid="start-time"]', startTime);
    await page.fill('[data-testid="end-time"]', endTime);

    await page.fill('[data-testid="total-participants"]', '16');
    await page.fill('[data-testid="target-count"]', '3');

    await page.click('[data-testid="submit-tournament"]');

    await page.waitForSelector('[data-testid="success-message"]', { timeout: 10_000 });

    const successMessage = await page.textContent('[data-testid="success-message"]');
    expect(successMessage).toContain('Tournament created successfully');

    expect(page.url()).toMatch(/(\/tournaments\/[\w-]+|\/tournaments)$/);
  });

  test('should create tournament with logo upload', async ({ page }) => {
    await page.fill('[data-testid="tournament-name"]', 'E2E Logo Test Tournament');
    await page.selectOption('[data-testid="tournament-format"]', 'DOUBLE');
    await page.selectOption('[data-testid="duration-type"]', 'HALF_DAY');

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 20);
    const startTime = futureDate.toISOString().slice(0, 16);
    const endTime = new Date(futureDate.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16);

    await page.fill('[data-testid="start-time"]', startTime);
    await page.fill('[data-testid="end-time"]', endTime);
    await page.fill('[data-testid="total-participants"]', '8');
    await page.fill('[data-testid="target-count"]', '2');

    const logoPath = path.join(__dirname, '../fixtures/test-logo.png');
    await page.setInputFiles('[data-testid="tournament-logo"]', logoPath);

    await page.waitForSelector('[data-testid="logo-preview"]');

    const logoPreview = page.locator('[data-testid="logo-preview"]');
    await expect(logoPreview).toBeVisible();

    await page.click('[data-testid="submit-tournament"]');

    await page.waitForSelector('[data-testid="success-message"]', { timeout: 15_000 });

    if (page.url().includes('/tournaments/')) {
      const tournamentLogo = page.locator('[data-testid="tournament-logo-display"]');
      await expect(tournamentLogo).toBeVisible();

      const logoSource = await tournamentLogo.getAttribute('src');
      expect(logoSource).toContain('/uploads/');
      expect(logoSource).toMatch(/\.(png|jpg|jpeg)$/);
    }
  });
});
