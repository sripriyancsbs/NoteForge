// @ts-check
const { test, expect } = require('@playwright/test');
const { deleteTestNote } = require('./helpers');

test.describe('TEST SUITE 10 — RESPONSIVE UI', () => {
  const VIEWPORTS = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 667 },
  ];

  for (const vp of VIEWPORTS) {
    test(`should verify responsive layout, usability, and zero horizontal overflow on ${vp.name} (${vp.width}x${vp.height})`, async ({ page, request }) => {
      const runId = Date.now();
      const noteTitle = `Responsive Test ${vp.name} ${runId}`;
      const noteBody = `## Responsive Note for ${vp.name}\n\nTesting layout adaptability at width ${vp.width}px.`;
      let createdId = null;

      // Seed a note for list viewing
      const seedRes = await request.post('/api/notes', {
        data: { title: noteTitle, content: noteBody }
      });
      const seedNote = await seedRes.json();

      try {

      // 1. Set viewport
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // 2. Load home page
      await page.goto('/');
      await expect(page).toHaveTitle(/All Notes — NOTEForge/);

      // Verify zero horizontal overflow on list page
      const hasNoHorizontalOverflowList = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth + 1;
      });
      expect(hasNoHorizontalOverflowList).toBe(true);

      // Verify header and primary action button remain accessible
      const brandLogo = page.locator('#brand-link');
      await expect(brandLogo).toBeVisible();

      const newNoteBtn = page.getByTestId('header-new-note-btn');
      await expect(newNoteBtn).toBeVisible();

      // Verify note card is visible and accessible
      const card = page.locator(`[data-testid="note-card"]:has-text("${noteTitle}")`);
      await expect(card).toBeVisible();

      // On desktop, sidebar is visible; on mobile/tablet (<=768px), sidebar is hidden cleanly
      const sidebar = page.locator('#navigation-sidebar');
      if (vp.width > 768) {
        await expect(sidebar).toBeVisible();
      } else {
        await expect(sidebar).toBeHidden();
      }

      // 3. Open editor
      await newNoteBtn.click();
      await expect(page).toHaveURL(/\/notes\/new$/);

      // Verify zero horizontal overflow in editor
      const hasNoHorizontalOverflowEditor = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth + 1;
      });
      expect(hasNoHorizontalOverflowEditor).toBe(true);

      const titleInput = page.getByTestId('note-title-editor');
      const contentEditor = page.getByTestId('note-content-editor');
      const saveBtn = page.getByTestId('save-note-btn');

      await expect(titleInput).toBeVisible();
      await expect(saveBtn).toBeVisible();

      const createdTitle = `Created on ${vp.name} ${runId}`;
      const createdMarkdown = `# Head on ${vp.name}\n\nTesting responsive typing and preview.`;

      await titleInput.fill(createdTitle);
      await contentEditor.fill(createdMarkdown);

      if (vp.width <= 768) {
        // In mobile/tablet layout, verify mobile tab toggle bar exists
        const mobileTabBar = page.locator('#mobile-tab-bar');
        await expect(mobileTabBar).toBeVisible();

        const previewTabBtn = page.locator('#tab-btn-preview');
        const editorTabBtn = page.locator('#tab-btn-editor');

        // Switch to Preview tab
        await previewTabBtn.click();
        const previewPane = page.locator('#editor-right-pane');
        await expect(previewPane).toBeVisible();
        await expect(page.getByTestId('markdown-preview-content').locator('h1')).toHaveText(`Head on ${vp.name}`);

        // Switch back to Editor tab
        await editorTabBtn.click();
        await expect(page.locator('#editor-left-pane')).toBeVisible();
      } else {
        // On desktop, both panes are visible side by side simultaneously
        await expect(page.locator('#editor-left-pane')).toBeVisible();
        await expect(page.locator('#editor-right-pane')).toBeVisible();
        await expect(page.getByTestId('markdown-preview-content').locator('h1')).toHaveText(`Head on ${vp.name}`);
      }

      // Save note and verify view page responsiveness
      await saveBtn.click();
      await expect(page).toHaveURL(/\/notes\/\d+$/);
      const urlMatch = page.url().match(/\/notes\/(\d+)$/);
      if (urlMatch) createdId = urlMatch[1];

      // Verify view page elements
      await expect(page.getByTestId('view-note-title')).toHaveText(createdTitle);
      await expect(page.getByTestId('view-edit-btn')).toBeVisible();
      await expect(page.getByTestId('view-delete-btn')).toBeVisible();

      const hasNoHorizontalOverflowView = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth + 1;
      });
      expect(hasNoHorizontalOverflowView).toBe(true);
      } finally {
        await deleteTestNote(request, seedNote.id);
        await deleteTestNote(request, createdId);
      }
    });
  }
});
