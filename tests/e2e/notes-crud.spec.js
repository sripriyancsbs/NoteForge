// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Notes CRUD Operations', () => {
  test('should create a new note with live mistune preview and save successfully', async ({ page }) => {
    const testId = Date.now();
    const noteTitle = `E2E Create Note ${testId}`;
    const noteContent = `# Header for ${testId}\n\nThis is a **bold** paragraph with a checklist:\n- [x] Item completed\n- [ ] Item pending\n\n\`\`\`python\ndef test(): pass\n\`\`\``;

    // 1. Navigate to home
    await page.goto('/');
    await expect(page).toHaveTitle(/NOTEForge/);

    // 2. Click "New Note" action
    const newNoteBtn = page.getByTestId('header-new-note-btn');
    await expect(newNoteBtn).toBeVisible();
    await newNoteBtn.click();

    // 3. Verify editor page loaded
    await expect(page).toHaveURL(/\/notes\/new$/);
    const titleInput = page.getByTestId('note-title-editor');
    const contentInput = page.getByTestId('note-content-editor');
    const previewPane = page.getByTestId('markdown-preview-content');

    await expect(titleInput).toBeVisible();
    await expect(contentInput).toBeVisible();

    // 4. Fill in title and markdown content
    await titleInput.fill(noteTitle);
    await contentInput.fill(noteContent);

    // 5. Verify web-first assertion on live mistune preview (no arbitrary sleep)
    await expect(previewPane.locator('h1')).toHaveText(`Header for ${testId}`);
    await expect(previewPane.locator('strong')).toHaveText('bold');
    await expect(previewPane.locator('pre code')).toBeVisible();

    // 6. Save the note
    const saveBtn = page.getByTestId('save-note-btn');
    await saveBtn.click();

    // 7. Verify redirect to single note reading view
    await expect(page).toHaveURL(/\/notes\/\d+$/);
    await expect(page.getByTestId('view-note-title')).toHaveText(noteTitle);
    await expect(page.getByTestId('view-markdown-content').locator('h1')).toHaveText(`Header for ${testId}`);

    // 8. Return to workspace and verify card exists in All Notes
    await page.getByTestId('view-back-btn').click();
    await expect(page).toHaveURL('/');
    const noteCard = page.locator(`[data-testid="note-card"]:has-text("${noteTitle}")`);
    await expect(noteCard).toBeVisible();
  });

  test('should edit an existing note and update its contents', async ({ page, request }) => {
    const testId = Date.now();
    const initialTitle = `E2E Pre-Edit Note ${testId}`;
    const initialContent = `Initial content before editing ${testId}`;
    const updatedTitle = `E2E Post-Edit Note ${testId}`;
    const updatedContent = `## Updated Header\n\nContent revised for test isolation.`;

    // 1. Seed note via API for test isolation
    const seedResp = await request.post('/api/notes', {
      data: { title: initialTitle, content: initialContent }
    });
    expect(seedResp.status()).toBe(201);
    const noteData = await seedResp.json();

    // 2. Open note reading view directly
    await page.goto(`/notes/${noteData.id}`);
    await expect(page.getByTestId('view-note-title')).toHaveText(initialTitle);

    // 3. Click "Edit"
    const editBtn = page.getByTestId('view-edit-btn');
    await editBtn.click();
    await expect(page).toHaveURL(new RegExp(`/notes/${noteData.id}/edit$`));

    // 4. Update title and content
    const titleInput = page.getByTestId('note-title-editor');
    const contentInput = page.getByTestId('note-content-editor');
    await titleInput.fill(updatedTitle);
    await contentInput.fill(updatedContent);

    // 5. Save the updated note
    await page.getByTestId('save-note-btn').click();

    // 6. Verify changes on view page
    await expect(page).toHaveURL(new RegExp(`/notes/${noteData.id}$`));
    await expect(page.getByTestId('view-note-title')).toHaveText(updatedTitle);
    await expect(page.getByTestId('view-markdown-content').locator('h2')).toHaveText('Updated Header');
  });

  test('should move note to trash and permanently delete it', async ({ page, request }) => {
    const testId = Date.now();
    const deleteTitle = `E2E Delete Note ${testId}`;

    // 1. Seed note via API for test isolation
    const seedResp = await request.post('/api/notes', {
      data: { title: deleteTitle, content: `Content to be deleted ${testId}` }
    });
    expect(seedResp.status()).toBe(201);
    const noteData = await seedResp.json();

    // 2. Open view
    await page.goto(`/notes/${noteData.id}`);

    // 3. Click delete button
    await page.getByTestId('view-delete-btn').click();

    // 4. Confirmation modal opens
    const confirmBtn = page.getByTestId('btn-confirm-delete');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 5. Verify redirected to home and note is removed from active workspace
    await expect(page).toHaveURL('/');
    await expect(page.locator(`[data-testid="note-card"]:has-text("${deleteTitle}")`)).not.toBeVisible();

    // 6. Navigate to Trash
    await page.getByTestId('nav-link-trash').click();
    await expect(page).toHaveURL(/\/\?category=trash/);

    const trashedCard = page.locator(`[data-testid="note-card"]:has-text("${deleteTitle}")`);
    await expect(trashedCard).toBeVisible();

    // 7. Permanently delete from trash
    const deletePermBtn = trashedCard.getByTestId('delete-perm-btn');
    await deletePermBtn.click();

    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 8. Verify permanently removed from trash
    await expect(trashedCard).not.toBeVisible();
  });
});
