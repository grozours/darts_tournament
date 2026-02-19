import { test, expect } from '@playwright/test';
import path from 'node:path';

test.describe('Tournament Creation validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lang', 'en');
    });
    await page.goto('/tournaments/create');
    await page.waitForLoadState('networkidle');
  });

  test('should show validation errors for required fields', async ({ page }) => {
    await page.click('[data-testid="submit-tournament"]');

    await expect(page.locator('[data-testid="name-error"]')).toContainText('Tournament name is required');
    await expect(page.locator('[data-testid="format-error"]')).toContainText('Format is required');
    await expect(page.locator('[data-testid="start-time-error"]')).toContainText('Start time is required');
    await expect(page.locator('[data-testid="end-time-error"]')).toContainText('End time is required');

    expect(page.url()).toContain('/tournaments/create');
  });

  test('should validate tournament name constraints', async ({ page }) => {
    await page.fill('[data-testid="tournament-name"]', 'AB');
    await page.locator('[data-testid="tournament-name"]').blur();

    await expect(page.locator('[data-testid="name-error"]')).toContainText('at least 3 characters');

    await page.fill('[data-testid="tournament-name"]', 'A'.repeat(101));
    await page.locator('[data-testid="tournament-name"]').blur();

    await expect(page.locator('[data-testid="name-error"]')).toContainText('cannot exceed 100 characters');
  });

  test('should validate participant count', async ({ page }) => {
    await page.fill('[data-testid="total-participants"]', '1');
    await page.locator('[data-testid="total-participants"]').blur();

    await expect(page.locator('[data-testid="participants-error"]')).toContainText('minimum 2 participants');

    await page.fill('[data-testid="total-participants"]', '600');
    await page.locator('[data-testid="total-participants"]').blur();

    await expect(page.locator('[data-testid="participants-error"]')).toContainText('maximum 512 participants');
  });

  test('should validate target count', async ({ page }) => {
    await page.fill('[data-testid="target-count"]', '0');
    await page.locator('[data-testid="target-count"]').blur();

    await expect(page.locator('[data-testid="targets-error"]')).toContainText('minimum 1 target');

    await page.fill('[data-testid="target-count"]', '25');
    await page.locator('[data-testid="target-count"]').blur();

    await expect(page.locator('[data-testid="targets-error"]')).toContainText('maximum 20 targets');
  });

  test('should validate date/time constraints', async ({ page }) => {
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1);
    const pastTime = pastDate.toISOString().slice(0, 16);

    await page.fill('[data-testid="start-time"]', pastTime);
    await page.locator('[data-testid="start-time"]').blur();

    await expect(page.locator('[data-testid="start-time-error"]')).toContainText('cannot be in the past');

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    const startTime = futureDate.toISOString().slice(0, 16);
    const earlierEndTime = new Date(futureDate.getTime() - 60 * 60 * 1000).toISOString().slice(0, 16);

    await page.fill('[data-testid="start-time"]', startTime);
    await page.fill('[data-testid="end-time"]', earlierEndTime);
    await page.locator('[data-testid="end-time"]').blur();

    await expect(page.locator('[data-testid="end-time-error"]')).toContainText('must be after start time');
  });

  test('should validate logo file upload', async ({ page }) => {
    const textFilePath = path.join(__dirname, '../fixtures/test.txt');
    await page.setInputFiles('[data-testid="tournament-logo"]', textFilePath);

    await expect(page.locator('[data-testid="logo-error"]')).toContainText('Only JPEG and PNG files are allowed');
  });
});
