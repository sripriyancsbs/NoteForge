// @ts-check
const { test, expect } = require('@playwright/test');
const { deleteTestNote } = require('./helpers');

test.describe('TEST SUITE 7 — SEARCH', () => {
  test('should search notes by keyword, isolate matches, exclude non-matches, and restore full list on clear', async ({ page, request }) => {
    const runId = Date.now();
    const uniqueTermA = `Kubernetes_${runId}`;
    const uniqueTermB = `PostgreSQL_${runId}`;

    const noteATitle = `Cloud Infrastructure with ${uniqueTermA}`;
    const noteAContent = `Deploying microservices using container orchestration and ${uniqueTermA} clusters.`;

    const noteBTitle = `Relational Storage with ${uniqueTermB}`;
    const noteBContent = `High-availability replication and B-Tree indexing in ${uniqueTermB}.`;

    // Seed test notes via API for deterministic isolation
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

    // 1. Navigate to home notes list
    await page.goto('/');
    await expect(page).toHaveTitle(/All Notes — NOTEForge/);

    const cardA = page.locator(`[data-testid="note-card"]:has-text("${noteATitle}")`);
    const cardB = page.locator(`[data-testid="note-card"]:has-text("${noteBTitle}")`);

    await expect(cardA).toBeVisible();
    await expect(cardB).toBeVisible();

    // 2. Search for unique keyword A
    const searchInput = page.getByTestId('search-input');
    await expect(searchInput).toBeVisible();
    await searchInput.fill(uniqueTermA);
    await searchInput.press('Enter');

    // Verify search page state
    await expect(page).toHaveURL(new RegExp(`\\?q=${encodeURIComponent(uniqueTermA)}`));
    await expect(page).toHaveTitle(new RegExp(`Search: "${uniqueTermA}"`));

    // Verify matching note appears
    await expect(page.locator(`[data-testid="note-card"]:has-text("${noteATitle}")`)).toBeVisible();

    // Verify unrelated note is excluded
    await expect(page.locator(`[data-testid="note-card"]:has-text("${noteBTitle}")`)).not.toBeVisible();

    // 3. Clear search via "Clear search" link
    const clearSearchLink = page.getByRole('link', { name: 'Clear search' });
    await expect(clearSearchLink).toBeVisible();
    await clearSearchLink.click();

    // Verify search cleared and list restored
    await expect(page).toHaveURL('/');
    await expect(page.locator(`[data-testid="note-card"]:has-text("${noteATitle}")`)).toBeVisible();
    await expect(page.locator(`[data-testid="note-card"]:has-text("${noteBTitle}")`)).toBeVisible();

    // 4. Test searching with no results renders empty search state
    const nonExistentTerm = `NonExistent_${runId}_ZeroMatch`;
    await searchInput.fill(nonExistentTerm);
    await searchInput.press('Enter');

    await expect(page).toHaveURL(new RegExp(`\\?q=${encodeURIComponent(nonExistentTerm)}`));
    const emptyState = page.getByTestId('empty-state-view');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(`No notes found for "${nonExistentTerm}"`);

    // Clearing by clearing input and pressing Enter restores list
    await searchInput.fill('');
    await searchInput.press('Enter');
    await expect(page).toHaveURL('/');
    await expect(page.locator(`[data-testid="note-card"]:has-text("${noteATitle}")`)).toBeVisible();
    } finally {
      await deleteTestNote(request, noteA.id);
      await deleteTestNote(request, noteB.id);
    }
  });
});
