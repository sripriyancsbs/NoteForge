import os
import sys
import time
import requests
import subprocess

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://localhost:5001"

results = []

def record(area, test_name, passed, details=""):
    status_str = "PASS" if passed else "FAIL"
    results.append({
        "area": area,
        "test": test_name,
        "status": status_str,
        "details": details
    })
    print(f"[{status_str}] {area} :: {test_name} - {details}")

def psql_query(query):
    cmd = ["docker", "compose", "exec", "-T", "db", "psql", "-U", "noteforge_user", "-d", "noteforge", "-t", "-A", "-c", query]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return (res.stdout or "").strip(), (res.stderr or "").strip()

def test_api_suite():
    print("=== STARTING QA DEEP BACKEND / API / DB VALIDATION SUITE ===")

    # -------------------------------------------------------------
    # SECTION 3: NOTE CREATION TESTING (VALID & BOUNDARY)
    # -------------------------------------------------------------
    area = "Note Creation"

    # 3.1 Normal note
    r = requests.post(f"{BASE_URL}/api/notes", json={"title": "Normal Note", "content": "This is normal content."})
    if r.status_code == 201 and r.json().get("id"):
        nid = r.json()["id"]
        record(area, "Valid Normal Note", True, f"Created ID {nid}")
        requests.delete(f"{BASE_URL}/api/notes/{nid}?permanent=true")
    else:
        record(area, "Valid Normal Note", False, f"Status {r.status_code}: {r.text}")

    # 3.2 Short title (1 character)
    r = requests.post(f"{BASE_URL}/api/notes", json={"title": "X", "content": "Content for 1 char title"})
    if r.status_code == 201:
        nid = r.json()["id"]
        record(area, "One-character Title", True, f"Created ID {nid}")
        requests.delete(f"{BASE_URL}/api/notes/{nid}?permanent=true")
    else:
        record(area, "One-character Title", False, f"Status {r.status_code}")

    # 3.3 Long title (exact 255 chars)
    title_255 = "T" * 255
    r = requests.post(f"{BASE_URL}/api/notes", json={"title": title_255, "content": "Content for 255 char title"})
    if r.status_code == 201:
        nid = r.json()["id"]
        record(area, "Exact 255 Char Title (Boundary Limit)", True, f"Created ID {nid}")
        requests.delete(f"{BASE_URL}/api/notes/{nid}?permanent=true")
    else:
        record(area, "Exact 255 Char Title (Boundary Limit)", False, f"Status {r.status_code}: {r.text}")

    # 3.4 Title exceeding 255 chars (256 chars) - must reject with 400
    title_256 = "T" * 256
    r = requests.post(f"{BASE_URL}/api/notes", json={"title": title_256, "content": "Content for 256 char title"})
    if r.status_code == 400 and "255" in r.text:
        record(area, "Title > 255 Characters Validation", True, f"Properly rejected with 400: {r.json()}")
    else:
        record(area, "Title > 255 Characters Validation", False, f"Expected 400, got {r.status_code}: {r.text}")

    # 3.5 Unicode and Multilingual (Japanese, Arabic, Russian, Hindi, Chinese)
    unicode_title = "Notes 日本語 العربية Русский हिन्दी 中文"
    unicode_content = "Multilingual: こんにちは世界 - مرحبا بالعالم - Привет мир - नमस्ते दुनिया - 你好世界"
    r = requests.post(f"{BASE_URL}/api/notes", json={"title": unicode_title, "content": unicode_content})
    if r.status_code == 201:
        nid = r.json()["id"]
        # Direct DB check to ensure encoding in PostgreSQL utf-8
        db_title, _ = psql_query(f"SELECT title FROM notes WHERE id = {nid};")
        if "日本語" in db_title and "العربية" in db_title and "हिन्दी" in db_title:
            record(area, "Unicode / Multilingual Storage", True, f"Verified in PostgreSQL UTF-8: {db_title[:40]}...")
        else:
            record(area, "Unicode / Multilingual Storage", False, f"PostgreSQL corrupted characters: {db_title}")
        requests.delete(f"{BASE_URL}/api/notes/{nid}?permanent=true")
    else:
        record(area, "Unicode / Multilingual Storage", False, f"Status {r.status_code}")

    # 3.6 Emojis
    emoji_title = "Rocket 🚀 Fire 🔥 Party 🎉 Code 💻"
    emoji_content = "Emoji notes: ✨ 🧪 📝 💡 ⚡ 🦄"
    r = requests.post(f"{BASE_URL}/api/notes", json={"title": emoji_title, "content": emoji_content})
    if r.status_code == 201:
        nid = r.json()["id"]
        db_title, _ = psql_query(f"SELECT title FROM notes WHERE id = {nid};")
        if "🚀" in db_title and "🔥" in db_title:
            record(area, "Emoji Storage (PostgreSQL utf8mb4/UTF-8)", True, f"Verified: {db_title}")
        else:
            record(area, "Emoji Storage (PostgreSQL utf8mb4/UTF-8)", False, f"Corrupted: {db_title}")
        requests.delete(f"{BASE_URL}/api/notes/{nid}?permanent=true")
    else:
        record(area, "Emoji Storage (PostgreSQL utf8mb4/UTF-8)", False, f"Status {r.status_code}")

    # 3.7 Special Characters
    special_title = "!@#$%^&*()_+-=[]{};':\",.<>/?\\|~`"
    special_content = "Characters: `~@#$%^&*()_+-=[]{};':\",./<>?`"
    r = requests.post(f"{BASE_URL}/api/notes", json={"title": special_title, "content": special_content})
    if r.status_code == 201:
        nid = r.json()["id"]
        record(area, "Special Characters Title & Content", True, f"Successfully created ID {nid}")
        requests.delete(f"{BASE_URL}/api/notes/{nid}?permanent=true")
    else:
        record(area, "Special Characters Title & Content", False, f"Status {r.status_code}")

    # 3.8 Empty Title - rejected 400
    r = requests.post(f"{BASE_URL}/api/notes", json={"title": "", "content": "Valid Content"})
    record(area, "Empty Title Validation", r.status_code == 400, f"Got {r.status_code}")

    # 3.9 Whitespace-only Title - rejected 400
    r = requests.post(f"{BASE_URL}/api/notes", json={"title": "   \t\n  ", "content": "Valid Content"})
    record(area, "Whitespace-only Title Validation", r.status_code == 400, f"Got {r.status_code}")

    # 3.10 Empty Content - rejected 400
    r = requests.post(f"{BASE_URL}/api/notes", json={"title": "Valid Title", "content": ""})
    record(area, "Empty Content Validation", r.status_code == 400, f"Got {r.status_code}")

    # 3.11 Whitespace-only Content - rejected 400
    r = requests.post(f"{BASE_URL}/api/notes", json={"title": "Valid Title", "content": "    \n\t  "})
    record(area, "Whitespace-only Content Validation", r.status_code == 400, f"Got {r.status_code}")

    # 3.12 Large pasted content (100 KB text)
    large_content = "A" * 102400
    r = requests.post(f"{BASE_URL}/api/notes", json={"title": "Large 100KB Content Note", "content": large_content})
    if r.status_code == 201:
        nid = r.json()["id"]
        db_len, _ = psql_query(f"SELECT length(content) FROM notes WHERE id = {nid};")
        record(area, "Large 100KB Content Storage", db_len.strip() == "102400", f"Stored length: {db_len.strip()}")
        requests.delete(f"{BASE_URL}/api/notes/{nid}?permanent=true")
    else:
        record(area, "Large 100KB Content Storage", False, f"Status {r.status_code}")

    # 3.13 Security: SQL Injection in Title & Content
    sqli_title = "'; DROP TABLE notes; --"
    sqli_content = "' OR '1'='1' UNION SELECT * FROM notes; --"
    r = requests.post(f"{BASE_URL}/api/notes", json={"title": sqli_title, "content": sqli_content})
    if r.status_code == 201:
        nid = r.json()["id"]
        # Verify table 'notes' still exists and was not dropped
        tbl_check, _ = psql_query("SELECT to_regclass('public.notes');")
        record(area, "SQL Injection Resistance (Creation)", tbl_check == "notes", f"Table intact: {tbl_check}")
        requests.delete(f"{BASE_URL}/api/notes/{nid}?permanent=true")
    else:
        record(area, "SQL Injection Resistance (Creation)", False, f"Status {r.status_code}")

    # 3.14 Security: XSS Payloads in Content
    xss_content = "<script>alert('XSS')</script><img src=x onerror=alert(1)>[malicious](javascript:alert(1))"
    r = requests.post(f"{BASE_URL}/api/notes", json={"title": "XSS Test Note", "content": xss_content})
    if r.status_code == 201:
        nid = r.json()["id"]
        rendered = r.json().get("rendered_html", "")
        # Verify dangerous tags are escaped and javascript: URL sanitized
        safe = ("<script>" not in rendered) and ("<img" not in rendered) and ("href=\"javascript:" not in rendered)
        record(area, "XSS Payload Sanitization in Rendered Output", safe, f"Rendered snippet: {rendered[:100]}")
        requests.delete(f"{BASE_URL}/api/notes/{nid}?permanent=true")
    else:
        record(area, "XSS Payload Sanitization in Rendered Output", False, f"Status {r.status_code}")

    # -------------------------------------------------------------
    # SECTION 4: EDIT NOTE TESTING
    # -------------------------------------------------------------
    area = "Edit Note"
    # Create base note
    r = requests.post(f"{BASE_URL}/api/notes", json={"title": "Original Edit Title", "content": "Original content body"})
    edit_id = r.json()["id"]

    # 4.1 Edit title only
    r = requests.put(f"{BASE_URL}/api/notes/{edit_id}", json={"title": "Updated Title Only"})
    if r.status_code == 200 and r.json()["title"] == "Updated Title Only" and r.json()["content"] == "Original content body":
        record(area, "Edit Title Only", True, "Title updated, content preserved")
    else:
        record(area, "Edit Title Only", False, f"Status {r.status_code}")

    # 4.2 Edit content only
    r = requests.put(f"{BASE_URL}/api/notes/{edit_id}", json={"content": "Updated content only."})
    if r.status_code == 200 and r.json()["title"] == "Updated Title Only" and r.json()["content"] == "Updated content only.":
        record(area, "Edit Content Only", True, "Content updated, title preserved")
    else:
        record(area, "Edit Content Only", False, f"Status {r.status_code}")

    # 4.3 Edit both
    r = requests.put(f"{BASE_URL}/api/notes/{edit_id}", json={"title": "Both New Title", "content": "Both new content"})
    record(area, "Edit Both Title & Content", r.status_code == 200 and r.json()["title"] == "Both New Title", "Both updated successfully")

    # 4.4 Clear title (invalid)
    r = requests.put(f"{BASE_URL}/api/notes/{edit_id}", json={"title": "   "})
    record(area, "Reject Empty Title on Edit", r.status_code == 400, f"Got status {r.status_code}")

    # 4.5 Exceed 255 chars title on edit (invalid)
    r = requests.put(f"{BASE_URL}/api/notes/{edit_id}", json={"title": "E" * 256})
    record(area, "Reject >255 Char Title on Edit", r.status_code == 400, f"Got status {r.status_code}")

    # 4.6 Verify old content not restored after page reload
    db_title, _ = psql_query(f"SELECT title FROM notes WHERE id = {edit_id};")
    record(area, "Verify PostgreSQL State After Edits", db_title.strip() == "Both New Title", f"DB has: {db_title.strip()}")

    # 4.7 Rapid saves (10 sequential updates)
    rapid_success = True
    for i in range(10):
        up_r = requests.put(f"{BASE_URL}/api/notes/{edit_id}", json={"title": f"Rapid Title {i}", "content": f"Rapid Content {i}"})
        if up_r.status_code != 200:
            rapid_success = False
            break
    record(area, "Rapid Sequential Saves", rapid_success, "10 rapid consecutive updates completed")

    requests.delete(f"{BASE_URL}/api/notes/{edit_id}?permanent=true")

    # -------------------------------------------------------------
    # SECTION 5: DELETE / TRASH / RESTORE LIFECYCLE & DB VERIFICATION
    # -------------------------------------------------------------
    area = "Trash & Restore"
    # Create test note
    r = requests.post(f"{BASE_URL}/api/notes", json={"title": "Trash Lifecycle Note", "content": "Testing trash lifecycle"})
    tid = r.json()["id"]

    # 5.1 Soft delete
    r = requests.delete(f"{BASE_URL}/api/notes/{tid}")
    record(area, "Soft Delete to Trash", r.status_code == 200, f"Response: {r.json()}")

    # Verify is_trashed = True in DB
    db_trashed, _ = psql_query(f"SELECT is_trashed FROM notes WHERE id = {tid};")
    record(area, "PostgreSQL is_trashed Flag Verification", db_trashed.strip() == "t", f"DB is_trashed: {db_trashed}")

    # Verify excluded from normal list
    all_notes = requests.get(f"{BASE_URL}/api/notes").json()
    record(area, "Excluded from Active Notes List", not any(n["id"] == tid for n in all_notes), "Not in active list")

    # Verify present in trash list
    trash_notes = requests.get(f"{BASE_URL}/api/notes?category=trash").json()
    record(area, "Present in Trash List", any(n["id"] == tid for n in trash_notes), "Found in trash list")

    # 5.2 Restore note
    r = requests.post(f"{BASE_URL}/api/notes/{tid}/restore")
    record(area, "Restore Note API", r.status_code == 200, f"Restored: {r.json()}")

    db_trashed, _ = psql_query(f"SELECT is_trashed FROM notes WHERE id = {tid};")
    record(area, "PostgreSQL Flag Restored to False", db_trashed.strip() == "f", f"DB is_trashed: {db_trashed}")

    # 5.3 Permanent delete
    r = requests.delete(f"{BASE_URL}/api/notes/{tid}?permanent=true")
    record(area, "Permanent Hard Delete API", r.status_code == 200, f"Deleted: {r.json()}")

    # Verify record REALLY deleted from DB (count is 0)
    db_cnt, _ = psql_query(f"SELECT count(*) FROM notes WHERE id = {tid};")
    record(area, "Direct PostgreSQL Verification: Row Erased", db_cnt.strip() == "0", f"Count in DB: {db_cnt}")

    # 5.4 Delete already-deleted note returns 404
    r = requests.delete(f"{BASE_URL}/api/notes/{tid}?permanent=true")
    record(area, "Delete Non-Existent Note (404 Handling)", r.status_code == 404, f"Got status {r.status_code}")

    # 5.5 Restore non-existent note returns 404
    r = requests.post(f"{BASE_URL}/api/notes/{tid}/restore")
    record(area, "Restore Non-Existent Note (404 Handling)", r.status_code == 404, f"Got status {r.status_code}")

    # -------------------------------------------------------------
    # SECTION 6: FAVORITES TESTING
    # -------------------------------------------------------------
    area = "Favorites"
    r = requests.post(f"{BASE_URL}/api/notes", json={"title": "Fav Note 1", "content": "Content", "is_favorite": False})
    fid = r.json()["id"]

    # Toggle to true
    r1 = requests.post(f"{BASE_URL}/api/notes/{fid}/favorite")
    is_fav_1 = r1.json().get("is_favorite")
    db_fav, _ = psql_query(f"SELECT is_favorite FROM notes WHERE id = {fid};")
    record(area, "Toggle Favorite ON", is_fav_1 is True and db_fav.strip() == "t", f"API={is_fav_1}, DB={db_fav.strip()}")

    # Toggle to false
    r2 = requests.post(f"{BASE_URL}/api/notes/{fid}/favorite")
    is_fav_2 = r2.json().get("is_favorite")
    db_fav2, _ = psql_query(f"SELECT is_favorite FROM notes WHERE id = {fid};")
    record(area, "Toggle Favorite OFF", is_fav_2 is False and db_fav2.strip() == "f", f"API={is_fav_2}, DB={db_fav2.strip()}")

    # Soft delete favorite and restore: verify favorite state preserved
    requests.post(f"{BASE_URL}/api/notes/{fid}/favorite") # make it True
    requests.delete(f"{BASE_URL}/api/notes/{fid}") # move to trash
    requests.post(f"{BASE_URL}/api/notes/{fid}/restore") # restore
    db_fav3, _ = psql_query(f"SELECT is_favorite FROM notes WHERE id = {fid};")
    record(area, "Favorite State Preserved Across Trash & Restore", db_fav3.strip() == "t", f"DB is_favorite after restore: {db_fav3.strip()}")

    # Rapid toggle favorite (10 rapid requests)
    for _ in range(10):
        requests.post(f"{BASE_URL}/api/notes/{fid}/favorite")
    r_final = requests.get(f"{BASE_URL}/api/notes/{fid}")
    record(area, "Rapid Favorite Toggles Stability", r_final.status_code == 200, f"Final favorite state: {r_final.json()['is_favorite']}")

    requests.delete(f"{BASE_URL}/api/notes/{fid}?permanent=true")

    # -------------------------------------------------------------
    # SECTION 7: SEARCH TESTING
    # -------------------------------------------------------------
    area = "Search"
    # Create distinct searchable notes
    s1 = requests.post(f"{BASE_URL}/api/notes", json={"title": "Kubernetes Cluster Architecture", "content": "Pods, Nodes, Ingress and Deployments."}).json()["id"]
    s2 = requests.post(f"{BASE_URL}/api/notes", json={"title": "Python FastAPI vs Flask", "content": "Comparing ASGI performance and WSGI Gunicorn."}).json()["id"]
    s3 = requests.post(f"{BASE_URL}/api/notes", json={"title": "Database Optimization 2026", "content": "Indexing B-Tree and PostgreSQL query planning."}).json()["id"]
    s4 = requests.post(f"{BASE_URL}/api/notes", json={"title": "Unicode 🔍 Search", "content": "Searching with emoji 🚀 and characters: 日本語."}).json()["id"]

    # 7.1 Exact title
    res = requests.get(f"{BASE_URL}/api/notes?q=Kubernetes+Cluster+Architecture").json()
    record(area, "Exact Title Search", len(res) == 1 and res[0]["id"] == s1, f"Found {len(res)} matches")

    # 7.2 Partial title
    res = requests.get(f"{BASE_URL}/api/notes?q=Cluster").json()
    record(area, "Partial Title Search", any(n["id"] == s1 for n in res), f"Found {len(res)} matches")

    # 7.3 Case-insensitive title
    res = requests.get(f"{BASE_URL}/api/notes?q=kubernetes").json()
    record(area, "Case-insensitive Title Search", any(n["id"] == s1 for n in res), f"Found {len(res)} matches")

    # 7.4 Content search
    res = requests.get(f"{BASE_URL}/api/notes?q=Ingress").json()
    record(area, "Content Body Search", any(n["id"] == s1 for n in res), f"Found {len(res)} matches")

    # 7.5 Case-insensitive content search
    res = requests.get(f"{BASE_URL}/api/notes?q=gunicorn").json()
    record(area, "Case-insensitive Content Search", any(n["id"] == s2 for n in res), f"Found {len(res)} matches")

    # 7.6 Numbers in search
    res = requests.get(f"{BASE_URL}/api/notes?q=2026").json()
    record(area, "Numeric Query Search", any(n["id"] == s3 for n in res), f"Found {len(res)} matches")

    # 7.7 Unicode & Emoji search
    res = requests.get(f"{BASE_URL}/api/notes?q=日本語").json()
    record(area, "Unicode Query Search (日本語)", any(n["id"] == s4 for n in res), f"Found {len(res)} matches")

    res = requests.get(f"{BASE_URL}/api/notes?q=%F0%9F%9A%80").json() # 🚀
    record(area, "Emoji Query Search (🚀)", any(n["id"] == s4 for n in res), f"Found {len(res)} matches")

    # 7.8 No match query
    res = requests.get(f"{BASE_URL}/api/notes?q=NONEXISTENT_QUERY_XYZ_9999").json()
    record(area, "No-match Query Returns Clean Empty List", len(res) == 0, f"Result count: {len(res)}")

    # 7.9 Security: SQL Injection queries in search
    sqli_queries = [
        "' OR '1'='1",
        "'; DROP TABLE notes; --",
        "1 UNION SELECT 1,2,3,4,5,6,7",
        "../../../etc/passwd",
        "${7*7}",
        "%",
        "_"
    ]
    all_sqli_safe = True
    for sqli in sqli_queries:
        r = requests.get(f"{BASE_URL}/api/notes", params={"q": sqli})
        if r.status_code != 200:
            all_sqli_safe = False
            record(area, f"Security Query: {sqli[:15]}", False, f"Server error: {r.status_code}")
    if all_sqli_safe:
        record(area, "SQL Injection & Special Payloads in Search", True, "All 7 malicious search patterns handled safely without 500 or crash")

    # Cleanup search notes
    for sid in [s1, s2, s3, s4]:
        requests.delete(f"{BASE_URL}/api/notes/{sid}?permanent=true")

    # -------------------------------------------------------------
    # SECTION 8: MARKDOWN RENDERING (API /preview & Model)
    # -------------------------------------------------------------
    area = "Markdown Rendering"

    md_samples = [
        ("# Heading 1\n## Heading 2", ["<h1>Heading 1</h1>", "<h2>Heading 2</h2>"]),
        ("**bold text** and *italic text*", ["<strong>bold text</strong>", "<em>italic text</em>"]),
        ("~~strikethrough~~", ["<del>strikethrough</del>"]),
        ("- Item A\n- Item B", ["<ul>", "<li>Item A</li>", "<li>Item B</li>"]),
        ("1. First\n2. Second", ["<ol>", "<li>First</li>", "<li>Second</li>"]),
        ("[OpenAI](https://example.com)", ['<a href="https://example.com">OpenAI</a>']),
        ("> Inspiring quote", ["<blockquote>", "Inspiring quote"]),
        ("`inline_code()`", ["<code>inline_code()</code>"]),
        ("```python\ndef hello():\n    print('world')\n```", ["<pre><code class=\"language-python\">", "def hello():"]),
        ("| Col1 | Col2 |\n|---|---|\n| Val1 | Val2 |", ["<table>", "<th>Col1</th>", "<td>Val1</td>"])
    ]

    for md_text, expected_tokens in md_samples:
        r = requests.post(f"{BASE_URL}/api/markdown/preview", json={"content": md_text})
        if r.status_code == 200:
            html = r.json().get("html", "")
            passed = all(tok in html for tok in expected_tokens)
            record(area, f"Markdown: {expected_tokens[0]}", passed, f"Rendered matches expected tokens")
        else:
            record(area, f"Markdown: {expected_tokens[0]}", False, f"Status {r.status_code}")

    print("\n=== SUMMARY OF BACKEND / API / DB TESTS ===")
    total = len(results)
    passed_count = sum(1 for r in results if r["status"] == "PASS")
    failed_count = sum(1 for r in results if r["status"] == "FAIL")
    print(f"Total: {total} | Passed: {passed_count} | Failed: {failed_count}")
    return failed_count == 0

if __name__ == "__main__":
    success = test_api_suite()
    sys.exit(0 if success else 1)
