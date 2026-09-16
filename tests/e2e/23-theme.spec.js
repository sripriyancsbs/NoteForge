// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('TEST SUITE 23 — THEME SYSTEM & PERSISTENCE', () => {
  test('should detect active theme, toggle opposite theme, maintain contrast, persist across reload, and toggle back', async ({ page }) => {
    // 1. Visit application
    await page.goto('/');
    await expect(page).toHaveTitle(/NOTEForge/);

    const htmlRoot = page.locator('html');
    const themeBtn = page.getByTestId('theme-toggle-btn');
    const themeModeText = page.locator('#theme-mode-text');

    await expect(themeBtn).toBeVisible();

    // 2. Identify initial theme (respects stored theme or system preference)
    const initialTheme = (await htmlRoot.getAttribute('data-theme')) || 'dark';
    const targetOppositeTheme = initialTheme === 'dark' ? 'light' : 'dark';
    const targetOppositeLabel = targetOppositeTheme === 'light' ? 'Light' : 'Dark';

    // 3. Toggle to opposite theme
    await themeBtn.click();
    await expect(htmlRoot).toHaveAttribute('data-theme', targetOppositeTheme);
    await expect(themeModeText).toHaveText(targetOppositeLabel);

    // Verify localStorage persistence flag
    const storedTheme = await page.evaluate(() => localStorage.getItem('noteforge-theme'));
    expect(storedTheme).toBe(targetOppositeTheme);

    // 4. Verify UI elements remain visible, legible, and interactive
    await expect(page.locator('#top-navigation')).toBeVisible();
    await expect(page.getByTestId('search-input')).toBeVisible();
    await expect(page.getByTestId('header-new-note-btn')).toBeVisible();

    // 5. Reload the page and verify theme persistence (prevents flash of incorrect theme)
    await page.reload();
    await expect(htmlRoot).toHaveAttribute('data-theme', targetOppositeTheme);
    await expect(themeModeText).toHaveText(targetOppositeLabel);

    // 6. Navigate to New Note editor in active theme and verify readability
    await page.getByTestId('header-new-note-btn').click();
    await expect(page).toHaveURL(/\/notes\/new$/);
    await expect(htmlRoot).toHaveAttribute('data-theme', targetOppositeTheme);

    const titleInput = page.getByTestId('note-title-editor');
    const contentTextarea = page.getByTestId('note-content-editor');
    const previewPane = page.getByTestId('markdown-preview-content');

    await expect(titleInput).toBeVisible();
    await expect(contentTextarea).toBeVisible();
    await expect(previewPane).toBeVisible();

    // Fill markdown content and verify preview is legible
    await titleInput.fill('Theme Verification Note');
    await contentTextarea.fill('## Dynamic Theme Architecture\n\nTesting syntax highlighting and code block contrast:\n```python\nval = 42\n```');
    await expect(previewPane.locator('h2')).toHaveText('Dynamic Theme Architecture');
    await expect(previewPane.locator('code')).toBeVisible();

    // 7. Toggle back to original theme
    await page.goto('/');
    const themeBtnHome = page.getByTestId('theme-toggle-btn');
    await themeBtnHome.click();

    await expect(htmlRoot).toHaveAttribute('data-theme', initialTheme);
    const initialLabel = initialTheme === 'light' ? 'Light' : 'Dark';
    await expect(themeModeText).toHaveText(initialLabel);

    const restoredStoredTheme = await page.evaluate(() => localStorage.getItem('noteforge-theme'));
    expect(restoredStoredTheme).toBe(initialTheme);
  });
});
