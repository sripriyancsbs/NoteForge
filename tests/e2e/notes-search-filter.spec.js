// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Notes Search and Filter Workflows', () => {
  let uniqueKeyword;
  let noteTitle;
  let noteContent;

  test.beforeEach(async ({ request }) => {
    uniqueKeyword = `Quantum_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    noteTitle = `Searchable Note ${uniqueKeyword}`;
    noteContent = `Content mentioning specialized technical topic: ${uniqueKeyword}`;

    // Seed isolated test note via REST API
    const response = await request.post('/api/notes', {
      data: {
        title: noteTitle,
        content: noteContent,
        is_favorite: false,
      },
    });
    expect(response.status()).toBe(201);
  });

  test('should search notes by title/content keyword and filter results', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByTestId('search-input');
    await expect(searchInput).toBeVisible();

    // Type unique keyword and press Enter
    await searchInput.fill(uniqueKeyword);
    await searchInput.press('Enter');

    // Web-first assertion: matching note appears in search results
    const matchingCard = page.locator(`[data-testid="note-card"]:has-text("${noteTitle}")`);
    await expect(matchingCard).toBeVisible();

    // Verify header indicates search results query
    await expect(page.locator('#page-title-heading')).toContainText(uniqueKeyword);
  });

  test('should display product-quality empty state when no notes match search query', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByTestId('search-input');
    await searchInput.fill('NonExistentKeyword_999999999');
    await searchInput.press('Enter');

    // Empty state should be visible
    const emptyState = page.getByTestId('empty-state-view');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No notes found for');
  });

  test('should toggle note as favorite and view it in the Favorites category', async ({ page }) => {
    await page.goto('/');

    // Locate the note card
    const card = page.locator(`[data-testid="note-card"]:has-text("${noteTitle}")`);
    await expect(card).toBeVisible();

    // Click favorite button on the card
    const favBtn = card.getByTestId('fav-toggle-btn');
    await favBtn.click();

    // Navigate to Favorites sidebar link
    const favNavLink = page.getByTestId('nav-link-favorites');
    await favNavLink.click();
    await expect(page).toHaveURL(/\/\?category=favorites/);

    // Verify the favorited note is present in Favorites list
    const favoritedCard = page.locator(`[data-testid="note-card"]:has-text("${noteTitle}")`);
    await expect(favoritedCard).toBeVisible();

    // Untoggle favorite to clean up
    await favoritedCard.getByTestId('fav-toggle-btn').click();
  });
});
