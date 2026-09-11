// @ts-check
const { test, expect } = require('@playwright/test');
const { deleteTestNote } = require('./helpers');

test.describe('TEST SUITE 18 — KEYBOARD NAVIGATION & USABILITY', () => {
  test('should verify sequential Tab/Shift+Tab focus, activation via Enter, and dialog keyboard controls', async ({ page, request }) => {
    let createdNoteId = null;

    try {
    // 1. Navigate to home page
    await page.goto('/');
    await expect(page).toHaveTitle(/All Notes — NOTEForge/);

    // Ensure focus begins at the top of the document
    await page.evaluate(() => window.scrollTo(0, 0));

    // 2. Test sequential Tab navigation through header interactive controls
    // Tab 1 -> Brand Link
    await page.keyboard.press('Tab');
    const focused1 = await page.evaluate(() => document.activeElement?.id);
    expect(focused1).toBe('brand-link');

    // Tab 2 -> Search Input
    await page.keyboard.press('Tab');
    const focused2 = await page.evaluate(() => document.activeElement?.id);
    expect(focused2).toBe('search-input');

    // Tab 3 -> New Note Button
    await page.keyboard.press('Tab');
    const focused3 = await page.evaluate(() => document.activeElement?.id);
    expect(focused3).toBe('btn-header-new-note');

    // 3. Test Shift+Tab moves focus backward
    await page.keyboard.press('Shift+Tab');
    const focusedBack = await page.evaluate(() => document.activeElement?.id);
    expect(focusedBack).toBe('search-input');

    // 4. Test Enter key activates focused link (navigate to New Note without mouse)
    await page.keyboard.press('Tab'); // Move back to New Note button
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/notes\/new$/);

    // 5. In Editor, verify keyboard accessibility to form controls and actions
    const titleEditor = page.getByTestId('note-title-editor');
    const contentEditor = page.getByTestId('note-content-editor');

    // Focus title and type
    await titleEditor.focus();
    await expect(titleEditor).toBeFocused();
    await page.keyboard.type('Keyboard Navigation Test Note');

    // Tab from title moves to Cancel button, then Save button, then Toolbar
    await page.keyboard.press('Tab');
    const focusedAfterTitle = await page.evaluate(() => document.activeElement?.id);
    expect(focusedAfterTitle).toBe('btn-cancel-editor');

    await page.keyboard.press('Tab');
    const focusedSave = await page.evaluate(() => document.activeElement?.id);
    expect(focusedSave).toBe('btn-save-note');

    // Focus content editor directly and write content
    await contentEditor.focus();
    await expect(contentEditor).toBeFocused();
    await page.keyboard.type('Body written purely via keyboard controls.');

    // 6. Test dialog keyboard focus management on note view
    const saveBtn = page.getByTestId('save-note-btn');
    await saveBtn.click();
    await expect(page).toHaveURL(/\/notes\/\d+$/);
    const urlMatch = page.url().match(/\/notes\/(\d+)$/);
    if (urlMatch) createdNoteId = urlMatch[1];

    const deleteBtn = page.getByTestId('view-delete-btn');
    await deleteBtn.click();

    // Verify modal is open and Delete Confirm button receives initial focus
    const modal = page.locator('#delete-modal');
    await expect(modal).toHaveClass(/open/);
    const focusedModalBtn = await page.evaluate(() => document.activeElement?.id);
    expect(focusedModalBtn).toBe('btn-confirm-delete');

    // Shift+Tab within modal to Cancel button
    await page.keyboard.press('Shift+Tab');
    const focusedCancelBtn = await page.evaluate(() => document.activeElement?.id);
    expect(focusedCancelBtn).toBe('btn-cancel-delete');

    // Press Enter to activate Cancel button and close dialog
    await page.keyboard.press('Enter');
    await expect(modal).not.toHaveClass(/open/);

    // Re-open modal and test Escape key closes it
    await deleteBtn.click();
    await expect(modal).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(modal).not.toHaveClass(/open/);

    // Soft delete created note via UI
    await deleteBtn.click();
    await page.getByTestId('btn-confirm-delete').click();
    await expect(page).toHaveURL('/');
  } finally {
    await deleteTestNote(request, createdNoteId);
  }
});
});
