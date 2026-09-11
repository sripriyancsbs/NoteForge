// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('TEST SUITE 15 — LIVE MARKDOWN PREVIEW', () => {
  test('should render live debounced mistune HTML preview as user types in editor and dynamically update on content changes', async ({ page }) => {
    // 1. Navigate to New Note editor
    await page.goto('/notes/new');
    await expect(page).toHaveTitle(/New Note — NOTEForge/);

    const textarea = page.getByTestId('note-content-editor');
    const previewPane = page.getByTestId('markdown-preview-content');

    await expect(textarea).toBeVisible();
    await expect(previewPane).toBeVisible();

    // 2. Clear editor and verify empty preview placeholder
    await textarea.fill('');
    await expect(previewPane).toContainText('Nothing to preview yet.');

    // 3. Type rich Markdown syntax into the editor
    const markdownInput1 = [
      '# Live Heading Level 1',
      '',
      'Testing **bold accentuation** and *italicized emphasis*.',
      '',
      '- First checklist item',
      '- Second checklist item',
      '',
      '`const activeSession = true;`',
    ].join('\n');

    await textarea.fill(markdownInput1);

    // 4. Verify preview updates without arbitrary sleep delays using web-first locators
    // Heading -> <h1>
    const h1 = previewPane.locator('h1');
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText('Live Heading Level 1');

    // Bold -> <strong>
    const strong = previewPane.locator('strong');
    await expect(strong).toBeVisible();
    await expect(strong).toHaveText('bold accentuation');

    // Italic -> <em>
    const em = previewPane.locator('em');
    await expect(em).toBeVisible();
    await expect(em).toHaveText('italicized emphasis');

    // List -> <ul> and <li>
    const listItems = previewPane.locator('ul li');
    await expect(listItems).toHaveCount(2);
    await expect(listItems.nth(0)).toHaveText('First checklist item');
    await expect(listItems.nth(1)).toHaveText('Second checklist item');

    // Code -> <code>
    const code = previewPane.locator('code');
    await expect(code).toBeVisible();
    await expect(code).toHaveText('const activeSession = true;');

    // Verify word count updates in preview badge
    const wordCount = page.locator('#preview-word-count');
    await expect(wordCount).toContainText('words');

    // 5. Change content dynamically and assert that preview updates again
    const markdownInput2 = [
      '### Subheading Phase Two',
      '',
      '> Dynamic live quote verification.',
    ].join('\n');

    await textarea.fill(markdownInput2);

    // Verify preview reflects updated content
    const h3 = previewPane.locator('h3');
    await expect(h3).toBeVisible();
    await expect(h3).toHaveText('Subheading Phase Two');

    const blockquote = previewPane.locator('blockquote');
    await expect(blockquote).toBeVisible();
    await expect(blockquote).toContainText('Dynamic live quote verification.');

    // Verify old elements are no longer in preview
    await expect(previewPane.locator('h1')).toHaveCount(0);
    await expect(previewPane.locator('ul')).toHaveCount(0);
  });
});
