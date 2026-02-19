import { test, expect } from '@playwright/test';

test.describe('Tournament Creation performance', () => {
  test('should load form within performance budget', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lang', 'en');
    });
    const startTime = Date.now();

    await page.goto('/tournaments/create');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(2000);
  });

  test('should handle form submission within time limit', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lang', 'en');
    });
    await page.goto('/tournaments/create');
    await page.waitForLoadState('networkidle');

    await page.fill('[data-testid="tournament-name"]', 'Performance Test');
    await page.selectOption('[data-testid="tournament-format"]', 'SINGLE');
    await page.selectOption('[data-testid="duration-type"]', 'FULL_DAY');

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const startTime = futureDate.toISOString().slice(0, 16);
    const endTime = new Date(futureDate.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16);

    await page.fill('[data-testid="start-time"]', startTime);
    await page.fill('[data-testid="end-time"]', endTime);
    await page.fill('[data-testid="total-participants"]', '6');
    await page.fill('[data-testid="target-count"]', '1');

    const submitStartTime = Date.now();

    await page.click('[data-testid="submit-tournament"]');

    await page.waitForSelector('[data-testid="success-message"]', { timeout: 5000 });

    const submitTime = Date.now() - submitStartTime;

    expect(submitTime).toBeLessThan(5000);
  });
});
