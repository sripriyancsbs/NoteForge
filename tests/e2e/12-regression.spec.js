// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('TEST SUITE 12 — REGRESSION', () => {
  test('should execute complete end-to-end user lifecycle: Create -> View -> Edit -> Search -> View -> Delete', async ({ page }) => {
    const runId = Date.now();
    const initialTitle = `Full Lifecycle Master Note ${runId}`;
    const initialMarkdown = `# Phase 1: Creation\n\nInitial architectural draft for regression testing ${runId}.\n\n- Task A\n- Task B`;

    const updatedTitle = `Full Lifecycle Master Note ${runId} [UPDATED]`;
    const updatedMarkdown = `# Phase 2: Revision\n\nUpdated architectural specification after review ${runId}.\n\n> Verified revision state.`;

    // -------------------------------------------------------------------------
    // 1. Initial Load & Navigation
    // -------------------------------------------------------------------------
    await page.goto('/');
    await expect(page).toHaveTitle(/All Notes — NOTEForge/);

    // -------------------------------------------------------------------------
    // 2. CREATE Transition
    // -------------------------------------------------------------------------
    const newNoteBtn = page.getByTestId('header-new-note-btn');
    await expect(newNoteBtn).toBeVisible();
    await newNoteBtn.click();

    await expect(page).toHaveURL(/\/notes\/new$/);
    const titleEditor = page.getByTestId('note-title-editor');
    const contentEditor = page.getByTestId('note-content-editor');
    const saveBtn = page.getByTestId('save-note-btn');

    await titleEditor.fill(initialTitle);
    await contentEditor.fill(initialMarkdown);
    await saveBtn.click();

    // -------------------------------------------------------------------------
    // 3. VIEW Transition (Post-Create)
    // -------------------------------------------------------------------------
    await expect(page).toHaveURL(/\/notes\/\d+$/);
    const noteUrl = page.url();
    const noteIdMatch = noteUrl.match(/\/notes\/(\d+)$/);
    expect(noteIdMatch).not.toBeNull();
    const noteId = noteIdMatch ? noteIdMatch[1] : '';

    // Verify view rendering of initial state
    await expect(page.getByTestId('view-note-title')).toHaveText(initialTitle);
    const viewContentInitial = page.getByTestId('view-markdown-content');
    await expect(viewContentInitial.locator('h1')).toHaveText('Phase 1: Creation');
    await expect(viewContentInitial.locator('ul li').first()).toHaveText('Task A');

    // -------------------------------------------------------------------------
    // 4. EDIT Transition
    // -------------------------------------------------------------------------
    const editBtn = page.getByTestId('view-edit-btn');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    await expect(page).toHaveURL(`/notes/${noteId}/edit`);
    await expect(page.getByTestId('note-title-editor')).toHaveValue(initialTitle);

    // Update note details
    await page.getByTestId('note-title-editor').fill(updatedTitle);
    await page.getByTestId('note-content-editor').fill(updatedMarkdown);
    await page.getByTestId('save-note-btn').click();

    // Verify redirected back to note view with updated state
    await expect(page).toHaveURL(`/notes/${noteId}`);
    await expect(page.getByTestId('view-note-title')).toHaveText(updatedTitle);

    const viewContentUpdated = page.getByTestId('view-markdown-content');
    await expect(viewContentUpdated.locator('h1')).toHaveText('Phase 2: Revision');
    await expect(viewContentUpdated.locator('blockquote')).toContainText('Verified revision state.');
    await expect(viewContentUpdated).not.toContainText('Phase 1: Creation');

    // -------------------------------------------------------------------------
    // 5. SEARCH Transition
    // -------------------------------------------------------------------------
    // Return to workspace index
    await page.getByTestId('view-back-btn').click();
    await expect(page).toHaveURL('/');

    const searchInput = page.getByTestId('search-input');
    await searchInput.fill(`Lifecycle Master Note ${runId}`);
    await searchInput.press('Enter');

    await expect(page).toHaveURL(new RegExp(`\\?q=${encodeURIComponent(`Lifecycle Master Note ${runId}`)}`));
    const matchingCard = page.locator(`[data-testid="note-card"]:has-text("${updatedTitle}")`);
    await expect(matchingCard).toBeVisible();
    await expect(matchingCard.getByTestId('note-card-preview')).toContainText('Updated architectural specification');

    // -------------------------------------------------------------------------
    // 6. VIEW Transition (From Search Results)
    // -------------------------------------------------------------------------
    await matchingCard.click();
    await expect(page).toHaveURL(`/notes/${noteId}`);
    await expect(page.getByTestId('view-note-title')).toHaveText(updatedTitle);

    // -------------------------------------------------------------------------
    // 7. DELETE Transition
    // -------------------------------------------------------------------------
    const deleteBtn = page.getByTestId('view-delete-btn');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Verify confirmation dialog
    const modal = page.locator('#delete-modal');
    await expect(modal).toBeVisible();

    // Cancel once and verify note remains intact
    const cancelModalBtn = page.getByTestId('btn-cancel-delete');
    await cancelModalBtn.click();
    await expect(modal).not.toHaveClass(/open/);
    await expect(page).toHaveURL(`/notes/${noteId}`);
    await expect(page.getByTestId('view-note-title')).toHaveText(updatedTitle);

    // Delete again and confirm
    await deleteBtn.click();
    await expect(modal).toBeVisible();
    await page.getByTestId('btn-confirm-delete').click();

    // Verify redirection to notes list
    await expect(page).toHaveURL('/');

    // Verify note is removed from active notes list
    await expect(page.locator(`[data-testid="note-card"]:has-text("${updatedTitle}")`)).not.toBeVisible();

    // Verify opening deleted note directly returns 404 error page
    const directAccessResponse = await page.goto(`/notes/${noteId}`);
    expect(directAccessResponse?.status()).toBe(404);
    await expect(page.locator('#error-title-heading')).toHaveText('Note Not Found');
  });
});
