// @ts-check
const { test, expect } = require('@playwright/test');
const { deleteTestNote } = require('./helpers');

test.describe('TEST SUITE 4 — EDIT NOTE', () => {
  test('should edit an existing note and verify updated title, updated content, and absence of old content', async ({ page, request }) => {
    const testId = Date.now();
    const originalTitle = `Original Pre-Edit Title ${testId}`;
    const originalContent = `Initial unique text content alpha ${testId}`;
    const updatedTitle = `Revised Post-Edit Title ${testId}`;
    const updatedContent = `Updated unique text content omega ${testId} with **new emphasis**.`;

    // 1. Create a note
    const resp = await request.post('/api/notes', {
      data: { title: originalTitle, content: originalContent }
    });
    expect(resp.status()).toBe(201);
    const noteData = await resp.json();

    try {

    // 2. Open it
    await page.goto(`/notes/${noteData.id}`);
    await expect(page.getByTestId('view-note-title')).toHaveText(originalTitle);

    // 3. Click Edit action
    await page.getByTestId('view-edit-btn').click();
    await expect(page).toHaveURL(new RegExp(`/notes/${noteData.id}/edit$`));

    // 4. Verify that the edit form is genuinely pre-populated with existing data
    const titleInput = page.getByTestId('note-title-editor');
    const contentInput = page.getByTestId('note-content-editor');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue(originalTitle);
    await expect(contentInput).toBeVisible();
    await expect(contentInput).toHaveValue(originalContent);

    // 5. Edit title and Markdown content
    await titleInput.fill(updatedTitle);
    await contentInput.fill(updatedContent);

    // 5. Save
    await page.getByTestId('save-note-btn').click();

    // 6. Verify redirected back to view page
    await expect(page).toHaveURL(new RegExp(`/notes/${noteData.id}$`));

    // 7. Verify updated title appears
    const titleLocator = page.getByTestId('view-note-title');
    await expect(titleLocator).toHaveText(updatedTitle);

    // 8. Verify updated content appears
    const contentLocator = page.getByTestId('view-markdown-content');
    await expect(contentLocator).toContainText(`Updated unique text content omega ${testId}`);
    await expect(contentLocator.locator('strong')).toHaveText('new emphasis');

    // 9. Verify old content is no longer displayed
    await expect(contentLocator).not.toContainText(`Initial unique text content alpha ${testId}`);
    await expect(titleLocator).not.toHaveText(originalTitle);
    } finally {
      await deleteTestNote(request, noteData.id);
    }
  });
});
