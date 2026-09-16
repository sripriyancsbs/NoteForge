from datetime import datetime, timezone
import mistune
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Configure mistune Markdown renderer with modern plugins and hard line breaks
try:
    # mistune v3+ plugin configuration with hard_wrap enabled for intuitive note line breaks
    markdown_renderer = mistune.create_markdown(
        hard_wrap=True,
        plugins=['table', 'task_lists', 'strikethrough', 'footnotes', 'def_list']
    )
except Exception:
    # fallback to default mistune renderer if plugin configuration differs
    markdown_renderer = mistune.create_markdown(hard_wrap=True)


def render_markdown(text: str) -> str:
    """Render markdown string into safe HTML using mistune."""
    if not text:
        return ""
    try:
        return markdown_renderer(text)
    except Exception:
        # Fallback to direct mistune call with hard_wrap
        try:
            return mistune.create_markdown(hard_wrap=True)(text)
        except Exception:
            return mistune.html(text)


class Note(db.Model):
    """Note model representing a Markdown note in PostgreSQL."""
    __tablename__ = "notes"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(255), nullable=False, index=True)
    content = db.Column(db.Text, nullable=False)
    is_favorite = db.Column(db.Boolean, default=False, nullable=False, index=True)
    is_trashed = db.Column(db.Boolean, default=False, nullable=False, index=True)
    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )

    def to_dict(self, include_html: bool = True) -> dict:
        """Serialize Note model instance into a dictionary."""
        data = {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "is_favorite": self.is_favorite,
            "is_trashed": self.is_trashed,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "snippet": self.get_snippet(),
            "word_count": len(self.content.split()) if self.content else 0,
            "reading_time_min": max(1, round(len(self.content.split()) / 200)) if self.content else 1
        }
        if include_html:
            data["rendered_html"] = self.rendered_html
        return data

    @property
    def rendered_html(self) -> str:
        """Render note Markdown content as HTML using mistune."""
        return render_markdown(self.content or "")

    def get_snippet(self, max_length: int = 140) -> str:
        """Generate a clean plain text preview snippet for note listings."""
        if not self.content:
            return "No content"
        # Strip common markdown symbols for a clean preview
        cleaned = self.content.replace("#", "").replace("*", "").replace("`", "").replace(">", "").strip()
        lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
        first_line = " ".join(lines)
        if len(first_line) > max_length:
            return first_line[:max_length].rstrip() + "..."
        return first_line or "Empty note"

    @classmethod
    def search(cls, query_str: str, include_trashed: bool = False):
        """Search note titles and content in the database."""
        stmt = cls.query
        if not include_trashed:
            stmt = stmt.filter_by(is_trashed=False)

        if query_str and query_str.strip():
            term = f"%{query_str.strip()}%"
            stmt = stmt.filter(
                db.or_(
                    cls.title.ilike(term),
                    cls.content.ilike(term)
                )
            )
        return stmt.order_by(cls.updated_at.desc())
