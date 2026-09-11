// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('TEST SUITE 14 — TRASH, RESTORE, AND PERMANENT DELETE', () => {
  test('should execute full trash lifecycle: soft delete -> verify in trash -> restore -> verify in all -> soft delete -> permanent delete -> assert unrecoverable', async ({ page, request }) => {
    const runId = Date.now();
    const noteTitle = `Disposal Lifecycle Note ${runId}`;
    const noteContent = `Testing soft delete, restore, and permanent PostgreSQL purge ${runId}.`;

    // 1. Create a note via API
    const createRes = await request.post('/api/notes', {
      data: { title: noteTitle, content: noteContent }
    });
    expect(createRes.status()).toBe(201);
    const createdNote = await createRes.json();
    const noteId = createdNote.id;

    // 2. Open the note and soft delete it
    await page.goto(`/notes/${noteId}`);
    await expect(page.getByTestId('view-note-title')).toHaveText(noteTitle);

    const deleteBtn = page.getByTestId('view-delete-btn');
    await deleteBtn.click();

    const modal = page.locator('#delete-modal');
    await expect(modal).toHaveClass(/open/);
    await expect(page.locator('#modal-title-text')).toHaveText('Move Note to Trash?');

    await page.getByTestId('btn-confirm-delete').click();
    await expect(page).toHaveURL('/');

    // Verify note is NOT in active list
    await expect(page.locator(`[data-testid="note-card"]:has-text("${noteTitle}")`)).not.toBeVisible();

    // 3. Open Trash category view
    await page.goto('/?category=trash');
    await expect(page).toHaveURL(/\/\?category=trash$/);
    await expect(page).toHaveTitle(/Trash — NOTEForge/);

    // 4. Verify note exists in Trash
    const trashedCard = page.locator(`[data-testid="note-card"]:has-text("${noteTitle}")`);
    await expect(trashedCard).toBeVisible();

    // 5. Restore note from Trash
    const restoreBtn = trashedCard.getByTestId('restore-note-btn');
    await expect(restoreBtn).toBeVisible();
    await restoreBtn.click();

    const restoreToast = page.locator('#toast-container .toast-success').filter({ hasText: 'Note restored from trash' });
    await expect(restoreToast).toBeVisible();
    await expect(trashedCard).not.toBeVisible();

    // 6. Open All Notes and verify note is restored
    await page.goto('/');
    const restoredCard = page.locator(`[data-testid="note-card"]:has-text("${noteTitle}")`);
    await expect(restoredCard).toBeVisible();

    // 7. Soft delete again via card action button on index
    const trashCardBtn = restoredCard.getByTestId('trash-note-btn');
    await trashCardBtn.click();
    await expect(modal).toHaveClass(/open/);
    await page.getByTestId('btn-confirm-delete').click();
    await expect(restoredCard).not.toBeVisible();

    // 8. Open Trash again
    await page.goto('/?category=trash');
    const trashedCardAgain = page.locator(`[data-testid="note-card"]:has-text("${noteTitle}")`);
    await expect(trashedCardAgain).toBeVisible();

    // 9. Permanently delete the note from Trash
    const permDeleteBtn = trashedCardAgain.getByTestId('delete-perm-btn');
    await expect(permDeleteBtn).toBeVisible();
    await permDeleteBtn.click();

    // Verify permanent delete confirmation dialog text
    await expect(modal).toHaveClass(/open/);
    await expect(page.locator('#modal-title-text')).toHaveText('Permanently Delete Note?');
    await expect(page.locator('#modal-desc-text')).toContainText('This action cannot be undone');

    await page.getByTestId('btn-confirm-delete').click();

    // 10. Verify note is permanently removed from Trash view
    await expect(trashedCardAgain).not.toBeVisible();

    // 11. Verify note cannot be retrieved via direct URL (returns 404)
    const directRes = await page.goto(`/notes/${noteId}`);
    expect(directRes?.status()).toBe(404);
    await expect(page.locator('#error-title-heading')).toHaveText('Note Not Found');

    // 12. Verify note cannot be retrieved via API (real PostgreSQL row deleted)
    const apiRes = await request.get(`/api/notes/${noteId}`);
    expect(apiRes.status()).toBe(404);
    const apiJson = await apiRes.json();
    expect(apiJson.error).toContain(`Note #${noteId} not found`);
  });
});
