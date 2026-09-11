// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('TEST SUITE 17 — MARKDOWN EDITOR TOOLBAR', () => {
  test('should insert Markdown syntax into textarea on clicking toolbar buttons and update live preview', async ({ page }) => {
    // 1. Open New Note editor
    await page.goto('/notes/new');
    await expect(page).toHaveTitle(/New Note — NOTEForge/);

    const textarea = page.getByTestId('note-content-editor');
    const previewPane = page.getByTestId('markdown-preview-content');

    // Clear textarea
    await textarea.fill('');

    // --- Action 1: Heading Button (#tb-heading) ---
    const headingBtn = page.locator('#tb-heading');
    await expect(headingBtn).toBeVisible();
    await headingBtn.click();

    // Verify textarea contains markdown heading syntax
    await expect(textarea).toHaveValue(/## Heading/);
    // Verify live preview renders <h2>
    await expect(previewPane.locator('h2')).toHaveText('Heading');

    // --- Action 2: Bold Button (#tb-bold) with text selection ---
    await textarea.fill('Highlighting sample words for bolding.');
    // Select "sample words"
    await page.evaluate(() => {
      const el = /** @type {HTMLTextAreaElement} */ (document.getElementById('note-content-editor'));
      el.focus();
      el.setSelectionRange(13, 25);
    });

    const boldBtn = page.locator('#tb-bold');
    await expect(boldBtn).toBeVisible();
    await boldBtn.click();

    // Verify textarea has wrapped selection in **
    await expect(textarea).toHaveValue('Highlighting **sample words** for bolding.');
    // Verify preview renders <strong>
    await expect(previewPane.locator('strong')).toHaveText('sample words');

    // --- Action 3: Italic Button (#tb-italic) ---
    await textarea.fill('');
    const italicBtn = page.locator('#tb-italic');
    await expect(italicBtn).toBeVisible();
    await italicBtn.click();

    await expect(textarea).toHaveValue(/\*italic text\*/);
    await expect(previewPane.locator('em')).toHaveText('italic text');

    // --- Action 4: List Button (#tb-list) ---
    await textarea.fill('');
    const listBtn = page.locator('#tb-list');
    await expect(listBtn).toBeVisible();
    await listBtn.click();

    await expect(textarea).toHaveValue(/- List item/);
    await expect(previewPane.locator('ul li')).toHaveText('List item');

    // --- Action 5: Code Block Button (#tb-code) ---
    await textarea.fill('');
    const codeBtn = page.locator('#tb-code');
    await expect(codeBtn).toBeVisible();
    await codeBtn.click();

    await expect(textarea).toHaveValue(/```python/);
    await expect(previewPane.locator('pre code')).toBeVisible();

    // --- Action 6: Markdown Table Button (#tb-table) ---
    await textarea.fill('');
    const tableBtn = page.locator('#tb-table');
    await expect(tableBtn).toBeVisible();
    await tableBtn.click();

    await expect(textarea).toHaveValue(/\| Column 1 \| Column 2 \| Column 3 \|/);
    // Verify preview compiles into HTML <table>
    await expect(previewPane.locator('table')).toBeVisible();
    await expect(previewPane.locator('table th').first()).toHaveText('Column 1');
  });
});
