// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('TEST SUITE 11 — ACCESSIBILITY BASICS', () => {
  test('should verify accessible names, landmark roles, dialog semantics, and keyboard focus interactions', async ({ page, request }) => {
    const runId = Date.now();
    const testTitle = `A11y Test Note ${runId}`;
    const testContent = `Testing accessibility standards and keyboard navigation for ${runId}.`;

    // 1. Create a note for testing controls
    const createRes = await request.post('/api/notes', {
      data: { title: testTitle, content: testContent }
    });
    const createdNote = await createRes.json();

    // 2. Open Home View and verify accessible landmarks and roles
    await page.goto('/');

    // Brand link has accessible name
    const brandLink = page.getByRole('link', { name: /NOTEForge/i });
    await expect(brandLink).toBeVisible();

    // Primary action has accessible role and name
    const newNoteLink = page.getByRole('link', { name: /New Note/i });
    await expect(newNoteLink).toBeVisible();

    // Search input has placeholder and can be located by placeholder
    const searchInput = page.getByPlaceholder('Search notes in PostgreSQL...');
    await expect(searchInput).toBeVisible();

    // Sidebar navigation landmark
    const sidebarNav = page.locator('aside[aria-label="Main Navigation"]');
    await expect(sidebarNav).toBeVisible();

    // Category navigation links have accessible names
    await expect(page.getByRole('link', { name: /All Notes/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Recent/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Favorites/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Trash/i })).toBeVisible();

    // 3. Test keyboard shortcut Ctrl+K focuses the search input
    await page.keyboard.press('Control+k');
    await expect(searchInput).toBeFocused();

    // 4. Test note card action buttons have accessible titles / names
    const card = page.locator(`[data-testid="note-card"]:has-text("${testTitle}")`);
    await expect(card).toBeVisible();

    const favBtn = card.getByTestId('fav-toggle-btn');
    await expect(favBtn).toHaveAttribute('title', 'Toggle Favorite');

    const editBtn = card.getByTestId('edit-note-btn');
    await expect(editBtn).toHaveAttribute('title', 'Edit note');

    const trashBtn = card.getByTestId('trash-note-btn');
    await expect(trashBtn).toHaveAttribute('title', 'Move to trash');

    // 5. Open Note View and verify accessible actions
    await card.click();
    await expect(page).toHaveURL(`/notes/${createdNote.id}`);

    const viewEditLink = page.getByRole('link', { name: /Edit/i });
    await expect(viewEditLink).toBeVisible();

    const viewDeleteBtn = page.getByTestId('view-delete-btn');
    await expect(viewDeleteBtn).toBeVisible();

    // 6. Test Delete Confirmation Modal Accessibility
    await viewDeleteBtn.click();

    const modal = page.locator('#delete-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(modal).toHaveAttribute('aria-labelledby', 'modal-title-text');

    const cancelModalBtn = modal.getByRole('button', { name: 'Cancel' });
    const confirmModalBtn = modal.getByRole('button', { name: 'Delete' });
    await expect(cancelModalBtn).toBeVisible();
    await expect(confirmModalBtn).toBeVisible();

    // Test Escape key closes the modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toHaveClass(/open/);

    // 7. Verify Editor accessibility controls
    await viewEditLink.click();
    await expect(page).toHaveURL(`/notes/${createdNote.id}/edit`);

    const titleEditor = page.getByPlaceholder('Note Title...');
    await expect(titleEditor).toBeVisible();

    const saveNoteBtn = page.getByRole('button', { name: /Save Note/i });
    await expect(saveNoteBtn).toBeVisible();

    const cancelEditorLink = page.getByRole('link', { name: 'Cancel', exact: true });
    await expect(cancelEditorLink).toBeVisible();

    // Test live region toast accessibility container
    const toastContainer = page.locator('#toast-container');
    await expect(toastContainer).toHaveAttribute('aria-live', 'polite');
  });
});
