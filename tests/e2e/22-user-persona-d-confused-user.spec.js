// @ts-check
const { test, expect } = require('@playwright/test');
const { deleteTestNote } = require('./helpers');

test.describe('USER PERSONA D — CONFUSED USER UNUSUAL SEQUENCES & EDGE INPUTS', () => {
  let createdNoteId = null;

  test.afterEach(async ({ request }) => {
    if (createdNoteId) {
      await deleteTestNote(request, createdNoteId);
      createdNoteId = null;
    }
  });

  test('should handle empty fields, partial inputs, unusual markdown, long text, and non-existent searches gracefully', async ({ page }) => {
    // 1. Visit new note page
    await page.goto('/notes/new');

    const titleInput = page.getByTestId('note-title-editor');
    const contentInput = page.getByTestId('note-content-editor');
    const saveBtn = page.getByTestId('save-note-btn');

    // 2. Click save with empty fields
    await saveBtn.click();
    await expect(page.locator('#toast-container .toast-error').last()).toContainText(/enter a note title/i);
    await expect(page).toHaveURL(/\/notes\/new$/); // Stays on page

    // 3. Title with whitespace only
    await titleInput.fill('    ');
    await saveBtn.click();
    await expect(page.locator('#toast-container .toast-error').last()).toContainText(/enter a note title/i);

    // 4. Fill title, but leave content empty
    const uniqueTitle = `Confused User Exploration ${Date.now()}`;
    await titleInput.fill(uniqueTitle);
    await contentInput.fill('');
    await saveBtn.click();
    await expect(page.locator('#toast-container .toast-error').last()).toContainText(/content cannot be empty/i);

    // 5. Enter unusual Markdown syntax & unclosed formatting
    const unusualMarkdown = [
      '>>> Deeply nested blockquote without closing',
      '',
      '| Broken Table Column |',
      '| Missing delimiter',
      '',
      '```javascript',
      '// Unclosed code fence without closing backticks',
      'const value = 42;',
      '',
      'Unmatched *italic and **bold formatting with `inline code',
      '',
      'Special symbols: § ± ¶ ‰ ‱ ⁂ ※ ⁑ ⁕ ∰ ∮ ∇ ∎ ∏ ∑',
    ].join('\n');

    await contentInput.fill(unusualMarkdown);

    // Verify preview renders without throwing client-side JavaScript error
    const preview = page.getByTestId('markdown-preview-content');
    await expect(preview).toBeVisible();
    await expect(preview.locator('blockquote').first()).toBeVisible();

    // 6. Enter very long content (3000 chars)
    const longChunk = '\n\n' + 'Extended technical observations. '.repeat(100);
    await contentInput.fill(unusualMarkdown + longChunk);

    // 7. Save note
    await saveBtn.click();
    await expect(page).toHaveURL(/\/notes\/\d+$/);

    const currentUrl = page.url();
    createdNoteId = currentUrl.split('/').pop();
    await expect(page.getByTestId('view-note-title')).toHaveText(uniqueTitle);

    // 8. Search for a term that does not exist
    await page.goto('/');
    const searchInput = page.getByTestId('search-input');
    await searchInput.fill('NONEXISTENT_QUERY_TERM_RANDOM_XYZ');
    await searchInput.press('Enter');

    // Verify clean empty state view
    await expect(page.locator('#empty-state-view')).toBeVisible();
    await expect(page.locator('#empty-state-title')).toContainText(/No notes found/i);
    await expect(page.locator('[data-testid="note-card"]')).toHaveCount(0);

    // 9. Return to full list via clear search link
    const clearLink = page.getByRole('link', { name: 'Clear search' });
    await expect(clearLink).toBeVisible();
    await clearLink.click();
    await expect(page.locator(`[data-testid="note-card"]:has-text("${uniqueTitle}")`)).toBeVisible();
  });
});
