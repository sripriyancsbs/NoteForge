// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Live Markdown Preview & Editor Capabilities', () => {
  test('should render markdown tables, checklists, and code blocks live via mistune', async ({ page }) => {
    await page.goto('/notes/new');

    const titleInput = page.getByTestId('note-title-editor');
    const contentTextarea = page.getByTestId('note-content-editor');
    const previewPane = page.getByTestId('markdown-preview-content');

    await titleInput.fill('Mistune Formatting Validation');

    // Type complex Markdown including tables, checklists, and code
    const complexMarkdown = `
# Engineering Runbook

| Service | Port | Status |
| :--- | :--- | :--- |
| Flask | 5000 | Active |
| Postgres | 5432 | Ready |

### Deployment Tasks
- [x] Run unit tests
- [ ] Deploy container

\`\`\`python
def verify_pipeline():
    return True
\`\`\`

> "Continuous delivery is not about doing things faster, it is about doing things safer."
`;

    await contentTextarea.fill(complexMarkdown);

    // Assert live preview updates with mistune-generated elements
    await expect(previewPane.locator('h1')).toHaveText('Engineering Runbook');
    await expect(previewPane.locator('table')).toBeVisible();
    await expect(previewPane.locator('table th').first()).toHaveText('Service');
    await expect(previewPane.locator('table td').first()).toHaveText('Flask');

    // Check task list checkbox
    await expect(previewPane.locator('input[type="checkbox"]').first()).toBeChecked();

    // Check code block
    await expect(previewPane.locator('pre code')).toBeVisible();

    // Check blockquote
    await expect(previewPane.locator('blockquote')).toContainText('Continuous delivery');
  });

  test('should show validation feedback when trying to save note with empty title or content', async ({ page }) => {
    await page.goto('/notes/new');

    const saveBtn = page.getByTestId('save-note-btn');
    await saveBtn.click();

    // Toast alert should display validation error
    const toast = page.locator('#toast-container .toast-error');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Please enter a note title');
  });
});
