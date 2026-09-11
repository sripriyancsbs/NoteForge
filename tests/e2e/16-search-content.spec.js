// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('TEST SUITE 16 — CONTENT-BASED SEARCH & CASE-INSENSITIVITY', () => {
  test('should search notes by content body keyword, assert case-insensitivity, isolate matches, and restore full list on clear', async ({ page, request }) => {
    const runId = Date.now();
    const uniqueContentKeywordUpper = `TELEMETRY_OBSERVABILITY_KEY_${runId}`;
    const uniqueContentKeywordLower = uniqueContentKeywordUpper.toLowerCase();

    const noteATitle = `System Cluster Alpha ${runId}`;
    const noteAContent = `Detailed engineering log containing ${uniqueContentKeywordUpper} for telemetry ingestion.`;

    const noteBTitle = `Storage Database Beta ${runId}`;
    const noteBContent = `Unrelated documentation regarding schema migrations and connection pooling.`;

    // 1. Seed Note A and Note B via API
    const resA = await request.post('/api/notes', {
      data: { title: noteATitle, content: noteAContent }
    });
    expect(resA.status()).toBe(201);
    const noteA = await resA.json();

    const resB = await request.post('/api/notes', {
      data: { title: noteBTitle, content: noteBContent }
    });
    expect(resB.status()).toBe(201);
    const noteB = await resB.json();

    try {
      // 2. Navigate to notes index
      await page.goto('/');
      await expect(page).toHaveTitle(/All Notes — NOTEForge/);

      const cardA = page.locator(`[data-testid="note-card"]:has-text("${noteATitle}")`);
      const cardB = page.locator(`[data-testid="note-card"]:has-text("${noteBTitle}")`);

      await expect(cardA).toBeVisible();
      await expect(cardB).toBeVisible();

      // 3. Search ONLY by the content keyword (which is absent from note title)
      // Use lowercase to strictly verify database case-insensitivity (ILIKE)
      const searchInput = page.getByTestId('search-input');
      await searchInput.fill(uniqueContentKeywordLower);
      await searchInput.press('Enter');

      // Verify search URL and heading
      await expect(page).toHaveURL(new RegExp(`\\?q=${encodeURIComponent(uniqueContentKeywordLower)}`));
      await expect(page.locator('#page-title-heading')).toContainText(uniqueContentKeywordLower);

      // Verify Note A appears in search results because content matched
      await expect(page.locator(`[data-testid="note-card"]:has-text("${noteATitle}")`)).toBeVisible();
      // Verify preview snippet contains the content term
      await expect(page.getByTestId('note-card-preview').filter({ hasText: uniqueContentKeywordUpper })).toBeVisible();

      // Verify Note B does NOT appear in search results
      await expect(page.locator(`[data-testid="note-card"]:has-text("${noteBTitle}")`)).not.toBeVisible();

      // 4. Clear search via "Clear search" link
      const clearLink = page.getByRole('link', { name: 'Clear search' });
      await expect(clearLink).toBeVisible();
      await clearLink.click();

      // Verify full notes list is restored with both notes present
      await expect(page).toHaveURL('/');
      await expect(page.locator(`[data-testid="note-card"]:has-text("${noteATitle}")`)).toBeVisible();
      await expect(page.locator(`[data-testid="note-card"]:has-text("${noteBTitle}")`)).toBeVisible();

    } finally {
      // Clean up test notes permanently
      await request.delete(`/api/notes/${noteA.id}?permanent=true`);
      await request.delete(`/api/notes/${noteB.id}?permanent=true`);
    }
  });
});
