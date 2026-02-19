import { test, expect } from '@playwright/test';

test.describe('Tournament Creation error handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lang', 'en');
    });
    await page.goto('/tournaments/create');
    await page.waitForLoadState('networkidle');
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.fill('[data-testid="tournament-name"]', 'Network Error Test');
    await page.selectOption('[data-testid="tournament-format"]', 'SINGLE');
    await page.selectOption('[data-testid="duration-type"]', 'FULL_DAY');

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const startTime = futureDate.toISOString().slice(0, 16);
    const endTime = new Date(futureDate.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 16);

    await page.fill('[data-testid="start-time"]', startTime);
    await page.fill('[data-testid="end-time"]', endTime);
    await page.fill('[data-testid="total-participants"]', '10');
    await page.fill('[data-testid="target-count"]', '2');

    await page.route('**/api/tournaments', (route) => {
      route.abort('failed');
    });

    await page.click('[data-testid="submit-tournament"]');

    await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to create tournament');
    await expect(page.locator('[data-testid="submit-tournament"]')).toBeEnabled();
  });

  test('should handle server validation errors', async ({ page }) => {
    await page.fill('[data-testid="tournament-name"]', 'Server Error Test');
    await page.selectOption('[data-testid="tournament-format"]', 'SINGLE');
    await page.selectOption('[data-testid="duration-type"]', 'FULL_DAY');

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const startTime = futureDate.toISOString().slice(0, 16);
    const endTime = new Date(futureDate.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 16);

    await page.fill('[data-testid="start-time"]', startTime);
    await page.fill('[data-testid="end-time"]', endTime);
    await page.fill('[data-testid="total-participants"]', '8');
    await page.fill('[data-testid="target-count"]', '2');

    await page.route('**/api/tournaments', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            message: 'Validation failed',
            details: [
              { field: 'name', message: 'Tournament name already exists' },
            ],
          },
        }),
      });
    });

    await page.click('[data-testid="submit-tournament"]');

    await expect(page.locator('[data-testid="error-message"]')).toContainText('Tournament name already exists');
  });
});
