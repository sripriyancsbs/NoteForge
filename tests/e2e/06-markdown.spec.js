// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('TEST SUITE 6 — MARKDOWN RENDERING', () => {
  test('should render markdown syntax into real HTML elements: h1, strong, em, ul/li, and code', async ({ page, request }) => {
    const testId = Date.now();
    const noteTitle = `Markdown Specification Note ${testId}`;

    const rawMarkdown = `
# Heading

**bold**

*italic*

- item 1
- item 2

\`inline code\`
`;

    // 1. Create the note containing the exact required Markdown syntax
    const resp = await request.post('/api/notes', {
      data: { title: noteTitle, content: rawMarkdown }
    });
    expect(resp.status()).toBe(201);
    const noteData = await resp.json();

    // 2. Open the note reading view
    await page.goto(`/notes/${noteData.id}`);
    await expect(page.getByTestId('view-note-title')).toHaveText(noteTitle);

    const contentContainer = page.getByTestId('view-markdown-content');
    await expect(contentContainer).toBeVisible();

    // 3. Verify that the rendered note contains the correct HTML elements (not merely raw text)

    // Heading -> <h1>
    const h1 = contentContainer.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Heading');

    // Bold -> <strong>
    const strong = contentContainer.locator('strong');
    await expect(strong).toHaveCount(1);
    await expect(strong).toHaveText('bold');

    // Italic -> <em>
    const em = contentContainer.locator('em');
    await expect(em).toHaveCount(1);
    await expect(em).toHaveText('italic');

    // List -> <ul> and <li>
    const ul = contentContainer.locator('ul');
    await expect(ul).toHaveCount(1);
    const listItems = ul.locator('li');
    await expect(listItems).toHaveCount(2);
    await expect(listItems.nth(0)).toHaveText('item 1');
    await expect(listItems.nth(1)).toHaveText('item 2');

    // Inline code -> <code>
    const inlineCode = contentContainer.locator('code');
    await expect(inlineCode).toHaveCount(1);
    await expect(inlineCode).toHaveText('inline code');

    // Verify raw unparsed markdown symbols are NOT exposed in plain body text
    const innerText = await contentContainer.innerText();
    expect(innerText).not.toContain('# Heading');
    expect(innerText).not.toContain('**bold**');
    expect(innerText).not.toContain('*italic*');
    expect(innerText).not.toContain('`inline code`');
  });
});
