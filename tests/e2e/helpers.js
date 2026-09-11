// @ts-check

/**
 * Creates a unique test note via API.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {{ title: string, content: string, is_favorite?: boolean }} data
 * @returns {Promise<{ id: number, title: string, content: string, is_favorite: boolean, is_trashed: boolean }>}
 */
async function createTestNote(request, data) {
  const res = await request.post('/api/notes', { data });
  if (!res.ok()) {
    throw new Error(`Failed to create test note: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Permanently deletes a note via API so tests do not accumulate database records.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {number|string} noteId
 */
async function deleteTestNote(request, noteId) {
  if (!noteId) return;
  try {
    await request.delete(`/api/notes/${noteId}?permanent=true`);
  } catch {
    // Suppress error if already deleted
  }
}

module.exports = {
  createTestNote,
  deleteTestNote,
};
