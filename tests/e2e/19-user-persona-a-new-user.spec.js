// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('USER PERSONA A — NEW USER / FIRST-TIME VISITOR JOURNEY', () => {
  test('should complete end-to-end first-time visitor discovery and note lifecycle', async ({ page }) => {
    // 1. Visit root page for first time
    await page.goto('/');
    await expect(page).toHaveTitle(/NOTEForge/);

    // Verify clear visual navigation
    await expect(page.locator('#navigation-sidebar')).toBeVisible();
    await expect(page.getByTestId('nav-link-all')).toBeVisible();
    await expect(page.getByTestId('nav-link-recent')).toBeVisible();
    await expect(page.getByTestId('nav-link-favorites')).toBeVisible();
    await expect(page.getByTestId('nav-link-trash')).toBeVisible();

    // 2. Click "New Note" to initiate creation
    const newNoteBtn = page.getByTestId('header-new-note-btn');
    await expect(newNoteBtn).toBeVisible();
    await newNoteBtn.click();

    await expect(page).toHaveURL(/\/notes\/new$/);
    const titleInput = page.getByTestId('note-title-editor');
    const contentInput = page.getByTestId('note-content-editor');
    await expect(titleInput).toBeVisible();
    await expect(contentInput).toBeVisible();

    // 3. Compose first note
    const testTitle = `First Note Discovery ${Date.now()}`;
    const testContent = `# Welcome to NOTEForge\n\nThis is my first note.\n- Easy markdown\n- PostgreSQL persistence`;

    await titleInput.fill(testTitle);
    await contentInput.fill(testContent);

    // Verify live preview renders markdown
    await expect(page.getByTestId('markdown-preview-content').locator('h1')).toHaveText('Welcome to NOTEForge');

    // 4. Save note
    const saveBtn = page.getByTestId('save-note-btn');
    await saveBtn.click();

    // Redirects to view page
    await expect(page).toHaveURL(/\/notes\/\d+$/);
    await expect(page.getByTestId('view-note-title')).toHaveText(testTitle);
    await expect(page.getByTestId('view-markdown-content').locator('h1')).toHaveText('Welcome to NOTEForge');

    // Extract note ID
    const currentUrl = page.url();
    const noteId = currentUrl.split('/').pop();

    // 5. Toggle favorite on view page
    const favBtn = page.getByTestId('view-fav-btn');
    await favBtn.click();
    await expect(page.locator('#toast-container .toast-info')).toBeVisible();

    // 6. Navigate to edit note
    const editBtn = page.getByTestId('view-edit-btn');
    await editBtn.click();
    await expect(page).toHaveURL(`/notes/${noteId}/edit`);

    // Modify content
    await page.getByTestId('note-content-editor').fill(testContent + '\n\n**Updated by author.**');
    await page.getByTestId('save-note-btn').click();

    // Verify updated content in view
    await expect(page).toHaveURL(`/notes/${noteId}`);
    await expect(page.getByTestId('view-markdown-content').locator('strong')).toHaveText('Updated by author.');

    // 7. Delete to Trash
    await page.getByTestId('view-delete-btn').click();
    const modal = page.locator('#delete-modal');
    await expect(modal).toHaveClass(/open/);
    await page.getByTestId('btn-confirm-delete').click();

    // Returns to home
    await expect(page).toHaveURL('/');

    // 8. Check Trash section
    await page.getByTestId('nav-link-trash').click();
    await expect(page).toHaveURL(/\/\?category=trash$/);
    const trashedCard = page.locator(`[data-testid="note-card"]:has-text("${testTitle}")`);
    await expect(trashedCard).toBeVisible();

    // 9. Restore note
    const restoreBtn = trashedCard.getByTestId('restore-note-btn');
    await restoreBtn.click();
    await expect(page.locator('#toast-container .toast-success')).toBeVisible();
    await expect(trashedCard).not.toBeVisible();

    // 10. Check All Notes has the restored note
    await page.getByTestId('nav-link-all').click();
    await expect(page).toHaveURL(/\/\?category=all$|\/$/);
    const restoredCard = page.locator(`[data-testid="note-card"]:has-text("${testTitle}")`);
    await expect(restoredCard).toBeVisible();

    // 11. Move to trash again and permanently delete
    const trashCardBtn = restoredCard.getByTestId('trash-note-btn');
    await trashCardBtn.click();
    await expect(modal).toHaveClass(/open/);
    await page.getByTestId('btn-confirm-delete').click();

    await page.getByTestId('nav-link-trash').click();
    const permDeleteCard = page.locator(`[data-testid="note-card"]:has-text("${testTitle}")`);
    await expect(permDeleteCard).toBeVisible();
    await permDeleteCard.getByTestId('delete-perm-btn').click();
    await expect(modal).toHaveClass(/open/);
    await page.getByTestId('btn-confirm-delete').click();

    // 12. Verify permanently removed from UI
    await expect(page.locator(`[data-testid="note-card"]:has-text("${testTitle}")`)).toHaveCount(0);
  });
});
