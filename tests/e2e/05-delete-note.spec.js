// @ts-check
const { test, expect } = require('@playwright/test');
const { deleteTestNote } = require('./helpers');

test.describe('TEST SUITE 5 — DELETE NOTE', () => {
  test('should verify delete confirmation dialog, cancellation, deletion, list update, and 404 on access', async ({ page, request }) => {
    const testId = Date.now();
    const deleteTitle = `Temporary Note for Deletion ${testId}`;
    const deleteContent = `This note will be safely deleted in test ${testId}.`;

    // 1. Create a note
    const resp = await request.post('/api/notes', {
      data: { title: deleteTitle, content: deleteContent }
    });
    expect(resp.status()).toBe(201);
    const noteData = await resp.json();

    try {

    // 2. Open the note
    await page.goto(`/notes/${noteData.id}`);
    await expect(page.getByTestId('view-note-title')).toHaveText(deleteTitle);

    // 3. Click Delete
    await page.getByTestId('view-delete-btn').click();

    // 4. Verify confirmation dialog appears
    const modal = page.locator('#delete-modal');
    await expect(modal).toHaveClass(/open/);
    const cancelBtn = page.getByTestId('btn-cancel-delete');
    const confirmBtn = page.getByTestId('btn-confirm-delete');
    await expect(cancelBtn).toBeVisible();
    await expect(confirmBtn).toBeVisible();

    // 5. Cancel once and verify note still exists
    await cancelBtn.click();
    await expect(modal).not.toHaveClass(/open/);
    await expect(page).toHaveURL(new RegExp(`/notes/${noteData.id}$`));
    await expect(page.getByTestId('view-note-title')).toHaveText(deleteTitle);

    // 6. Delete again
    await page.getByTestId('view-delete-btn').click();
    await expect(modal).toHaveClass(/open/);

    // 7. Confirm deletion
    await confirmBtn.click();

    // 8. Verify success feedback / redirection
    await expect(page).toHaveURL('/');

    // 9. Verify note no longer appears in active notes list
    await expect(page.locator(`[data-testid="note-card"]:has-text("${deleteTitle}")`)).not.toBeVisible();

    // 10. Verify opening the deleted note is no longer possible (clean 404 error page)
    const viewResp = await page.goto(`/notes/${noteData.id}`);
    expect(viewResp?.status()).toBe(404);
    await expect(page.locator('#error-title-heading')).toHaveText('Note Not Found');
    } finally {
      await deleteTestNote(request, noteData.id);
    }
  });
});
