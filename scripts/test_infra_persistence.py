import os
import sys
import time
import requests
import subprocess

BASE_URL = "http://localhost:5001"

def log(msg, status="INFO"):
    print(f"[{status}] {msg}")

def check_health(retries=15, delay=2):
    url = f"{BASE_URL}/health"
    for i in range(retries):
        try:
            r = requests.get(url, timeout=5)
            if r.status_code == 200 and r.json().get("status") == "healthy" and r.json().get("database") == "connected":
                log(f"Health check succeeded on attempt {i+1}: {r.json()}", "PASS")
                return True
        except Exception as e:
            pass
        time.sleep(delay)
    log("Health check failed after retries", "FAIL")
    return False

def psql_query(query):
    cmd = ["docker", "compose", "exec", "-T", "db", "psql", "-U", "noteforge_user", "-d", "noteforge", "-t", "-A", "-c", query]
    res = subprocess.run(cmd, capture_output=True, text=True)
    return res.stdout.strip(), res.stderr.strip()

def run_infra_test():
    log("1. Verifying initial health status...")
    if not check_health():
        sys.exit(1)

    log("2. Creating persistent test note...")
    payload = {
        "title": "INFRA-PERSISTENCE-TEST-NOTE",
        "content": "This note tests database persistence across container restarts.",
        "is_favorite": True
    }
    r = requests.post(f"{BASE_URL}/api/notes", json=payload, timeout=5)
    if r.status_code != 201:
        log(f"Failed to create persistence note: {r.status_code} {r.text}", "FAIL")
        sys.exit(1)
    note_id = r.json()["id"]
    log(f"Created note #{note_id}", "PASS")

    log("3. Verifying row in PostgreSQL container...")
    out, err = psql_query(f"SELECT title, is_favorite FROM notes WHERE id = {note_id};")
    log(f"PostgreSQL direct query result: {out}", "PASS")
    assert "INFRA-PERSISTENCE-TEST-NOTE|t" in out

    log("4. Restarting Web container (docker compose restart web)...")
    subprocess.run(["docker", "compose", "restart", "web"], check=True)
    time.sleep(2)
    if not check_health():
        log("Web container failed health check after restart", "FAIL")
        sys.exit(1)

    r = requests.get(f"{BASE_URL}/api/notes/{note_id}", timeout=5)
    if r.status_code != 200 or r.json()["title"] != payload["title"]:
        log("Note was lost after Web container restart!", "FAIL")
        sys.exit(1)
    log("Note verified intact after Web container restart!", "PASS")

    log("5. Restarting DB container (docker compose restart db)...")
    subprocess.run(["docker", "compose", "restart", "db"], check=True)
    time.sleep(3)
    if not check_health(retries=20, delay=2):
        log("Stack failed health check after DB restart", "FAIL")
        sys.exit(1)

    r = requests.get(f"{BASE_URL}/api/notes/{note_id}", timeout=5)
    if r.status_code != 200 or r.json()["title"] != payload["title"]:
        log("Note was lost after DB container restart!", "FAIL")
        sys.exit(1)
    log("Note verified intact after DB container restart!", "PASS")

    log("6. Cleaning up persistence test note (hard delete)...")
    del_res = requests.delete(f"{BASE_URL}/api/notes/{note_id}?permanent=true", timeout=5)
    if del_res.status_code != 200:
        log(f"Failed to delete note: {del_res.status_code}", "FAIL")
        sys.exit(1)

    out, _ = psql_query(f"SELECT count(*) FROM notes WHERE id = {note_id};")
    assert out.strip() == "0", f"Expected row to be permanently removed, got {out}"
    log("Permanent deletion verified directly in PostgreSQL!", "PASS")

    log("INFRASTRUCTURE & PERSISTENCE TEST COMPLETED SUCCESSFULLY!", "SUCCESS")

if __name__ == "__main__":
    run_infra_test()
