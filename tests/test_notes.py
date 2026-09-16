import pytest
from app.app import create_app
from app.models import db, Note, render_markdown


@pytest.fixture
def app():
    """Create and configure a testing Flask app instance."""
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Test client for HTTP requests."""
    return app.test_client()


@pytest.fixture
def sample_note(app):
    """Create a sample note in the test database."""
    with app.app_context():
        note = Note(
            title="CI/CD Architecture Guide",
            content="# Pipeline Overview\n\nThis note explains the **GitHub Actions** CI/CD pipeline.",
            is_favorite=True
        )
        db.session.add(note)
        db.session.commit()
        return note.to_dict()


# -----------------------------------------------------------------------------
# 1. Note Creation Tests
# -----------------------------------------------------------------------------
def test_create_note_success(client):
    """Test creating a valid note via REST API."""
    payload = {
        "title": "Ansible Deployment Runbook",
        "content": "## Steps\n1. Decrypt vault\n2. Pull GHCR image\n3. Restart compose stack",
        "is_favorite": False
    }
    response = client.post("/api/notes", json=payload)
    assert response.status_code == 201
    data = response.get_json()
    assert data["id"] is not None
    assert data["title"] == payload["title"]
    assert data["content"] == payload["content"]
    assert "rendered_html" in data
    assert "<h2>Steps</h2>" in data["rendered_html"]


def test_create_note_validation_missing_title(client):
    """Test validation fails when note title is missing or empty."""
    payload = {
        "title": "   ",
        "content": "Valid content without a title"
    }
    response = client.post("/api/notes", json=payload)
    assert response.status_code == 400
    data = response.get_json()
    assert "title is required" in data["error"].lower()


def test_create_note_validation_empty_content(client):
    """Test validation fails when note content is empty."""
    payload = {
        "title": "Title with empty body",
        "content": ""
    }
    response = client.post("/api/notes", json=payload)
    assert response.status_code == 400
    data = response.get_json()
    assert "content cannot be empty" in data["error"].lower()


def test_create_note_title_length_limit(client):
    """Test validation fails when title exceeds 255 characters."""
    payload = {
        "title": "A" * 256,
        "content": "Content with excessively long title"
    }
    response = client.post("/api/notes", json=payload)
    assert response.status_code == 400
    data = response.get_json()
    assert "exceed 255" in data["error"].lower()


# -----------------------------------------------------------------------------
# 2. Note Retrieval Tests
# -----------------------------------------------------------------------------
def test_get_all_notes(client, sample_note):
    """Test retrieving all active notes."""
    response = client.get("/api/notes")
    assert response.status_code == 200
    notes = response.get_json()
    assert len(notes) >= 1
    assert any(n["id"] == sample_note["id"] for n in notes)


def test_get_single_note_success(client, sample_note):
    """Test retrieving an individual note by ID."""
    response = client.get(f"/api/notes/{sample_note['id']}")
    assert response.status_code == 200
    data = response.get_json()
    assert data["id"] == sample_note["id"]
    assert data["title"] == sample_note["title"]
    assert "rendered_html" in data


def test_get_single_note_not_found(client):
    """Test retrieving a non-existent note returns 404."""
    response = client.get("/api/notes/999999")
    assert response.status_code == 404
    data = response.get_json()
    assert "not found" in data["error"].lower()


# -----------------------------------------------------------------------------
# 3. Note Editing Tests
# -----------------------------------------------------------------------------
def test_edit_note_success(client, sample_note):
    """Test editing an existing note's title and content."""
    update_payload = {
        "title": "Updated CI/CD Architecture Guide",
        "content": "## Updated Content\nNew mistune rendered text with `code` snippet."
    }
    response = client.put(f"/api/notes/{sample_note['id']}", json=update_payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data["title"] == update_payload["title"]
    assert data["content"] == update_payload["content"]
    assert "<code>code</code>" in data["rendered_html"]


def test_edit_note_not_found(client):
    """Test editing a non-existent note returns 404."""
    response = client.put("/api/notes/999999", json={"title": "Test", "content": "Test"})
    assert response.status_code == 404


def test_edit_note_empty_title_validation(client, sample_note):
    """Test editing a note with an empty title fails validation."""
    response = client.put(f"/api/notes/{sample_note['id']}", json={"title": "  "})
    assert response.status_code == 400


# -----------------------------------------------------------------------------
# 4. Note Deletion Tests (Soft Delete & Permanent Delete)
# -----------------------------------------------------------------------------
def test_delete_note_move_to_trash(client, sample_note):
    """Test deleting note moves it to trash by default."""
    response = client.delete(f"/api/notes/{sample_note['id']}")
    assert response.status_code == 200
    data = response.get_json()
    assert "trash" in data["message"].lower()

    # Verify not listed in active notes
    active_resp = client.get("/api/notes")
    active_notes = active_resp.get_json()
    assert not any(n["id"] == sample_note["id"] for n in active_notes)

    # Verify listed in trash
    trash_resp = client.get("/api/notes?category=trash")
    trash_notes = trash_resp.get_json()
    assert any(n["id"] == sample_note["id"] for n in trash_notes)


def test_delete_note_permanent(client, sample_note):
    """Test permanently deleting a note removes it completely."""
    response = client.delete(f"/api/notes/{sample_note['id']}?permanent=true")
    assert response.status_code == 200
    data = response.get_json()
    assert "permanently deleted" in data["message"].lower()

    # Subsequent GET returns 404
    get_resp = client.get(f"/api/notes/{sample_note['id']}")
    assert get_resp.status_code == 404


def test_delete_note_not_found(client):
    """Test deleting a non-existent note returns 404."""
    response = client.delete("/api/notes/999999")
    assert response.status_code == 404


# -----------------------------------------------------------------------------
# 5. Markdown Rendering via mistune Tests
# -----------------------------------------------------------------------------
def test_mistune_markdown_rendering():
    """Verify mistune correctly transforms Markdown features to HTML."""
    raw_md = """# NoteForge Header
A paragraph with **bold** and *italic* text.

```python
def test_func():
    return True
```

| Syntax | Description |
| :--- | :--- |
| Header | Title |
| Paragraph | Text |

- [ ] Unfinished task
- [x] Completed task
"""
    html = render_markdown(raw_md)
    assert "<h1>NoteForge Header</h1>" in html
    assert "<strong>bold</strong>" in html
    assert "<em>italic</em>" in html
    assert "<code" in html
    assert "<table>" in html
    assert ">Syntax</th>" in html


def test_markdown_preview_endpoint(client):
    """Test the /api/markdown/preview endpoint used by the two-pane editor."""
    raw_content = "### Production Checklist\n- [ ] Run unit tests\n- [ ] Verify Docker container"
    response = client.post("/api/markdown/preview", json={"content": raw_content})
    assert response.status_code == 200
    data = response.get_json()
    assert "html" in data
    assert "<h3>Production Checklist</h3>" in data["html"]
    assert data["word_count"] > 0


def test_mistune_line_breaks_preserved(client):
    """Verify separate lines in Markdown text render with line breaks (<br />) instead of collapsing."""
    raw_content = "hvcncv b\ndtgchn cvg\nbjgmhvg"
    html = render_markdown(raw_content)
    assert "<br" in html
    assert "hvcncv b" in html
    assert "dtgchn cvg" in html
    assert "bjgmhvg" in html

    # Also verify via /api/markdown/preview endpoint
    res = client.post("/api/markdown/preview", json={"content": raw_content})
    assert res.status_code == 200
    preview_html = res.get_json()["html"]
    assert "<br" in preview_html


# -----------------------------------------------------------------------------
# 6. Search Functionality Tests
# -----------------------------------------------------------------------------
def test_search_notes_by_title_and_content(client, app):
    """Test querying notes by title or content substring."""
    with app.app_context():
        n1 = Note(title="PostgreSQL Optimization", content="Indexing strategies for high-throughput queries.")
        n2 = Note(title="Docker Compose Setup", content="Multi-container configuration with health checks.")
        db.session.add_all([n1, n2])
        db.session.commit()

    # Search for "PostgreSQL"
    resp1 = client.get("/api/notes?q=PostgreSQL")
    assert resp1.status_code == 200
    results1 = resp1.get_json()
    assert len(results1) == 1
    assert results1[0]["title"] == "PostgreSQL Optimization"

    # Search for content keyword "health checks"
    resp2 = client.get("/api/notes?q=health+checks")
    assert resp2.status_code == 200
    results2 = resp2.get_json()
    assert len(results2) == 1
    assert results2[0]["title"] == "Docker Compose Setup"


# -----------------------------------------------------------------------------
# 7. Favorite & Restore Feature Tests
# -----------------------------------------------------------------------------
def test_toggle_favorite_and_restore(client, sample_note):
    """Test toggling note favorite state and restoring note from trash."""
    # Toggle favorite
    fav_resp = client.post(f"/api/notes/{sample_note['id']}/favorite")
    assert fav_resp.status_code == 200
    assert fav_resp.get_json()["is_favorite"] is False

    # Move to trash
    client.delete(f"/api/notes/{sample_note['id']}")

    # Restore
    restore_resp = client.post(f"/api/notes/{sample_note['id']}/restore")
    assert restore_resp.status_code == 200
    assert "restored" in restore_resp.get_json()["message"].lower()

    # Verify back in active notes
    get_resp = client.get(f"/api/notes/{sample_note['id']}")
    assert get_resp.status_code == 200
    assert get_resp.get_json()["is_trashed"] is False


# -----------------------------------------------------------------------------
# 8. Health Check Endpoint Test
# -----------------------------------------------------------------------------
def test_health_check_endpoint(client):
    """Test /health endpoint used for container and smoke test validation."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "healthy"
    assert data["service"] == "noteforge"
    assert data["database"] == "connected"


# -----------------------------------------------------------------------------
# 9. HTML View Pages Route Tests
# -----------------------------------------------------------------------------
def test_html_views(client, sample_note):
    """Test that all UI view routes render correctly with 200 status code."""
    # Home
    r_home = client.get("/")
    assert r_home.status_code == 200
    assert b"NOTEForge" in r_home.data

    # New note editor
    r_new = client.get("/notes/new")
    assert r_new.status_code == 200
    assert b"Save Note" in r_new.data

    # View note
    r_view = client.get(f"/notes/{sample_note['id']}")
    assert r_view.status_code == 200
    assert sample_note["title"].encode() in r_view.data

    # Edit note
    r_edit = client.get(f"/notes/{sample_note['id']}/edit")
    assert r_edit.status_code == 200
    assert sample_note["title"].encode() in r_edit.data

    # Missing note HTML page (clean 404 without Python stack trace)
    r_missing = client.get("/notes/999999")
    assert r_missing.status_code == 404
    assert b"Note Not Found" in r_missing.data


# -----------------------------------------------------------------------------
# 10. Vercel Serverless Function & Path Middleware Tests
# -----------------------------------------------------------------------------
def test_vercel_entrypoint_routing(app):
    """Test that Vercel entrypoint preserves routes and handles rewrites properly."""
    from api.index import VercelPathMiddleware
    app.wsgi_app = VercelPathMiddleware(app.wsgi_app)
    v_client = app.test_client()

    # Direct access to /notes/new must render the new note editor
    res = v_client.get("/notes/new")
    assert res.status_code == 200
    assert b"Save Note" in res.data
    assert b"New Note" in res.data

    # Vercel rewrite simulation: /api/index?__vercel_path=notes/new
    res_rewrite = v_client.get("/api/index?__vercel_path=notes/new")
    assert res_rewrite.status_code == 200
    assert b"Save Note" in res_rewrite.data
    assert b"New Note" in res_rewrite.data

    # Vercel rewrite simulation with query params: /api/index?category=trash&__vercel_path=
    res_trash = v_client.get("/api/index?category=trash&__vercel_path=")
    assert res_trash.status_code == 200
    assert b"Trash" in res_trash.data

    # Direct access to /api/index should map to home
    res = v_client.get("/api/index")
    assert res.status_code == 200
    assert b"NOTEForge" in res.data

    # Direct access to /api/notes should work
    res = v_client.get("/api/notes")
    assert res.status_code == 200
