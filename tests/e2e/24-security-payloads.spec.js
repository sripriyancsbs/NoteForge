// @ts-check
const { test, expect } = require('@playwright/test');
const { deleteTestNote } = require('./helpers');

test.describe('TEST SUITE 24 — SECURITY PAYLOADS & SAFE RENDERING', () => {
  let createdIds = [];

  test.afterEach(async ({ request }) => {
    for (const id of createdIds) {
      await deleteTestNote(request, id);
    }
    createdIds = [];
  });

  test('should safely handle HTML/XSS payloads without executing script or triggering alert dialogs', async ({ page }) => {
    let dialogTriggered = false;
    page.on('dialog', async dialog => {
      dialogTriggered = true;
      await dialog.dismiss();
    });

    // 1. Create a note with XSS payload via UI
    await page.goto('/notes/new');
    await page.getByTestId('note-title-editor').fill('XSS Defense Verification');
    const xssScript = '<script>alert("test")</script>\n<img src="invalid-image" onerror="alert(\'xss\')" />';
    await page.getByTestId('note-content-editor').fill(xssScript);

    // Verify preview renders safely without dialog
    const preview = page.getByTestId('markdown-preview-content');
    await expect(preview).toBeVisible();
    expect(dialogTriggered).toBe(false);

    // Save note
    await page.getByTestId('save-note-btn').click();
    await expect(page).toHaveURL(/\/notes\/\d+$/);
    const noteId = page.url().split('/').pop();
    if (noteId) createdIds.push(noteId);

    // Verify rendered content in reading view
    const viewContent = page.getByTestId('view-markdown-content');
    await expect(viewContent).toBeVisible();
    expect(dialogTriggered).toBe(false);

    // Verify script is rendered as harmless escaped text, not executable DOM element
    const scriptElements = viewContent.locator('script');
    await expect(scriptElements).toHaveCount(0);
    await expect(viewContent).toContainText('<script>alert("test")</script>');
  });

  test('should safely handle SQL-like injection strings, path traversal, and special characters', async ({ page }) => {
    const runId = Date.now();
    const sqliTitle = `' OR '1'='1 -- ${runId}`;
    const complexBody = `
### Boundary Cases
Path: ../../etc/passwd and ../../test
Special Symbols: < > " ' & %
SQL Payload: SELECT * FROM notes WHERE title = '' OR '1'='1';
`;

    await page.goto('/notes/new');
    await page.getByTestId('note-title-editor').fill(sqliTitle);
    await page.getByTestId('note-content-editor').fill(complexBody);
    await page.getByTestId('save-note-btn').click();

    await expect(page).toHaveURL(/\/notes\/\d+$/);
    const noteId = page.url().split('/').pop();
    if (noteId) createdIds.push(noteId);

    // Verify title and content render accurately
    await expect(page.getByTestId('view-note-title')).toHaveText(sqliTitle);
    const viewContent = page.getByTestId('view-markdown-content');
    await expect(viewContent).toContainText('../../etc/passwd');
    await expect(viewContent).toContainText('../../test');
    await expect(viewContent).toContainText('SELECT * FROM notes');

    // Return to index and search for SQL injection fragment
    await page.goto('/');
    const searchInput = page.getByTestId('search-input');
    await searchInput.fill("' OR '1'='1");
    await searchInput.press('Enter');

    // Should find the note safely without syntax error
    const card = page.locator(`[data-testid="note-card"]:has-text("${sqliTitle}")`);
    await expect(card).toBeVisible();
  });

  test('should preserve and accurately render Unicode, Japanese, Chinese, and emojis', async ({ page }) => {
    const runId = Date.now();
    const unicodeTitle = `多言語ノート こんにちは 你好 🚀 ${runId}`;
    const unicodeBody = `
# 日本語と中国語のテスト
- こんにちは (Hello in Japanese)
- 你好 (Hello in Chinese)
- 🚀 Rocket Launch
- ✨ Sparkles
- 🎯 Accuracy target
`;

    await page.goto('/notes/new');
    await page.getByTestId('note-title-editor').fill(unicodeTitle);
    await page.getByTestId('note-content-editor').fill(unicodeBody);
    await page.getByTestId('save-note-btn').click();

    await expect(page).toHaveURL(/\/notes\/\d+$/);
    const noteId = page.url().split('/').pop();
    if (noteId) createdIds.push(noteId);

    // Verify title and markdown rendered with emojis and multilingual characters
    await expect(page.getByTestId('view-note-title')).toHaveText(unicodeTitle);
    const viewContent = page.getByTestId('view-markdown-content');
    await expect(viewContent.locator('h1')).toHaveText('日本語と中国語のテスト');
    await expect(viewContent).toContainText('こんにちは (Hello in Japanese)');
    await expect(viewContent).toContainText('你好 (Hello in Chinese)');
    await expect(viewContent).toContainText('🚀 Rocket Launch');

    // Reload page to verify database persistence of unicode
    await page.reload();
    await expect(page.getByTestId('view-note-title')).toHaveText(unicodeTitle);
  });
});
