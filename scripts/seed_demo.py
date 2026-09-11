import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.app import create_app
from app.models import db, Note


def seed_database():
    app = create_app("development")
    with app.app_context():
        db.create_all()
        if Note.query.count() == 0:
            notes = [
                Note(
                    title="Welcome to NOTEForge 📝",
                    content="""# Welcome to NOTEForge

NOTEForge is an enterprise-grade Markdown notes workspace designed for high-performance engineering teams.

## Key Capabilities
- **Dual-Pane Editor**: Real-time mistune backend rendering on desktop
- **Persistent Storage**: Robust PostgreSQL data model with full-text search
- **CI/CD Built-in**: Complete Docker, GitHub Actions, GHCR, and Ansible pipeline

### Productivity Shortcuts
- `Ctrl + S`: Instantly save note
- `Ctrl + K`: Quick search across all note titles and content
- `Ctrl + N`: Create a new note from anywhere

> "Simplicity is prerequisite for reliability." — Edsger W. Dijkstra
""",
                    is_favorite=True
                ),
                Note(
                    title="CI/CD Pipeline Architecture & Rollback 🚀",
                    content="""# Pipeline Architecture Overview

The NOTEForge deployment pipeline is built for zero-downtime releases and automatic failure recovery.

## Verification Matrix
| Environment | Port | Replicas | Strategy |
| :--- | :--- | :--- | :--- |
| **Staging** | `5001` | 1 | Smoke test + automated rollback |
| **Production** | `5000` | 2 | Manual approval gate + SemVer |

### Automated Pipeline Stages
- [x] Flake8 code linting
- [x] Pytest suite execution (19 tests)
- [x] Multi-stage Docker image build
- [x] Push to GitHub Container Registry (GHCR)
- [x] Ansible deployment with encrypted Vault credentials
- [x] Automated smoke tests with instant rollback fallback
""",
                    is_favorite=True
                ),
                Note(
                    title="Markdown & mistune Showcase ⚡",
                    content="""# Markdown Formatting Guide

This note tests the rich formatting capabilities provided by the **mistune** parser.

## Code Highlighting
```python
def deploy_application(image_tag: str):
    logger.info(f"Deploying image: {image_tag}")
    return {"status": "deployed", "health": "healthy"}
```

## Task Checklist
- [x] Database indexes created
- [x] Non-root Docker container configured
- [ ] Schedule weekly backup job
""",
                    is_favorite=False
                )
            ]
            db.session.add_all(notes)
            db.session.commit()
            print("Successfully seeded demo notes into database.")
        else:
            print(f"Database already contains {Note.query.count()} notes.")


if __name__ == "__main__":
    seed_database()
