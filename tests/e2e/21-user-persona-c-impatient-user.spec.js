// @ts-check
const { test, expect } = require('@playwright/test');
const { deleteTestNote } = require('./helpers');

test.describe('USER PERSONA C — IMPATIENT USER RAPID CLICKS & RACE CONDITIONS', () => {
  let noteId = null;

  test.afterEach(async ({ request }) => {
    if (noteId) {
      await deleteTestNote(request, noteId);
      noteId = null;
    }
  });

  test('should withstand rapid multiple clicks, double submits, and rapid keyboard actions without errors or corrupt state', async ({ page, request }) => {
    const runId = Date.now();
    const title = `Impatient User Note ${runId}`;
    const content = `Content created under rapid click and keyboard hammering.`;

    // 1. Navigate to new note
    await page.goto('/notes/new');
    await page.getByTestId('note-title-editor').fill(title);
    await page.getByTestId('note-content-editor').fill(content);

    // 2. Click Save multiple times quickly (simulates impatient user clicking again while saving)
    const saveBtn = page.getByTestId('save-note-btn');
    await saveBtn.click();
    // Subsequent impatient clicks hit disabled button gracefully
    await saveBtn.click({ force: true, timeout: 500 }).catch(() => {});

    // Should navigate cleanly to view note page
    await expect(page).toHaveURL(/\/notes\/\d+$/);
    const currentUrl = page.url();
    noteId = currentUrl.split('/').pop();

    // Verify exactly ONE note was created (no duplicate note creation)
    const searchRes = await request.get(`/api/notes?q=${encodeURIComponent(title)}`);
    const searchJson = await searchRes.json();
    expect(searchJson.length).toBe(1);

    // 3. Click Favorite repeatedly (rapid toggle race condition)
    const favBtn = page.getByTestId('view-fav-btn');
    for (let i = 0; i < 5; i++) {
      await favBtn.click();
    }
    // Wait for network settle
    await page.waitForTimeout(500);
    // Reload page to assert consistent persisted state
    await page.reload();
    await expect(page.getByTestId('view-note-title')).toHaveText(title);

    // 4. Press Escape unexpectedly when dialog is not open (should not throw errors)
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // 5. Click Delete, and hit Enter multiple times rapidly
    await page.getByTestId('view-delete-btn').click();
    const modal = page.locator('#delete-modal');
    await expect(modal).toHaveClass(/open/);

    const confirmDeleteBtn = page.getByTestId('btn-confirm-delete');
    await Promise.all([
      confirmDeleteBtn.click(),
      confirmDeleteBtn.click()
    ]);

    await expect(page).toHaveURL('/');

    // 6. Navigate rapidly between categories
    await page.getByTestId('nav-link-recent').click();
    await page.getByTestId('nav-link-favorites').click();
    await page.getByTestId('nav-link-trash').click();
    await expect(page).toHaveURL(/\/\?category=trash$/);
    await page.waitForLoadState('domcontentloaded');

    // 7. Click Restore on the trashed note
    const trashedCard = page.locator(`[data-testid="note-card"]:has-text("${title}")`);
    await expect(trashedCard).toBeVisible({ timeout: 10000 });
    const restoreBtn = trashedCard.getByTestId('restore-note-btn');
    // Double click restore (or click rapidly)
    await restoreBtn.click();
    await restoreBtn.click().catch(() => {}); // Catch expected DOM detachment if already removed by first click

    // Should restore cleanly
    await page.getByTestId('nav-link-all').click();
    await expect(page.locator(`[data-testid="note-card"]:has-text("${title}")`)).toBeVisible();
  });
});
