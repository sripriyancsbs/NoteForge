// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('TEST SUITE 13 — FAVORITES WORKFLOW', () => {
  test('should toggle note favorite state, verify toast, assert presence in favorites category, toggle off and assert exclusion', async ({ page, request }) => {
    const runId = Date.now();
    const noteTitle = `Architectural Benchmark Note ${runId}`;
    const noteContent = `Critical reference architecture note for favorite test ${runId}.`;

    // 1. Create a unique note via API
    const createRes = await request.post('/api/notes', {
      data: { title: noteTitle, content: noteContent }
    });
    expect(createRes.status()).toBe(201);
    const createdNote = await createRes.json();
    const noteId = createdNote.id;

    try {
      // 2. Open the note in reading view
      await page.goto(`/notes/${noteId}`);
      await expect(page.getByTestId('view-note-title')).toHaveText(noteTitle);

      const favBtn = page.getByTestId('view-fav-btn');
      await expect(favBtn).toBeVisible();
      const favIcon = page.locator(`#fav-icon-${noteId}`);
      await expect(favIcon).not.toHaveClass(/active-fav/);

      // 3. Toggle favorite ON
      await favBtn.click();

      // 4. Verify favorite state changes on view
      await expect(favIcon).toHaveClass(/active-fav/);

      // 5. Verify success feedback toast
      const addToast = page.locator('#toast-container .toast-info').filter({ hasText: 'Added to Favorites' });
      await expect(addToast).toBeVisible();

      // 6. Navigate to /?category=favorites
      await page.goto('/?category=favorites');
      await expect(page).toHaveURL(/\/\?category=favorites$/);
      await expect(page).toHaveTitle(/Favorites — NOTEForge/);

      // 7. Verify the note appears in Favorites list
      const favoriteCard = page.locator(`[data-testid="note-card"]:has-text("${noteTitle}")`);
      await expect(favoriteCard).toBeVisible();

      // 8. Return to the note view
      await page.goto(`/notes/${noteId}`);
      await expect(favIcon).toHaveClass(/active-fav/);

      // 9. Toggle favorite OFF
      await favBtn.click();

      // Verify favorite state removed
      await expect(favIcon).not.toHaveClass(/active-fav/);
      const removeToast = page.locator('#toast-container .toast-info').filter({ hasText: 'Removed from Favorites' });
      await expect(removeToast).toBeVisible();

      // 10. Verify note disappears from Favorites category
      await page.goto('/?category=favorites');
      await expect(page.locator(`[data-testid="note-card"]:has-text("${noteTitle}")`)).not.toBeVisible();

    } finally {
      // 11. Clean up test note permanently
      await request.delete(`/api/notes/${noteId}?permanent=true`);
    }
  });
});
