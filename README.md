# NOTEForge — Full CI/CD Pipeline Notes App

[![CI Pipeline](https://github.com/owner/noteforge/actions/workflows/ci.yml/badge.svg)](https://github.com/owner/noteforge/actions/workflows/ci.yml)
[![Staging CD](https://github.com/owner/noteforge/actions/workflows/staging.yml/badge.svg)](https://github.com/owner/noteforge/actions/workflows/staging.yml)
[![Production Release](https://github.com/owner/noteforge/actions/workflows/production.yml/badge.svg)](https://github.com/owner/noteforge/actions/workflows/production.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**NOTEForge** is a production-grade Markdown productivity application and complete enterprise DevOps pipeline built with **Python 3.12/3.13**, **Flask**, **PostgreSQL**, **mistune**, **Docker**, **GitHub Actions**, **GitHub Container Registry (GHCR)**, **Ansible**, and **Ansible Vault**.

NOTEForge delivers a fast dual-pane writing experience with live backend-rendered Markdown previews, resilient PostgreSQL persistence, and an automated continuous delivery pipeline featuring zero-downtime Ansible deployments, automated smoke tests, and verified rollbacks.

---

## Complete CI/CD Pipeline Flowchart

```
                          ┌───────────────────────────┐
                          │   feature/* Branch        │
                          │   (Local Development)     │
                          └─────────────┬─────────────┘
                                        │
                                        │ Pull Request
                                        v
                          ┌───────────────────────────┐
                          │    PR Targeting staging   │
                          └─────────────┬─────────────┘
                                        │
                                        v
                   ┌─────────────────────────────────────────┐
                   │       CI Workflow (.github/ci.yml)      │
                   ├─────────────────────────────────────────┤
                   │  1. Flake8 Linting                      │
                   │  2. Pytest Suite (Unit & Integration)   │
                   │  3. Multi-Stage Docker Image Build      │
                   │  4. Push to GHCR: staging-${GITHUB_SHA} │
                   └────────────────────┬────────────────────┘
                                        │
                                        v
                          ┌───────────────────────────┐
                          │   Merge into staging      │
                          └─────────────┬─────────────┘
                                        │
                                        v
                 ┌──────────────────────────────────────────────┐
                 │    Staging Workflow (.github/staging.yml)    │
                 ├──────────────────────────────────────────────┤
                 │  1. Run scripts/update_changelog.py          │
                 │  2. Pull image: staging-${SHA}               │
                 │  3. Ansible Deploy (ansible/deploy.yml)      │
                 │  4. Restart compose.staging.yml (Port 5001)  │
                 │  5. Run Smoke Tests (scripts/smoke_test.py)  │
                 └──────────────────────┬───────────────────────┘
                                        │
                                        ▼
                                  Smoke Tests?
                                 /            \
                       PASS     /              \     FAIL
                               v                v
                 ┌───────────────────┐    ┌──────────────────────────────────┐
                 │  Staging Verified │    │ Automatic Rollback               │
                 │  Healthy State    │    │ (ansible/rollback.yml)           │
                 └─────────┬─────────┘    │ Restores last known-good image   │
                           │              └──────────────────────────────────┘
                           │ PR to main
                           v
                 ┌───────────────────┐
                 │   Merge to main   │
                 └─────────┬─────────┘
                           │
                           v
           ┌───────────────────────────────────────────────┐
           │    Production Workflow (.github/production)   │
           ├───────────────────────────────────────────────┤
           │  1. GitHub Environment: "production"          │
           │  2. REQUIRED MANUAL APPROVAL GATE             │
           │  3. Tag Semver: :vX.Y.Z & :latest             │
           │  4. Ansible Deploy (ansible/deploy.yml)       │
           │  5. Restart compose.prod.yml (Port 5000)      │
           │  6. Production Health Validation              │
           └───────────────────────────────────────────────┘
```

---

## 1. Project Overview

NOTEForge solves the dual challenges of building a clean productivity application and implementing a complete production-grade DevOps lifecycle:
- **Writing Experience**: Dual-pane editor with debounced live Markdown preview rendered by `mistune` on the Flask backend.
- **Data Persistence**: Backed by PostgreSQL with indexing across timestamps, titles, and note flags (`is_favorite`, `is_trashed`).
- **DevOps Maturity**: Real GitHub Actions CI/CD workflows, automated changelog generation, encrypted secrets via Ansible Vault, multi-environment Docker Compose overrides, and automated rollbacks on smoke test failures.

---

## 2. Application Architecture

```
NoteForge/
├── .github/workflows/
│   ├── ci.yml                 # PR CI: Lint, pytest, Docker build, GHCR push
│   ├── staging.yml            # Staging CD: Changelog, Ansible deploy, smoke test, rollback
│   └── production.yml         # Production CD: Environment approval gate, semver tagging
├── ansible/
│   ├── ansible.cfg            # Ansible config (inventory, vault pass, callbacks)
│   ├── deploy.yml             # Zero-downtime deployment playbook
│   ├── rollback.yml           # Automated rollback playbook
│   ├── inventory/
│   │   └── hosts.ini          # Inventory definition (local, staging, production)
│   └── vault/
│       ├── secrets.yml        # Ansible Vault encrypted production secrets ($ANSIBLE_VAULT;1.1;AES256)
│       └── vault_pass.example # Vault password reference format
├── app/
│   ├── __init__.py            # Application package init
│   ├── app.py                 # Flask factory, views, REST API, /health endpoint
│   ├── config.py              # Dev, Staging, Prod, Testing configurations
│   ├── models.py              # PostgreSQL SQLAlchemy Note model & mistune integration
│   ├── static/
│   │   ├── css/styles.css     # Slate design system (Linear/Notion/Obsidian inspired)
│   │   └── js/app.js          # Live mistune preview, shortcuts (Ctrl+S, Ctrl+K), modals
│   └── templates/
│       ├── base.html          # Semantic HTML shell, navigation, modals, toasts
│       ├── index.html         # Workspace view, search, grid cards, empty states
│       ├── editor.html        # Dual-pane Markdown editor with toolbar
│       ├── view.html          # Clean reading view with metadata
│       └── error.html         # User-friendly error views (no raw stack traces)
├── scripts/
│   ├── smoke_test.py          # Automated health & CRUD smoke tests for CI/CD
│   ├── update_changelog.py    # Git-driven automated changelog updater
│   └── vault_helper.py        # Cross-platform Ansible Vault 1.1 AES-256 encrypt/decrypt
├── tests/
│   ├── __init__.py
│   └── test_notes.py          # 19 unit & integration tests covering all requirements
├── compose.prod.yml           # Production Docker Compose override (replicas, limits)
├── compose.staging.yml        # Staging Docker Compose override (port 5001/5433)
├── docker-compose.yml         # Base multi-container compose file (Flask + PostgreSQL)
├── Dockerfile                 # Multi-stage lean production Dockerfile (non-root user)
├── CHANGELOG.md               # Keep a Changelog compliant release history
└── requirements.txt           # Project dependencies
```

---

## 3. Local Setup & Quickstart

### Prerequisites
- Python 3.11, 3.12, or 3.13
- Git 2.40+
- Docker Desktop with WSL2 backend (for container stacks)

### Standalone Python Setup
```powershell
# Clone the repository
git clone https://github.com/owner/noteforge.git
cd NoteForge

# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # On Linux/macOS: source .venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Run unit & integration test suite (Pytest)
pytest tests/test_notes.py -v

# Run Flake8 linter
flake8 app tests --max-line-length=120 --exclude=.venv

# Install Playwright and run End-to-End (E2E) test suite
npm install
npx playwright install chromium
npm run test:e2e

# Run the local Flask server
$env:FLASK_ENV="development"
$env:DATABASE_URL="sqlite:///local_dev.db" # Or postgresql://postgres:postgres@localhost:5432/noteforge
python -m flask --app "app.app:create_app()" run --port=5000
```
Visit `http://localhost:5000/` in your browser.

---

## 4. Environment Variables

| Variable | Description | Default | Environment |
| :--- | :--- | :--- | :--- |
| `FLASK_ENV` | Application environment (`development`, `staging`, `production`, `testing`) | `development` | All |
| `DATABASE_URL` | PostgreSQL connection string (`postgresql://user:pass@host:port/dbname`) | Local PostgreSQL | All |
| `SECRET_KEY` | Cryptographic secret for sessions and CSRF | Insecure dev key | Prod / Staging |
| `PORT` | Web port binding | `5000` | All |
| `APP_VERSION` | Version label reported by `/health` endpoint | `1.0.0` | All |
| `ANSIBLE_VAULT_PASSWORD` | Vault decryption key for CI/CD | In GitHub Secret | Staging / Prod |

---

## 5. PostgreSQL Database Setup

NOTEForge uses PostgreSQL as its true persistent storage backend.

### Running PostgreSQL in Docker
```powershell
docker run -d `
  --name noteforge-postgres `
  -e POSTGRES_USER=noteforge_user `
  -e POSTGRES_PASSWORD=noteforge_dev_pwd `
  -e POSTGRES_DB=noteforge `
  -p 5432:5432 `
  -v noteforge_data:/var/lib/postgresql/data `
  postgres:16-alpine
```

### PostgreSQL Note Model Schema
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique note identifier |
| `title` | `VARCHAR(255)` | NOT NULL, INDEXED | Note title |
| `content` | `TEXT` | NOT NULL | Raw Markdown content |
| `is_favorite` | `BOOLEAN` | NOT NULL, DEFAULT FALSE, INDEXED | Favorite bookmark flag |
| `is_trashed` | `BOOLEAN` | NOT NULL, DEFAULT FALSE, INDEXED | Soft delete / Trash flag |
| `created_at` | `TIMESTAMP WITH TIME ZONE`| NOT NULL, INDEXED | UTC creation timestamp |
| `updated_at` | `TIMESTAMP WITH TIME ZONE`| NOT NULL, INDEXED | UTC last modified timestamp |

---

## 6. Docker & Compose Usage

### Local Multi-Container Stack (Flask + PostgreSQL)
```powershell
# Build and launch both Flask application and PostgreSQL database
docker compose up --build -d

# View service logs
docker compose logs -f web

# Check container health status
docker compose ps
```

### Staging Stack
Uses `compose.staging.yml` override (Port 5001 for Flask, Port 5433 for DB):
```powershell
docker compose -f docker-compose.yml -f compose.staging.yml up -d
```

### Production Stack
Uses `compose.prod.yml` override (2 replicas for Flask, resource limits, restart policy `always`):
```powershell
docker compose -f docker-compose.yml -f compose.prod.yml up -d
```

---

## 7. Branch Strategy

```
feature/my-feature ──> Pull Request ──> staging ──> Pull Request ──> main
 (Local Dev)                             (Staging)                     (Production)
```

1. **`feature/*`**:
   - All feature and bugfix branches originate from `staging`.
   - Developers commit changes, run pytest and flake8 locally.
2. **`staging`**:
   - Integration branch.
   - Merging requires a Pull Request triggering `.github/workflows/ci.yml`.
   - Successful merge triggers `.github/workflows/staging.yml` (Ansible deployment, smoke tests, automatic rollback).
3. **`main`**:
   - Production branch.
   - Protected: Direct pushes prohibited; requires Pull Request and code review.
   - Merging triggers `.github/workflows/production.yml` requiring manual approval in the `production` GitHub Environment.

---

## 8. CI Pipeline (`.github/workflows/ci.yml`)

Triggered automatically on Pull Requests targeting `staging`.
1. **Lint Job**: Runs `flake8 app tests --max-line-length=120`. Fails if linting errors exist.
2. **Test Job**: Runs `pytest tests/test_notes.py -v`. Fails if any test fails.
3. **Build & Push Job**: Builds the multi-stage Docker image and pushes to GitHub Container Registry (GHCR) tagged:
   ```
   ghcr.io/owner/noteforge:staging-${GITHUB_SHA}
   ghcr.io/owner/noteforge:staging-latest
   ```

---

## 9. Staging Deployment (`.github/workflows/staging.yml`)

Triggered automatically on push / merge to `staging`.
1. Automatically executes `scripts/update_changelog.py` and commits changelog updates.
2. Pulls the verified image `staging-${GITHUB_SHA}` from GHCR.
3. Executes `ansible/deploy.yml` with the Ansible Vault password.
4. Backs up the active image version to `/opt/noteforge/staging/state/last_known_good_image.txt`.
5. Restarts the staging compose stack on Port 5001.
6. Executes `scripts/smoke_test.py` against `http://localhost:5001`.

---

## 10. Automated Rollback (`ansible/rollback.yml`)

If `scripts/smoke_test.py` fails during the staging deployment:
1. GitHub Actions detects failure via `if: failure() && steps.smoke_tests.outcome == 'failure'`.
2. Automatically triggers `ansible-playbook ansible/rollback.yml`.
3. Reads `/opt/noteforge/staging/state/last_known_good_image.txt`.
4. Pulls and restarts the exact previous known-good Docker container image.
5. Re-probes `/health` to confirm the application is healthy.
6. Emits diagnostic alerts without manual intervention.

---

## 11. Production Approval Gate & Release (`.github/workflows/production.yml`)

1. Triggered on merge to `main`.
2. Blocks execution at the **`production`** GitHub Actions environment.
3. Requires designated reviewers to click **Review deployments -> Approve and deploy**.
4. Builds and tags production images with official semantic versioning:
   ```
   ghcr.io/owner/noteforge:vX.Y.Z
   ghcr.io/owner/noteforge:latest
   ```
5. Executes `ansible/deploy.yml` targeting production hosts on Port 5000 with 2 container replicas.
6. Runs final production health probe validation.

---

## 12. Ansible Vault Secret Management

Production secrets (database passwords, session secret keys) are encrypted using **Ansible Vault 1.1 AES-256** and committed to `ansible/vault/secrets.yml`.

### Decrypting / Viewing Secrets
```powershell
# Using the cross-platform vault helper
python scripts/vault_helper.py decrypt ansible/vault/secrets.yml decrypted.yml "noteforge_vault_key_2026"

# Or using native ansible-vault (Linux / WSL2)
ansible-vault view ansible/vault/secrets.yml --vault-password-file ansible/vault/vault_pass.example
```

### Encrypting Updated Secrets
```powershell
python scripts/vault_helper.py encrypt updated.yml ansible/vault/secrets.yml "noteforge_vault_key_2026"
```

### GitHub Actions Configuration
Configure the secret in your GitHub repository:
- **Name**: `ANSIBLE_VAULT_PASSWORD`
- **Value**: `noteforge_vault_key_2026` (or your chosen production vault key)

---

## 13. GHCR Image Tagging & Semantic Versioning

- **CI / Pull Requests**:
  `ghcr.io/owner/noteforge:staging-${GITHUB_SHA}`
  `ghcr.io/owner/noteforge:staging-latest`
- **Production Releases**:
  `ghcr.io/owner/noteforge:v1.0.0`
  `ghcr.io/owner/noteforge:latest`

Arbitrary tags are strictly prohibited. Production versions follow strict [SemVer 2.0.0](https://semver.org/).

---

## 14. Automated CHANGELOG Generation

The script `scripts/update_changelog.py` automatically parses Git commit history:
- Identifies `feat:`, `fix:`, `ci:`, and `docs:` conventional commits.
- Formats structured release notes adhering to [Keep a Changelog](https://keepachangelog.com/).
- Inserts new entries into `CHANGELOG.md` directly below the header without destroying historical releases.

---

## 15. Windows + Docker Desktop + WSL2 Setup

For developers on Windows running Docker Desktop with WSL2 backend:
1. Ensure **Docker Desktop -> Settings -> General -> Use the WSL 2 based engine** is checked.
2. Ensure **Settings -> Resources -> WSL Integration** is enabled for your Linux distribution (Ubuntu).
3. Clone or access the project inside the WSL2 file system (`/home/username/NoteForge` or `/mnt/c/Agen/NoteForge`).
4. Execute compose commands normally in PowerShell or WSL2 bash:
   ```powershell
   docker compose -f docker-compose.yml -f compose.staging.yml up -d
   ```
5. Port forwarding through `localhost:5000` or `localhost:5001` is automatically routed by WSL2.

---

## 16. Verification & Quality Checklist

- [x] Flask Notes application fully functional
- [x] Create note with title and Markdown body
- [x] View all notes in workspace grid
- [x] View single note with reading time and metadata
- [x] Edit note with two-pane live editor
- [x] Delete note with confirmation modal and trash management
- [x] PostgreSQL persistence schema (`id`, `title`, `content`, `created_at`, `updated_at`)
- [x] Markdown rendering using `mistune` (headers, tables, checklists, code blocks)
- [x] Full test suite (19 tests) passing with 0 warnings
- [x] Flake8 linter passing with 0 warnings
- [x] Multi-stage production `Dockerfile`
- [x] Base `docker-compose.yml` with health checks
- [x] `compose.staging.yml` override (Port 5001, staging resources)
- [x] `compose.prod.yml` override (Port 5000, 2 replicas)
- [x] Feature, staging, and main branch strategy documented
- [x] CI workflow (`.github/workflows/ci.yml`)
- [x] Staging workflow (`.github/workflows/staging.yml`)
- [x] Real Ansible deployment (`ansible/deploy.yml`)
- [x] Automated smoke tests (`scripts/smoke_test.py`)
- [x] Real automatic rollback (`ansible/rollback.yml`)
- [x] Production approval gate and semver tagging (`.github/workflows/production.yml`)
- [x] Ansible Vault encrypted secrets committed (`ansible/vault/secrets.yml`)
- [x] Automated changelog script (`scripts/update_changelog.py`)
- [x] UI designed with clean Linear/Notion/Obsidian productivity aesthetics
