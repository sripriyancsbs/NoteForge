/* ==========================================================================
   NOTEForge Application Logic
   - Backend mistune Markdown rendering & live debounced sync
   - Dual-theme persistence (Dark Slate & Light Paper)
   - Keyboard shortcuts (Ctrl+S, Ctrl+K, Ctrl+N, Esc)
   - Toast notifications & accessible modal confirmation
   ========================================================================== */

(function () {
  'use strict';

  // State
  let previewDebounceTimer = null;
  let activeDeleteId = null;
  let activeDeleteIsPermanent = false;

  // DOM Elements
  const searchInput = document.getElementById('search-input');
  const markdownTextarea = document.getElementById('note-content-editor');
  const markdownPreviewPane = document.getElementById('markdown-preview-content');
  const noteTitleInput = document.getElementById('note-title-editor');
  const saveBtn = document.getElementById('btn-save-note');
  const deleteModal = document.getElementById('delete-modal');
  const cancelDeleteBtn = document.getElementById('btn-cancel-delete');
  const confirmDeleteBtn = document.getElementById('btn-confirm-delete');
  const wordCountDisplay = document.getElementById('preview-word-count');

  // --------------------------------------------------------------------------
  // Theme Management System (Dark / Light with LocalStorage Persistence)
  // --------------------------------------------------------------------------
  function updateThemeUI(theme) {
    const modeText = document.getElementById('theme-mode-text');
    const icon = document.getElementById('theme-icon-indicator');
    if (modeText) {
      modeText.textContent = theme === 'light' ? 'Light' : 'Dark';
    }
    if (icon) {
      if (theme === 'light') {
        icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
      } else {
        icon.innerHTML = `
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        `;
      }
    }
  }

  window.toggleTheme = function () {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    try {
      localStorage.setItem('noteforge-theme', newTheme);
    } catch {
      // Ignore storage errors in private browsing modes
    }
    updateThemeUI(newTheme);
  };

  // Sync theme UI on load
  const initialTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  updateThemeUI(initialTheme);

  // --------------------------------------------------------------------------
  // Toast Notification System
  // --------------------------------------------------------------------------
  window.showToast = function (message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
      iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    }

    toast.innerHTML = `
      <span style="display:inline-flex;color:inherit;flex-shrink:0;">${iconSvg}</span>
      <span style="flex:1;">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 200);
    }, 3200);
  };

  // --------------------------------------------------------------------------
  // Backend mistune Markdown Live Preview
  // --------------------------------------------------------------------------
  function renderLiveMarkdown() {
    if (!markdownTextarea || !markdownPreviewPane) return;

    const content = markdownTextarea.value;

    fetch('/api/markdown/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content })
    })
      .then(response => {
        if (!response.ok) throw new Error('Preview rendering failed');
        return response.json();
      })
      .then(data => {
        markdownPreviewPane.innerHTML = data.html || '<p style="color:var(--text-muted);font-style:italic;">Nothing to preview yet.</p>';
        if (wordCountDisplay) {
          wordCountDisplay.textContent = `${data.word_count} words`;
        }
      })
      .catch(err => {
        console.error('Markdown preview error:', err);
      });
  }

  function schedulePreviewUpdate() {
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(renderLiveMarkdown, 180);
  }

  if (markdownTextarea) {
    markdownTextarea.addEventListener('input', schedulePreviewUpdate);
    // Initial preview render on editor load
    renderLiveMarkdown();
  }

  // --------------------------------------------------------------------------
  // Toolbar Actions
  // --------------------------------------------------------------------------
  window.insertMarkdownSyntax = function (syntaxType) {
    if (!markdownTextarea) return;

    const start = markdownTextarea.selectionStart;
    const end = markdownTextarea.selectionEnd;
    const text = markdownTextarea.value;
    const selection = text.substring(start, end);

    let replacement = '';
    let cursorOffset = 0;

    switch (syntaxType) {
      case 'bold':
        replacement = `**${selection || 'bold text'}**`;
        cursorOffset = selection ? replacement.length : 2;
        break;
      case 'italic':
        replacement = `*${selection || 'italic text'}*`;
        cursorOffset = selection ? replacement.length : 1;
        break;
      case 'heading':
        replacement = `\n## ${selection || 'Heading'}\n`;
        cursorOffset = replacement.length;
        break;
      case 'quote':
        replacement = `\n> ${selection || 'Quote'}\n`;
        cursorOffset = replacement.length;
        break;
      case 'code':
        replacement = selection ? `\`${selection}\`` : `\n\`\`\`python\n# code block\n\`\`\`\n`;
        cursorOffset = replacement.length;
        break;
      case 'list':
        replacement = `\n- ${selection || 'List item'}\n`;
        cursorOffset = replacement.length;
        break;
      case 'task':
        replacement = `\n- [ ] ${selection || 'Task item'}\n`;
        cursorOffset = replacement.length;
        break;
      case 'table':
        replacement = `\n| Column 1 | Column 2 | Column 3 |\n| :--- | :--- | :--- |\n| Row 1 | Data A | 100 |\n| Row 2 | Data B | 200 |\n`;
        cursorOffset = replacement.length;
        break;
      default:
        return;
    }

    markdownTextarea.value = text.substring(0, start) + replacement + text.substring(end);
    markdownTextarea.focus();
    markdownTextarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
    schedulePreviewUpdate();
  };

  // --------------------------------------------------------------------------
  // Save Note (Create or Update)
  // --------------------------------------------------------------------------
  window.saveCurrentNote = function (event) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    if (!noteTitleInput || !markdownTextarea) return;

    const title = noteTitleInput.value.trim();
    const content = markdownTextarea.value.trim();
    const noteId = noteTitleInput.getAttribute('data-note-id');

    if (!title) {
      showToast('Please enter a note title', 'error');
      noteTitleInput.focus();
      return;
    }

    if (!content) {
      showToast('Note content cannot be empty', 'error');
      markdownTextarea.focus();
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    const isEdit = Boolean(noteId);
    const url = isEdit ? `/api/notes/${noteId}` : '/api/notes';
    const method = isEdit ? 'PUT' : 'POST';

    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(d => { throw new Error(d.error || 'Save failed'); });
        }
        return res.json();
      })
      .then(savedNote => {
        showToast('Note saved successfully!', 'success');
        setTimeout(() => {
          window.location.href = `/notes/${savedNote.id}`;
        }, 250);
      })
      .catch(err => {
        console.error('Save error:', err);
        showToast(err.message || 'Failed to save note', 'error');
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Note';
        }
      });
  };

  if (saveBtn) {
    saveBtn.addEventListener('click', function (e) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      window.saveCurrentNote(e);
    });
  }

  // Intercept Enter key in note title to focus content textarea instead of default action
  if (noteTitleInput) {
    noteTitleInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (markdownTextarea) {
          markdownTextarea.focus();
        }
      }
    });
  }

  // Intercept form submit if editor inputs are enclosed in a form
  const editorWrapper = document.getElementById('editor-wrapper-container');
  if (editorWrapper) {
    const parentForm = editorWrapper.closest('form');
    if (parentForm) {
      parentForm.addEventListener('submit', function (e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        window.saveCurrentNote(e);
      });
    }
  }

  // --------------------------------------------------------------------------
  // Delete Note Confirmation Modal
  // --------------------------------------------------------------------------
  window.promptDeleteNote = function (noteId, isPermanent = false) {
    activeDeleteId = noteId;
    activeDeleteIsPermanent = isPermanent;

    const titleElem = document.getElementById('modal-title-text');
    const descElem = document.getElementById('modal-desc-text');

    if (titleElem && descElem) {
      if (isPermanent) {
        titleElem.textContent = 'Permanently Delete Note?';
        descElem.textContent = 'This action cannot be undone. The note will be permanently removed from PostgreSQL.';
      } else {
        titleElem.textContent = 'Move Note to Trash?';
        descElem.textContent = 'You can restore this note anytime from the Trash section or permanently delete it later.';
      }
    }

    if (deleteModal) {
      deleteModal.classList.add('open');
      if (confirmDeleteBtn) confirmDeleteBtn.focus();
    }
  };

  function closeDeleteModal() {
    if (deleteModal) {
      deleteModal.classList.remove('open');
    }
    activeDeleteId = null;
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', function () {
      if (!activeDeleteId) return;

      const idToDelete = activeDeleteId;
      const isPerm = activeDeleteIsPermanent;
      activeDeleteId = null;
      confirmDeleteBtn.disabled = true;

      const deleteUrl = `/api/notes/${idToDelete}?permanent=${isPerm ? 'true' : 'false'}`;

      fetch(deleteUrl, { method: 'DELETE' })
        .then(res => {
          if (!res.ok) throw new Error('Delete failed');
          return res.json();
        })
        .then(data => {
          confirmDeleteBtn.disabled = false;
          closeDeleteModal();
          showToast(data.message || 'Note deleted', 'success');
          if (window.location.pathname.startsWith('/notes/')) {
            window.location.href = '/';
          } else {
            const card = document.getElementById(`note-card-${idToDelete}`);
            if (card) {
              card.style.opacity = '0';
              card.style.transform = 'scale(0.96)';
              setTimeout(() => card.remove(), 180);
            } else {
              window.location.reload();
            }
          }
        })
        .catch(err => {
          confirmDeleteBtn.disabled = false;
          console.error('Delete error:', err);
          showToast('Failed to delete note', 'error');
          closeDeleteModal();
        });
    });
  }

  // --------------------------------------------------------------------------
  // Favorite & Restore Actions
  // --------------------------------------------------------------------------
  window.toggleFavorite = function (noteId, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    fetch(`/api/notes/${noteId}/favorite`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        showToast(data.is_favorite ? 'Added to Favorites' : 'Removed from Favorites', 'info');
        const icon = document.getElementById(`fav-icon-${noteId}`);
        if (icon) {
          icon.classList.toggle('active-fav', data.is_favorite);
        }
      })
      .catch(err => {
        console.error('Toggle favorite error:', err);
        showToast('Error updating favorite status', 'error');
      });
  };

  window.restoreNote = function (noteId, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    fetch(`/api/notes/${noteId}/restore`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        showToast('Note restored from trash', 'success');
        const card = document.getElementById(`note-card-${noteId}`);
        if (card) {
          card.remove();
        } else {
          window.location.reload();
        }
      })
      .catch(err => {
        console.error('Restore error:', err);
        showToast('Failed to restore note', 'error');
      });
  };

  // --------------------------------------------------------------------------
  // Mobile Tab Switching (Editor vs Preview)
  // --------------------------------------------------------------------------
  window.switchMobileTab = function (tabName) {
    const editorPanes = document.getElementById('editor-panes-container');
    const tabEditorBtn = document.getElementById('tab-btn-editor');
    const tabPreviewBtn = document.getElementById('tab-btn-preview');

    if (!editorPanes) return;

    editorPanes.setAttribute('data-tab', tabName);
    if (tabEditorBtn && tabPreviewBtn) {
      tabEditorBtn.classList.toggle('active', tabName === 'editor');
      tabPreviewBtn.classList.toggle('active', tabName === 'preview');
    }

    if (tabName === 'preview') {
      renderLiveMarkdown();
    }
  };

  // --------------------------------------------------------------------------
  // Keyboard Shortcuts
  // --------------------------------------------------------------------------
  document.addEventListener('keydown', function (e) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    // Ctrl+S / Cmd+S -> Save
    if (modifier && e.key === 's') {
      if (saveBtn) {
        e.preventDefault();
        window.saveCurrentNote();
      }
    }

    // Ctrl+K / Cmd+K -> Focus Search
    if (modifier && e.key === 'k') {
      if (searchInput) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    }

    // Ctrl+N / Cmd+N -> New Note
    if (modifier && e.key === 'n') {
      if (!window.location.pathname.endsWith('/new')) {
        e.preventDefault();
        window.location.href = '/notes/new';
      }
    }

    // Escape -> Close modal
    if (e.key === 'Escape') {
      if (deleteModal && deleteModal.classList.contains('open')) {
        closeDeleteModal();
      }
    }
  });

  // Search input Enter handling
  if (searchInput) {
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        window.location.href = query ? `/?q=${encodeURIComponent(query)}` : '/';
      }
    });
  }

})();
