// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('TEST SUITE 1 — APPLICATION LOAD', () => {
  test('should load application successfully with correct title, navigation, zero console errors, and zero failed network requests', async ({ page }) => {
    const consoleErrors = [];
    const failedRequests = [];

    // Monitor browser console for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Monitor network requests for failures
    page.on('requestfailed', request => {
      failedRequests.push(`${request.method()} ${request.url()} [${request.failure()?.errorText}]`);
    });

    // 1. Navigate to application root
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    // 2. Verify expected page title
    await expect(page).toHaveTitle(/NOTEForge/);

    // 3. Verify main navigation visibility
    const topNav = page.locator('#top-navigation');
    await expect(topNav).toBeVisible();

    const brandLink = page.locator('#brand-link');
    await expect(brandLink).toBeVisible();

    const searchInput = page.getByTestId('search-input');
    await expect(searchInput).toBeVisible();

    const newNoteBtn = page.getByTestId('header-new-note-btn');
    await expect(newNoteBtn).toBeVisible();

    const sidebar = page.locator('#navigation-sidebar');
    await expect(sidebar).toBeVisible();

    // 4. Verify dynamic backend data rendering in navigation
    const allNotesBadge = page.locator('#count-all-badge');
    await expect(allNotesBadge).toBeVisible();
    await expect(allNotesBadge).toHaveText(/^\d+$/);

    const envIndicator = page.locator('#sidebar-env-indicator');
    await expect(envIndicator).toBeVisible();
    await expect(envIndicator).toContainText('PostgreSQL Active');

    // 4. Assert zero unexpected console errors
    expect(consoleErrors).toEqual([]);

    // 5. Assert zero unexpected failed network requests
    expect(failedRequests).toEqual([]);
  });
});
