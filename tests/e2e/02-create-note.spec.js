// @ts-check
const { test, expect } = require('@playwright/test');
const { deleteTestNote } = require('./helpers');

test.describe('TEST SUITE 2 — CREATE NOTE', () => {
  test('should execute complete note creation journey from UI and verify in notes list and view', async ({ page, request }) => {
    const testId = Date.now();
    const noteTitle = `Engineering Architecture Guide ${testId}`;
    const noteContent = `## System Specification ${testId}\n\nThis note validates the real-world creation flow.`;
    let noteId = null;

    try {

    // 1. Open Notes page
    await page.goto('/');
    await expect(page).toHaveTitle(/NOTEForge/);

    // 2. Click New Note
    const newNoteBtn = page.getByTestId('header-new-note-btn');
    await expect(newNoteBtn).toBeVisible();
    await newNoteBtn.click();

    // 3. Enter a title
    await expect(page).toHaveURL(/\/notes\/new$/);
    const titleInput = page.getByTestId('note-title-editor');
    await expect(titleInput).toBeVisible();
    await titleInput.fill(noteTitle);

    // 4. Enter Markdown content
    const contentInput = page.getByTestId('note-content-editor');
    await expect(contentInput).toBeVisible();
    await contentInput.fill(noteContent);

    // 5. Save the note
    const saveBtn = page.getByTestId('save-note-btn');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // 6. Verify successful save (redirected to note view with assigned ID)
    await expect(page).toHaveURL(/\/notes\/\d+$/);
    const urlMatch = page.url().match(/\/notes\/(\d+)$/);
    if (urlMatch) noteId = urlMatch[1];
    await expect(page.getByTestId('view-note-title')).toHaveText(noteTitle);

    // 7. Verify the note appears in the notes list
    await page.getByTestId('view-back-btn').click();
    await expect(page).toHaveURL('/');
    const noteCard = page.locator(`[data-testid="note-card"]:has-text("${noteTitle}")`);
    await expect(noteCard).toBeVisible();

    // 8. Open the created note
    await noteCard.click();

    // 9. Verify title
    await expect(page).toHaveURL(/\/notes\/\d+$/);
    await expect(page.getByTestId('view-note-title')).toHaveText(noteTitle);

    // 10. Verify content
    const viewContent = page.getByTestId('view-markdown-content');
    await expect(viewContent.locator('h2')).toHaveText(`System Specification ${testId}`);
    await expect(viewContent).toContainText('This note validates the real-world creation flow.');
    } finally {
      await deleteTestNote(request, noteId);
    }
  });
});
