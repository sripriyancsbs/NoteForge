// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('TEST SUITE 9 — ERROR HANDLING', () => {
  test('should display clean styled error states without stack traces, blank screens, or broken navigation for 404s and invalid routes', async ({ page, request }) => {
    // 1. Non-existent note view
    const nonExistentId = 999999;
    const noteResponse = await page.goto(`/notes/${nonExistentId}`);
    expect(noteResponse?.status()).toBe(404);

    // Verify user-friendly error container
    const errorState = page.locator('#error-state-view');
    await expect(errorState).toBeVisible();

    const errorTitle = page.locator('#error-title-heading');
    await expect(errorTitle).toHaveText('Note Not Found');

    const errorDesc = page.locator('#error-description-text');
    await expect(errorDesc).toContainText(`The requested note #${nonExistentId} does not exist`);

    // Verify absence of raw Flask tracebacks or server leaks
    const pageContent = await page.content();
    expect(pageContent).not.toMatch(/Traceback \(most recent call last\)/i);
    expect(pageContent).not.toMatch(/Werkzeug Debugger/i);
    expect(pageContent).not.toMatch(/Internal Server Error/i);
    expect(pageContent).not.toMatch(/Exception on \/notes\//i);

    // Verify page is not a blank screen (has layout elements)
    await expect(page.locator('#brand-link')).toBeVisible();
    await expect(page.locator('#navigation-sidebar')).toBeVisible();

    // Verify recovery navigation: "Return to Workspace" button functions cleanly
    const returnBtn = page.locator('#btn-return-home-error');
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();
    await expect(page).toHaveURL('/');
    await expect(page).toHaveTitle(/All Notes — NOTEForge/);

    // 2. Non-existent application URL route
    const arbitraryInvalidPath = '/system-diagnostics-invalid-route-xyz';
    const routeResponse = await page.goto(arbitraryInvalidPath);
    expect(routeResponse?.status()).toBe(404);

    await expect(page.locator('#error-state-view')).toBeVisible();
    await expect(page.locator('#error-title-heading')).toHaveText('Page Not Found');
    await expect(page.locator('#top-navigation')).toBeVisible();

    // 3. Non-existent note edit route
    const editResponse = await page.goto(`/notes/${nonExistentId}/edit`);
    expect(editResponse?.status()).toBe(404);
    await expect(page.locator('#error-title-heading')).toHaveText('Note Not Found');

    // 4. API failure endpoint returns JSON error rather than HTML stack traces
    const apiNotFoundRes = await request.get(`/api/notes/${nonExistentId}`);
    expect(apiNotFoundRes.status()).toBe(404);
    expect(apiNotFoundRes.headers()['content-type']).toContain('application/json');
    const apiJson = await apiNotFoundRes.json();
    expect(apiJson.error).toContain(`Note #${nonExistentId} not found`);
  });
});
