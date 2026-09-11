// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('TEST SUITE 3 — VIEW NOTE', () => {
  test('should display note title, rendered mistune Markdown, timestamp metadata, edit action, and delete action', async ({ page, request }) => {
    const testId = Date.now();
    const noteTitle = `View Inspection Test Note ${testId}`;
    const noteContent = `### Heading Level 3\n\nRendered paragraph content with **bold accent**.\n\n> Blockquote line`;

    // 1. Create a test note via API
    const response = await request.post('/api/notes', {
      data: { title: noteTitle, content: noteContent }
    });
    expect(response.status()).toBe(201);
    const noteData = await response.json();

    // 2. Open it
    await page.goto(`/notes/${noteData.id}`);
    await expect(page).toHaveURL(new RegExp(`/notes/${noteData.id}$`));

    // 3. Verify title is correct
    const titleLocator = page.getByTestId('view-note-title');
    await expect(titleLocator).toBeVisible();
    await expect(titleLocator).toHaveText(noteTitle);

    // 4. Verify Markdown content is rendered
    const contentLocator = page.getByTestId('view-markdown-content');
    await expect(contentLocator.locator('h3')).toHaveText('Heading Level 3');
    await expect(contentLocator.locator('strong')).toHaveText('bold accent');
    await expect(contentLocator.locator('blockquote')).toContainText('Blockquote line');

    // 5. Verify created/updated information is displayed
    const metaLocator = page.getByTestId('view-note-meta');
    await expect(metaLocator).toBeVisible();
    await expect(metaLocator).toContainText('Created');
    await expect(metaLocator).toContainText('Last modified');
    await expect(metaLocator).toContainText('min read');

    // 6. Verify Edit action exists
    const editBtn = page.getByTestId('view-edit-btn');
    await expect(editBtn).toBeVisible();
    await expect(editBtn).toHaveAttribute('href', `/notes/${noteData.id}/edit`);

    // 7. Verify Delete action exists
    const deleteBtn = page.getByTestId('view-delete-btn');
    await expect(deleteBtn).toBeVisible();
  });
});
