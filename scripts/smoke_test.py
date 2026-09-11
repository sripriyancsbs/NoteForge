#!/usr/bin/env python3
"""
scripts/smoke_test.py
Post-deployment smoke testing script for NoteForge staging/production stacks.
Validates:
1. /health endpoint returns 200 and healthy DB connection
2. Note creation with Markdown content
3. Note retrieval and mistune HTML rendering verification
4. Note search functionality
5. Note cleanup / deletion
Exits 0 on success, exits 1 on failure to trigger automated rollback.
"""

import os
import sys
import time
import requests

BASE_URL = os.environ.get("TARGET_URL", "http://localhost:5001").rstrip("/")


def log(msg, status="INFO"):
    print(f"[{status}] {msg}")


def test_health():
    log("Probing /health endpoint...")
    url = f"{BASE_URL}/health"
    resp = requests.get(url, timeout=10)
    if resp.status_code != 200:
        log(f"/health returned status {resp.status_code}: {resp.text}", "FAIL")
        return False
    data = resp.json()
    if data.get("status") != "healthy":
        log(f"/health status is not healthy: {data}", "FAIL")
        return False
    log(f"/health passed: status={data.get('status')}, db={data.get('database')}", "PASS")
    return True


def test_crud_and_markdown():
    log("Testing Note CRUD and mistune Markdown rendering...")
    # 1. Create
    create_url = f"{BASE_URL}/api/notes"
    payload = {
        "title": f"Smoke Test Note {int(time.time())}",
        "content": "## Smoke Test\n- [x] Database active\n- [x] Mistune working\n```python\nprint('smoke_ok')\n```",
        "is_favorite": True
    }
    resp = requests.post(create_url, json=payload, timeout=10)
    if resp.status_code != 201:
        log(f"Create note failed with status {resp.status_code}: {resp.text}", "FAIL")
        return False

    note = resp.json()
    note_id = note.get("id")
    if not note_id:
        log("No note ID returned from create note", "FAIL")
        return False

    log(f"Note #{note_id} created successfully.", "PASS")

    # 2. Verify mistune rendering
    rendered_html = note.get("rendered_html", "")
    if "<h2>Smoke Test</h2>" not in rendered_html or "<code" not in rendered_html:
        log("Rendered HTML missing expected mistune output", "FAIL")
        return False
    log("Mistune Markdown rendering validated.", "PASS")

    # 3. Read single note
    get_url = f"{BASE_URL}/api/notes/{note_id}"
    get_resp = requests.get(get_url, timeout=10)
    if get_resp.status_code != 200:
        log(f"Retrieve note failed: {get_resp.status_code}", "FAIL")
        return False

    # 4. Search note
    search_url = f"{BASE_URL}/api/notes?q=Smoke+Test"
    search_resp = requests.get(search_url, timeout=10)
    if search_resp.status_code != 200 or not any(n["id"] == note_id for n in search_resp.json()):
        log("Search failed to find smoke test note", "FAIL")
        return False
    log("Search query validated.", "PASS")

    # 5. Clean up note (permanent delete)
    del_url = f"{BASE_URL}/api/notes/{note_id}?permanent=true"
    del_resp = requests.delete(del_url, timeout=10)
    if del_resp.status_code != 200:
        log(f"Cleanup delete failed: {del_resp.status_code}", "WARN")

    log("Note CRUD lifecycle completed cleanly.", "PASS")
    return True


def main():
    log(f"Starting NOTEForge Smoke Tests targeting: {BASE_URL}")

    # Allow service up to 30 seconds to become responsive
    max_retries = 6
    for attempt in range(1, max_retries + 1):
        try:
            if test_health():
                break
        except requests.exceptions.RequestException as e:
            log(f"Attempt {attempt}/{max_retries}: Target not ready ({e}). Retrying in 5s...", "WARN")
            time.sleep(5)
    else:
        log("Smoke tests failed: Application never became healthy within timeout.", "FATAL")
        sys.exit(1)

    try:
        if not test_crud_and_markdown():
            log("Smoke tests failed: Functional check failure.", "FATAL")
            sys.exit(1)
    except Exception as err:
        log(f"Smoke test execution exception: {err}", "FATAL")
        sys.exit(1)

    log("All Smoke Tests Passed Successfully!", "SUCCESS")
    sys.exit(0)


if __name__ == "__main__":
    main()
