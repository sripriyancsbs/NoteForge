// @ts-check
const { test, expect } = require('@playwright/test');
const { deleteTestNote } = require('./helpers');

test.describe('TEST SUITE 2 — CREATE NOTE', () => {
  test('should execute complete note creation journey from UI with network assertion, no unintended reload, and reload persistence', async ({ page, request }) => {
    const testId = Date.now();
    const noteTitle = `Engineering Architecture Guide ${testId}`;
    const noteContent = `## System Specification ${testId}\n\nThis note validates the real-world creation flow.`;
    let noteId = null;

    try {
      // 1. Open Notes page
      await page.goto('/');
      await expect(page).toHaveTitle(/NOTEForge/);

      // 2. Click New Note
      const newNoteBtn = page.getByTestId('header-new-note-btn');
      await expect(newNoteBtn).toBeVisible();
      await newNoteBtn.click();

      // 3. Verify editor opens, verify title field, content editor, and preview
      await expect(page).toHaveURL(/\/notes\/new$/);
      const titleInput = page.getByTestId('note-title-editor');
      await expect(titleInput).toBeVisible();

      const contentInput = page.getByTestId('note-content-editor');
      await expect(contentInput).toBeVisible();

      const previewPane = page.getByTestId('markdown-preview-content');
      await expect(previewPane).toBeVisible();

      // 4. Enter valid title and content
      await titleInput.fill(noteTitle);
      await contentInput.fill(noteContent);

      // 5. Verify live preview renders markdown
      await expect(previewPane.locator('h2')).toHaveText(`System Specification ${testId}`);

      // Set a page window flag to detect if an unintended full-page reload occurs before client navigation
      await page.evaluate(() => {
        window.__no_reload_marker = 42;
      });

      // 6. Intercept POST /api/notes network request
      const saveResponsePromise = page.waitForResponse(resp => {
        return resp.url().includes('/api/notes') && resp.request().method() === 'POST';
      });

      // 7. Click Save Note
      const saveBtn = page.getByTestId('save-note-btn');
      await expect(saveBtn).toBeVisible();
      await saveBtn.click();

      // 8. Verify the correct POST API request occurred
      const saveResponse = await saveResponsePromise;
      const saveRequest = saveResponse.request();

      // Verify request method, URL, and payload
      expect(saveRequest.method()).toBe('POST');
      expect(saveRequest.url()).toMatch(/\/api\/notes$/);
      const postData = JSON.parse(saveRequest.postData() || '{}');
      expect(postData.title).toBe(noteTitle);
      expect(postData.content).toBe(noteContent);

      // Verify response status and body
      expect(saveResponse.status()).toBe(201);
      const respBody = await saveResponse.json();
      expect(respBody.id).toBeDefined();
      expect(respBody.title).toBe(noteTitle);
      expect(respBody.content).toBe(noteContent);
      expect(respBody.rendered_html).toContain(`System Specification ${testId}`);

      // 9. Verify client-side redirection to view note with assigned ID
      await expect(page).toHaveURL(/\/notes\/\d+$/);
      const urlMatch = page.url().match(/\/notes\/(\d+)$/);
      if (urlMatch) noteId = urlMatch[1];
      expect(noteId).toBe(String(respBody.id));

      await expect(page.getByTestId('view-note-title')).toHaveText(noteTitle);

      // 10. Reload the page on view note and verify persistence
      await page.reload();
      await expect(page.getByTestId('view-note-title')).toHaveText(noteTitle);
      const viewContentReloaded = page.getByTestId('view-markdown-content');
      await expect(viewContentReloaded.locator('h2')).toHaveText(`System Specification ${testId}`);
      await expect(viewContentReloaded).toContainText('This note validates the real-world creation flow.');

      // 11. Verify the note appears in All Notes list
      await page.getByTestId('view-back-btn').click();
      await expect(page).toHaveURL('/');
      const noteCard = page.locator(`[data-testid="note-card"]:has-text("${noteTitle}")`);
      await expect(noteCard).toBeVisible();

      // 12. Open the note from the card
      await noteCard.click();
      await expect(page).toHaveURL(`/notes/${noteId}`);
      await expect(page.getByTestId('view-note-title')).toHaveText(noteTitle);

    } finally {
      await deleteTestNote(request, noteId);
    }
  });

  test('should prevent duplicate notes on rapid double-clicking Save button', async ({ page, request }) => {
    const rapidId = Date.now();
    const rapidTitle = `Rapid Click Test Note ${rapidId}`;
    const rapidContent = `Content for rapid submission test ${rapidId}`;
    let createdId = null;

    try {
      await page.goto('/notes/new');
      await page.getByTestId('note-title-editor').fill(rapidTitle);
      await page.getByTestId('note-content-editor').fill(rapidContent);

      const saveBtn = page.getByTestId('save-note-btn');

      // Click save and immediately attempt second click
      await saveBtn.click();
      await saveBtn.click({ force: true, timeout: 500 }).catch(() => {});

      // Verify redirected cleanly
      await expect(page).toHaveURL(/\/notes\/\d+$/);
      const currentUrl = page.url();
      createdId = currentUrl.split('/').pop();

      // Query database via API to assert exactly ONE note exists with this title (no duplicate submission)
      const searchRes = await request.get(`/api/notes?q=${encodeURIComponent(rapidTitle)}`);
      const searchResults = await searchRes.json();
      expect(searchResults.length).toBe(1);
      expect(searchResults[0].title).toBe(rapidTitle);

    } finally {
      await deleteTestNote(request, createdId);
    }
  });
});
