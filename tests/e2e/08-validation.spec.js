// @ts-check
const { test, expect } = require('@playwright/test');
const { deleteTestNote } = require('./helpers');

test.describe('TEST SUITE 8 — VALIDATION', () => {
  test('should enforce input validation for empty title, empty content, and length limits, and allow user to correct', async ({ page, request }) => {
    const runId = Date.now();
    let createdNoteId = null;

    try {

    // 1. Open New Note page
    await page.goto('/notes/new');
    await expect(page).toHaveTitle(/New Note — NOTEForge/);

    const titleInput = page.getByTestId('note-title-editor');
    const contentInput = page.getByTestId('note-content-editor');
    const saveBtn = page.getByTestId('save-note-btn');

    // Case A: Empty Title validation
    await contentInput.fill(`Valid markdown content for run ${runId}`);
    await titleInput.fill('');
    await saveBtn.click();

    // Verify error toast feedback appears and page stays on editor
    const titleErrorToast = page.locator('#toast-container .toast-error').filter({ hasText: 'Please enter a note title' });
    await expect(titleErrorToast).toBeVisible();
    await expect(page).toHaveURL(/\/notes\/new$/);

    // Case B: Empty Content validation
    await titleInput.fill(`Title Without Content ${runId}`);
    await contentInput.fill('');
    await saveBtn.click();

    const contentErrorToast = page.locator('#toast-container .toast-error').filter({ hasText: 'Note content cannot be empty' });
    await expect(contentErrorToast).toBeVisible();
    await expect(page).toHaveURL(/\/notes\/new$/);

    // Case C: Excessively long input validation (exceeding 255 character limit)
    const excessiveTitle = 'Z'.repeat(300);
    await titleInput.fill(excessiveTitle);
    await contentInput.fill('Valid markdown body for long title test');
    await saveBtn.click();

    const lengthErrorToast = page.locator('#toast-container .toast-error').filter({ hasText: 'Title cannot exceed 255 characters' });
    await expect(lengthErrorToast).toBeVisible();
    await expect(page).toHaveURL(/\/notes\/new$/);

    // Verify backend validation also returns 400 for direct API requests exceeding limits
    const apiOverLimitRes = await request.post('/api/notes', {
      data: {
        title: 'X'.repeat(256),
        content: 'Testing character overflow boundary'
      }
    });
    expect(apiOverLimitRes.status()).toBe(400);
    const errorJson = await apiOverLimitRes.json();
    expect(errorJson.error).toContain('Title cannot exceed 255 characters');

    // Case D: User corrects the problem and successfully saves
    const validTitle = `Proper Validated Architecture Note ${runId}`;
    const validContent = `### Validated Architecture\n\nAll validation errors resolved cleanly.`;

    await titleInput.fill(validTitle);
    await contentInput.fill(validContent);
    await saveBtn.click();

    // Verify successful save and redirection to the created note view
    await expect(page).toHaveURL(/\/notes\/\d+$/);
    const urlMatch = page.url().match(/\/notes\/(\d+)$/);
    if (urlMatch) createdNoteId = urlMatch[1];

    // Verify created note content in view
    await expect(page.getByTestId('view-note-title')).toHaveText(validTitle);
    await expect(page.getByTestId('view-markdown-content').locator('h3')).toHaveText('Validated Architecture');
    await expect(page.getByTestId('view-markdown-content')).toContainText('All validation errors resolved cleanly.');
    } finally {
      await deleteTestNote(request, createdNoteId);
    }
  });
});
