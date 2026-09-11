// @ts-check
const { test, expect } = require('@playwright/test');
const { deleteTestNote } = require('./helpers');

test.describe('USER PERSONA B — NORMAL USER MULTI-NOTE WORKFLOW', () => {
  const createdIds = [];

  test.afterAll(async ({ request }) => {
    for (const id of createdIds) {
      await deleteTestNote(request, id);
    }
  });

  test('should handle multi-note creation, rapid switching, dialog interactions, searches and refreshes', async ({ page, request }) => {
    const timestamp = Date.now();

    // 1. Create multiple notes
    const noteTitles = [
      `Weekly Sprint Planning ${timestamp}`,
      `Backend Architecture Notes ${timestamp}`,
      `Database Index Optimization ${timestamp}`,
      `Customer Feedback Log ${timestamp}`,
      `DevOps CI/CD Deployment ${timestamp}`
    ];

    for (let i = 0; i < noteTitles.length; i++) {
      const res = await request.post('/api/notes', {
        data: {
          title: noteTitles[i],
          content: `Content for note ${i + 1} with markdown: **important** and *details*.`,
          is_favorite: i % 2 === 0
        }
      });
      expect(res.status()).toBe(201);
      const data = await res.json();
      createdIds.push(data.id);
    }

    // 2. Visit homepage and verify all notes appear
    await page.goto('/');
    await expect(page).toHaveTitle(/NOTEForge/);

    for (const title of noteTitles) {
      await expect(page.locator(`[data-testid="note-card"]:has-text("${title}")`)).toBeVisible();
    }

    // 3. Switch between notes quickly
    const firstNoteCard = page.locator(`[data-testid="note-card"]:has-text("${noteTitles[0]}")`);
    await firstNoteCard.locator('.note-card-title').click();
    await expect(page).toHaveURL(`/notes/${createdIds[0]}`);
    await expect(page.getByTestId('view-note-title')).toHaveText(noteTitles[0]);

    // Back to list
    await page.getByTestId('view-back-btn').click();
    await expect(page).toHaveURL(/\/\?category=all$|\/$/);

    // Click second note
    const secondNoteCard = page.locator(`[data-testid="note-card"]:has-text("${noteTitles[1]}")`);
    await secondNoteCard.locator('.note-card-title').click();
    await expect(page).toHaveURL(`/notes/${createdIds[1]}`);
    await expect(page.getByTestId('view-note-title')).toHaveText(noteTitles[1]);

    // 4. Edit a note
    await page.getByTestId('view-edit-btn').click();
    await expect(page).toHaveURL(`/notes/${createdIds[1]}/edit`);
    const newContent = '## Updated Specification\n\n- Revised architecture\n- Benchmarked under PostgreSQL';
    await page.getByTestId('note-content-editor').fill(newContent);
    await page.getByTestId('save-note-btn').click();
    await expect(page).toHaveURL(`/notes/${createdIds[1]}`);
    await expect(page.getByTestId('view-markdown-content').locator('h2')).toHaveText('Updated Specification');

    // 5. Open/close dialogs repeatedly (cancel delete test)
    await page.getByTestId('view-delete-btn').click();
    const modal = page.locator('#delete-modal');
    await expect(modal).toHaveClass(/open/);

    // Cancel via Cancel button
    await page.getByTestId('btn-cancel-delete').click();
    await expect(modal).not.toHaveClass(/open/);
    await expect(page).toHaveURL(`/notes/${createdIds[1]}`); // Still on view page!

    // Open again and close via Escape
    await page.getByTestId('view-delete-btn').click();
    await expect(modal).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(modal).not.toHaveClass(/open/);

    // 6. Search repeatedly
    await page.goto('/');
    const searchInput = page.getByTestId('search-input');
    await searchInput.fill('Database');
    await searchInput.press('Enter');
    await expect(page.locator(`[data-testid="note-card"]:has-text("${noteTitles[2]}")`)).toBeVisible();
    await expect(page.locator(`[data-testid="note-card"]:has-text("${noteTitles[0]}")`)).toHaveCount(0);

    // Clear search
    const clearSearchLink = page.getByRole('link', { name: 'Clear search' });
    await clearSearchLink.click();
    await expect(page.locator(`[data-testid="note-card"]:has-text("${noteTitles[0]}")`)).toBeVisible();

    // 7. Refresh page during normal usage
    await page.reload();
    await expect(page).toHaveTitle(/NOTEForge/);
    await expect(page.locator(`[data-testid="note-card"]:has-text("${noteTitles[0]}")`)).toBeVisible();
  });
});
