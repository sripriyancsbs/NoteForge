# Changelog

All notable changes to NoteForge are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.0.0] - 2026-09-11 10:00 UTC

### Features
- Initial release of NOTEForge — Production Markdown Notes Workspace.
- Implemented PostgreSQL persistence for notes (`id`, `title`, `content`, `created_at`, `updated_at`, `is_favorite`, `is_trashed`).
- Two-pane desktop Markdown editor with live backend preview rendered by `mistune`.
- Mobile-responsive layout with editor/preview tab switcher.
- PostgreSQL full-text search across note titles and content.
- Favorites and soft-delete/trash management with restore and permanent deletion.
- Modal confirmation dialog for note deletion and toast notification system.

### DevOps & CI/CD
- Multi-stage production `Dockerfile` with non-root user and curl health check.
- Multi-container `docker-compose.yml` with Flask application and PostgreSQL database.
- Staging (`compose.staging.yml`) and production (`compose.prod.yml`) overrides for port and replica variations.
- GitHub Actions CI workflow (`.github/workflows/ci.yml`) for linting, testing, and building GHCR images tagged `staging-${GITHUB_SHA}`.
- Automated staging deployment workflow (`.github/workflows/staging.yml`) with Ansible and smoke testing.
- Automated rollback mechanism (`ansible/rollback.yml`) restoring previous verified known-good Docker image if smoke tests fail.
- Production workflow (`.github/workflows/production.yml`) with manual approval gate and semantic versioning (`:vX.Y.Z` and `:latest`).
- Ansible Vault configuration for encrypted production credentials (`ansible/vault/secrets.yml`).
- Automated changelog script (`scripts/update_changelog.py`) prepending updates on staging merge.
