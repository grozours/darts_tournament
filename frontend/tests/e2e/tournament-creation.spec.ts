import { test, expect, Page } from '@playwright/test';
import path from 'path';

test.describe('Tournament Creation E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to tournament creation page
    await page.goto('/tournaments/create');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test.describe('Complete tournament creation workflow', () => {
    test('should create tournament with all required fields', async ({ page }) => {
      // Fill tournament form
      await page.fill('[data-testid="tournament-name"]', 'E2E Test Tournament');
      await page.selectOption('[data-testid="tournament-format"]', 'SINGLE');
      await page.selectOption('[data-testid="duration-type"]', 'FULL_DAY');
      
      // Set dates (future dates)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const startTime = futureDate.toISOString().slice(0, 16);
      const endTime = new Date(futureDate.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
      
      await page.fill('[data-testid="start-time"]', startTime);
      await page.fill('[data-testid="end-time"]', endTime);
      
      // Set participant details
      await page.fill('[data-testid="total-participants"]', '16');
      await page.fill('[data-testid="target-count"]', '3');

      // Submit form
      await page.click('[data-testid="submit-tournament"]');

      // Wait for success message or redirect
      await page.waitForSelector('[data-testid="success-message"]', { timeout: 10000 });
      
      // Verify success message
      const successMessage = await page.textContent('[data-testid="success-message"]');
      expect(successMessage).toContain('Tournament created successfully');

      // Verify redirect to tournament details or list
      expect(page.url()).toMatch(/(\/tournaments\/[\w-]+|\/tournaments)$/);
    });

    test('should create tournament with logo upload', async ({ page }) => {
      // Fill basic tournament data
      await page.fill('[data-testid="tournament-name"]', 'E2E Logo Test Tournament');
      await page.selectOption('[data-testid="tournament-format"]', 'DOUBLE');
      await page.selectOption('[data-testid="duration-type"]', 'HALF_DAY');
      
      // Set dates
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 20);
      const startTime = futureDate.toISOString().slice(0, 16);
      const endTime = new Date(futureDate.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16);
      
      await page.fill('[data-testid="start-time"]', startTime);
      await page.fill('[data-testid="end-time"]', endTime);
      await page.fill('[data-testid="total-participants"]', '8');
      await page.fill('[data-testid="target-count"]', '2');

      // Upload logo
      const logoPath = path.join(__dirname, '../fixtures/test-logo.png');
      await page.setInputFiles('[data-testid="tournament-logo"]', logoPath);

      // Wait for logo preview
      await page.waitForSelector('[data-testid="logo-preview"]');
      
      // Verify preview is shown
      const logoPreview = page.locator('[data-testid="logo-preview"]');
      await expect(logoPreview).toBeVisible();

      // Submit form
      await page.click('[data-testid="submit-tournament"]');

      // Wait for success
      await page.waitForSelector('[data-testid="success-message"]', { timeout: 15000 });

      // Navigate to tournament details to verify logo
      if (page.url().includes('/tournaments/')) {
        const tournamentLogo = page.locator('[data-testid="tournament-logo-display"]');
        await expect(tournamentLogo).toBeVisible();
        
        const logoSrc = await tournamentLogo.getAttribute('src');
        expect(logoSrc).toContain('/uploads/');
        expect(logoSrc).toMatch(/\.(png|jpg|jpeg)$/);
      }
    });
  });

  test.describe('Form validation', () => {
    test('should show validation errors for required fields', async ({ page }) => {
      // Try to submit empty form
      await page.click('[data-testid="submit-tournament"]');

      // Check for validation errors
      await expect(page.locator('[data-testid="name-error"]')).toContainText('Tournament name is required');
      await expect(page.locator('[data-testid="format-error"]')).toContainText('Format is required');
      await expect(page.locator('[data-testid="start-time-error"]')).toContainText('Start time is required');
      await expect(page.locator('[data-testid="end-time-error"]')).toContainText('End time is required');
      
      // Form should not be submitted
      expect(page.url()).toContain('/tournaments/create');
    });

    test('should validate tournament name constraints', async ({ page }) => {
      // Test too short name
      await page.fill('[data-testid="tournament-name"]', 'AB');
      await page.blur('[data-testid="tournament-name"]');
      
      await expect(page.locator('[data-testid="name-error"]')).toContainText('at least 3 characters');

      // Test too long name
      await page.fill('[data-testid="tournament-name"]', 'A'.repeat(101));
      await page.blur('[data-testid="tournament-name"]');
      
      await expect(page.locator('[data-testid="name-error"]')).toContainText('cannot exceed 100 characters');
    });

    test('should validate participant count', async ({ page }) => {
      // Test minimum participants
      await page.fill('[data-testid="total-participants"]', '1');
      await page.blur('[data-testid="total-participants"]');
      
      await expect(page.locator('[data-testid="participants-error"]')).toContainText('minimum 2 participants');

      // Test maximum participants
      await page.fill('[data-testid="total-participants"]', '600');
      await page.blur('[data-testid="total-participants"]');
      
      await expect(page.locator('[data-testid="participants-error"]')).toContainText('maximum 512 participants');
    });

    test('should validate target count', async ({ page }) => {
      // Test minimum targets
      await page.fill('[data-testid="target-count"]', '0');
      await page.blur('[data-testid="target-count"]');
      
      await expect(page.locator('[data-testid="targets-error"]')).toContainText('minimum 1 target');

      // Test maximum targets
      await page.fill('[data-testid="target-count"]', '25');
      await page.blur('[data-testid="target-count"]');
      
      await expect(page.locator('[data-testid="targets-error"]')).toContainText('maximum 20 targets');
    });

    test('should validate date/time constraints', async ({ page }) => {
      // Test past start time
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);
      const pastTime = pastDate.toISOString().slice(0, 16);
      
      await page.fill('[data-testid="start-time"]', pastTime);
      await page.blur('[data-testid="start-time"]');
      
      await expect(page.locator('[data-testid="start-time-error"]')).toContainText('cannot be in the past');

      // Test end time before start time
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const startTime = futureDate.toISOString().slice(0, 16);
      const earlierEndTime = new Date(futureDate.getTime() - 60 * 60 * 1000).toISOString().slice(0, 16);
      
      await page.fill('[data-testid="start-time"]', startTime);
      await page.fill('[data-testid="end-time"]', earlierEndTime);
      await page.blur('[data-testid="end-time"]');
      
      await expect(page.locator('[data-testid="end-time-error"]')).toContainText('must be after start time');
    });

    test('should validate logo file upload', async ({ page }) => {
      // Test invalid file type
      const textFilePath = path.join(__dirname, '../fixtures/test.txt');
      await page.setInputFiles('[data-testid="tournament-logo"]', textFilePath);
      
      await expect(page.locator('[data-testid="logo-error"]')).toContainText('Only JPEG and PNG files are allowed');

      // Test file too large (if possible to create large test file)
      // Note: This might require a pre-created large file in fixtures
    });
  });

  test.describe('User experience and accessibility', () => {
    test('should support keyboard navigation', async ({ page }) => {
      // Start with first field
      await page.focus('[data-testid="tournament-name"]');
      
      // Tab through form fields
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="tournament-format"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="duration-type"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="start-time"]')).toBeFocused();
    });

    test('should show loading state during submission', async ({ page }) => {
      // Fill form with valid data
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

      // Click submit and immediately check loading state
      await page.click('[data-testid="submit-tournament"]');
      
      // Should show loading indicator
      await expect(page.locator('[data-testid="submit-tournament"]')).toContainText('Creating');
      await expect(page.locator('[data-testid="submit-tournament"]')).toBeDisabled();
      
      // Wait for completion
      await page.waitForSelector('[data-testid="success-message"]', { timeout: 10000 });
    });

    test('should have proper ARIA labels and roles', async ({ page }) => {
      // Check form has proper role
      const form = page.locator('form[role="form"]');
      await expect(form).toBeVisible();
      
      // Check required fields are marked
      await expect(page.locator('[data-testid="tournament-name"]')).toHaveAttribute('required');
      await expect(page.locator('[data-testid="tournament-format"]')).toHaveAttribute('required');
      
      // Check ARIA labels
      await expect(page.locator('[data-testid="tournament-name"]')).toHaveAttribute('aria-label');
      await expect(page.locator('[data-testid="tournament-format"]')).toHaveAttribute('aria-label');
    });
  });

  test.describe('Error handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Fill form with valid data
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

      // Mock network failure
      await page.route('**/api/tournaments', route => {
        route.abort('failed');
      });

      // Submit form
      await page.click('[data-testid="submit-tournament"]');

      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to create tournament');
      
      // Form should remain editable
      await expect(page.locator('[data-testid="submit-tournament"]')).toBeEnabled();
    });

    test('should handle server validation errors', async ({ page }) => {
      // Fill form with data that might cause server validation error
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

      // Mock server validation error
      await page.route('**/api/tournaments', route => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              message: 'Validation failed',
              details: [
                { field: 'name', message: 'Tournament name already exists' }
              ]
            }
          })
        });
      });

      // Submit form
      await page.click('[data-testid="submit-tournament"]');

      // Should show specific validation error
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Tournament name already exists');
    });
  });

  test.describe('Performance', () => {
    test('should load form within performance budget', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/tournaments/create');
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Constitution: Page should load within 2 seconds
      expect(loadTime).toBeLessThan(2000);
    });

    test('should handle form submission within time limit', async ({ page }) => {
      // Fill form quickly
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
      
      // Submit form
      await page.click('[data-testid="submit-tournament"]');
      
      // Wait for success
      await page.waitForSelector('[data-testid="success-message"]', { timeout: 5000 });
      
      const submitTime = Date.now() - submitStartTime;
      
      // Constitution: Form submission should be reasonably fast
      expect(submitTime).toBeLessThan(5000); // 5 seconds
    });
  });
});