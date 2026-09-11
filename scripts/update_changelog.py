#!/usr/bin/env python3
"""
scripts/update_changelog.py
Automated changelog generator for NoteForge CI/CD pipeline.
Inspects recent Git commits, generates structured Markdown release notes,
and prepends them to CHANGELOG.md without overwriting historical entries.
"""

import os
import sys
import subprocess
from datetime import datetime, timezone


def get_git_output(cmd_args):
    """Run a git command and return stripped stdout."""
    try:
        result = subprocess.run(
            ["git"] + cmd_args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return ""


def get_recent_commits(max_count=15):
    """Retrieve recent commits formatted as (sha, author, message)."""
    raw_log = get_git_output([
        "log",
        f"-n{max_count}",
        "--pretty=format:%h|%an|%s"
    ])
    if not raw_log:
        return []

    commits = []
    for line in raw_log.splitlines():
        parts = line.split("|", 2)
        if len(parts) == 3:
            commits.append({
                "sha": parts[0],
                "author": parts[1],
                "message": parts[2]
            })
    return commits


def categorize_commits(commits):
    """Categorize commits by type based on conventional commit prefixes."""
    categories = {
        "Features": [],
        "Fixes": [],
        "DevOps & CI/CD": [],
        "Documentation": [],
        "Other Changes": []
    }

    for c in commits:
        msg = c["message"]
        sha = c["sha"]
        entry = f"- {msg} (`{sha}`)"

        msg_lower = msg.lower()
        if msg_lower.startswith("feat"):
            categories["Features"].append(entry)
        elif msg_lower.startswith("fix"):
            categories["Fixes"].append(entry)
        elif any(k in msg_lower for k in ["ci", "cd", "docker", "ansible", "workflow", "deploy", "pipeline"]):
            categories["DevOps & CI/CD"].append(entry)
        elif any(k in msg_lower for k in ["doc", "readme", "guide"]):
            categories["Documentation"].append(entry)
        else:
            categories["Other Changes"].append(entry)

    return categories


def build_changelog_entry(categories, release_tag=None, commit_sha=None):
    """Construct markdown section for the release."""
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    title = release_tag or (f"Staging Build ({commit_sha[:7]})" if commit_sha else f"Staging Update ({now_str})")

    lines = [
        f"## [{title}] - {now_str}\n"
    ]

    has_content = False
    for cat_name, items in categories.items():
        if items:
            has_content = True
            lines.append(f"### {cat_name}")
            lines.extend(items)
            lines.append("")

    if not has_content:
        lines.append("- Routine pipeline update and dependency synchronization.\n")

    lines.append("---\n")
    return "\n".join(lines)


def update_changelog_file(changelog_path, new_entry, dry_run=False):
    """Prepend new entry into CHANGELOG.md after header, preserving history."""
    if not os.path.exists(changelog_path):
        header = "# Changelog\n\nAll notable changes to NoteForge are documented in this file.\n\n---\n\n"
        existing_content = ""
    else:
        with open(changelog_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Split after top header
        marker = "---\n\n"
        if marker in content:
            header, existing_content = content.split(marker, 1)
            header += marker
        else:
            header = "# Changelog\n\nAll notable changes to NoteForge are documented in this file.\n\n---\n\n"
            existing_content = content

    updated_full_text = header + new_entry + "\n" + existing_content.lstrip()

    if dry_run:
        print("=== DRY RUN: CHANGELOG OUTPUT ===")
        print(new_entry)
        return

    with open(changelog_path, "w", encoding="utf-8") as f:
        f.write(updated_full_text)
    print(f"Successfully updated {changelog_path}")


def main():
    dry_run = "--dry-run" in sys.argv
    tag = os.environ.get("RELEASE_TAG") or (sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else None)
    sha = os.environ.get("GITHUB_SHA") or get_git_output(["rev-parse", "--short", "HEAD"]) or "dev"

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    changelog_file = os.path.join(repo_root, "CHANGELOG.md")

    commits = get_recent_commits(15)
    categorized = categorize_commits(commits)
    new_entry = build_changelog_entry(categorized, release_tag=tag, commit_sha=sha)

    update_changelog_file(changelog_file, new_entry, dry_run=dry_run)


if __name__ == "__main__":
    main()
