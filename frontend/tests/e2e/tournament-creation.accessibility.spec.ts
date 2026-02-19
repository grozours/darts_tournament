import { test, expect } from '@playwright/test';

test.describe('Tournament Creation accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lang', 'en');
    });
    await page.goto('/tournaments/create');
    await page.waitForLoadState('networkidle');
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.focus('[data-testid="tournament-name"]');

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="tournament-format"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="duration-type"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="start-time"]')).toBeFocused();
  });

  test('should show loading state during submission', async ({ page }) => {
    await page.fill('[data-testid="tournament-name"]', 'Loading Test Tournament');
    await page.selectOption('[data-testid="tournament-format"]', 'SINGLE');
    await page.selectOption('[data-testid="duration-type"]', 'FULL_DAY');

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15);
    const startTime = futureDate.toISOString().slice(0, 16);
    const endTime = new Date(futureDate.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(0, 16);

    await page.fill('[data-testid="start-time"]', startTime);
    await page.fill('[data-testid="end-time"]', endTime);
    await page.fill('[data-testid="total-participants"]', '12');
    await page.fill('[data-testid="target-count"]', '2');

    await page.click('[data-testid="submit-tournament"]');

    await expect(page.locator('[data-testid="submit-tournament"]')).toContainText('Creating');
    await expect(page.locator('[data-testid="submit-tournament"]')).toBeDisabled();

    await page.waitForSelector('[data-testid="success-message"]', { timeout: 10_000 });
  });

  test('should have proper ARIA labels and roles', async ({ page }) => {
    const form = page.locator('form[role="form"]');
    await expect(form).toBeVisible();

    await expect(page.locator('[data-testid="tournament-name"]')).toHaveAttribute('required');
    await expect(page.locator('[data-testid="tournament-format"]')).toHaveAttribute('required');

    await expect(page.locator('[data-testid="tournament-name"]')).toHaveAttribute('aria-label');
    await expect(page.locator('[data-testid="tournament-format"]')).toHaveAttribute('aria-label');
  });
});
