import os
import logging
from datetime import datetime, timezone
from flask import (
    Flask,
    render_template,
    request,
    jsonify
)
from sqlalchemy.exc import SQLAlchemyError

from .config import config_by_name
from .models import db, Note, render_markdown

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("noteforge")


def create_app(config_name: str = None) -> Flask:
    """Application factory for NoteForge."""
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config_by_name.get(config_name, config_by_name["default"]))

    # Override database URI dynamically if DATABASE_URL is supplied (e.g. Vercel Environment Variables)
    db_url = os.environ.get("DATABASE_URL")
    if db_url and config_name != "testing":
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        app.config["SQLALCHEMY_DATABASE_URI"] = db_url

    # Override secret key dynamically if SECRET_KEY is supplied
    secret_key = os.environ.get("SECRET_KEY")
    if secret_key:
        app.config["SECRET_KEY"] = secret_key

    # Initialize extensions
    db.init_app(app)

    with app.app_context():
        try:
            db.create_all()
            logger.info("Database tables verified/created successfully.")
        except Exception as e:
            logger.warning(f"Database initialization deferred or failed: {e}")

    # -------------------------------------------------------------------------
    # Health Check Endpoint
    # -------------------------------------------------------------------------
    @app.route("/health", methods=["GET"])
    def health_check():
        """Health check endpoint used by Docker, Kubernetes, Ansible, and smoke tests."""
        status = {
            "status": "healthy",
            "service": "noteforge",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "database": "connected",
            "version": os.environ.get("APP_VERSION", "1.0.0")
        }
        try:
            # Verify DB connection with a quick query
            db.session.execute(db.text("SELECT 1"))
            return jsonify(status), 200
        except Exception as err:
            logger.error(f"Health check DB probe failed: {err}")
            status["status"] = "degraded"
            status["database"] = "disconnected"
            return jsonify(status), 503

    # -------------------------------------------------------------------------
    # UI Web Pages (HTML Rendering)
    # -------------------------------------------------------------------------
    @app.route("/", methods=["GET"])
    @app.route("/api/index", methods=["GET"])
    def home():
        """Main workspace view with sidebar, note list, and search."""
        category = request.args.get("category", "all")
        search_query = request.args.get("q", "").strip()

        try:
            notes_query = Note.query

            if category == "trash":
                notes_query = notes_query.filter_by(is_trashed=True)
            else:
                notes_query = notes_query.filter_by(is_trashed=False)
                if category == "favorites":
                    notes_query = notes_query.filter_by(is_favorite=True)
                elif category == "recent":
                    # Order by updated_at limit to recent
                    notes_query = notes_query.order_by(Note.updated_at.desc())

            if search_query:
                term = f"%{search_query}%"
                notes_query = notes_query.filter(
                    db.or_(Note.title.ilike(term), Note.content.ilike(term))
                )

            # Default ordering
            notes = notes_query.order_by(Note.updated_at.desc()).all()

            # Sidebar counts
            counts = {
                "all": Note.query.filter_by(is_trashed=False).count(),
                "favorites": Note.query.filter_by(is_trashed=False, is_favorite=True).count(),
                "recent": min(5, Note.query.filter_by(is_trashed=False).count()),
                "trash": Note.query.filter_by(is_trashed=True).count(),
            }

            return render_template(
                "index.html",
                notes=notes,
                category=category,
                search_query=search_query,
                counts=counts,
                total_notes=len(notes)
            )
        except SQLAlchemyError as err:
            logger.error(f"Database error on home page: {err}")
            return render_template(
                "error.html",
                error_title="Database Unavailable",
                error_message=(
                    "Could not load notes due to a database connection issue. "
                    "Please verify PostgreSQL is running."
                )
            ), 500

    @app.route("/notes/new", methods=["GET"])
    def new_note_page():
        """Focused dual-pane Markdown writing view for creating a note."""
        return render_template("editor.html", note=None, is_new=True)

    @app.route("/notes/<int:note_id>", methods=["GET"])
    def view_note_page(note_id: int):
        """Clean distraction-free reading view for a single note."""
        try:
            note = db.session.get(Note, note_id)
            if not note or note.is_trashed:
                return render_template(
                    "error.html",
                    error_title="Note Not Found",
                    error_message=f"The requested note #{note_id} does not exist or may have been deleted."
                ), 404
            return render_template("view.html", note=note)
        except SQLAlchemyError as err:
            logger.error(f"Database error loading note {note_id}: {err}")
            return render_template(
                "error.html",
                error_title="Database Error",
                error_message="Failed to retrieve the note."
            ), 500

    @app.route("/notes/<int:note_id>/edit", methods=["GET"])
    def edit_note_page(note_id: int):
        """Focused dual-pane Markdown editor view for editing an existing note."""
        try:
            note = db.session.get(Note, note_id)
            if not note or note.is_trashed:
                return render_template(
                    "error.html",
                    error_title="Note Not Found",
                    error_message=f"The note #{note_id} could not be found to edit."
                ), 404
            return render_template("editor.html", note=note, is_new=False)
        except SQLAlchemyError as err:
            logger.error(f"Database error loading note {note_id} for edit: {err}")
            return render_template(
                "error.html",
                error_title="Database Error",
                error_message="Failed to retrieve note for editing."
            ), 500

    # -------------------------------------------------------------------------
    # REST / JSON API Endpoints
    # -------------------------------------------------------------------------
    @app.route("/api/notes", methods=["GET"])
    def api_get_notes():
        """List notes with optional search query and category filter."""
        search_query = request.args.get("q", "").strip()
        category = request.args.get("category", "all")

        try:
            query = Note.query
            if category == "trash":
                query = query.filter_by(is_trashed=True)
            else:
                query = query.filter_by(is_trashed=False)
                if category == "favorites":
                    query = query.filter_by(is_favorite=True)

            if search_query:
                term = f"%{search_query}%"
                query = query.filter(
                    db.or_(Note.title.ilike(term), Note.content.ilike(term))
                )

            notes = query.order_by(Note.updated_at.desc()).all()
            return jsonify([n.to_dict(include_html=False) for n in notes]), 200
        except SQLAlchemyError as err:
            logger.error(f"API get notes DB error: {err}")
            return jsonify({"error": "Database error while fetching notes"}), 500

    @app.route("/api/notes", methods=["POST"])
    def api_create_note():
        """Create a new note with input validation."""
        data = request.get_json(silent=True)
        if data is None:
            data = request.form.to_dict()

        if not data or not isinstance(data, dict):
            return jsonify({"error": "Missing or invalid request payload"}), 400

        title_val = data.get("title")
        content_val = data.get("content")

        if title_val is not None and not isinstance(title_val, str):
            return jsonify({"error": "Title must be a text string"}), 400
        if content_val is not None and not isinstance(content_val, str):
            return jsonify({"error": "Content must be a text string"}), 400

        title = (title_val or "").strip()
        content = (content_val or "").strip()

        # Validation
        if not title:
            return jsonify({"error": "Note title is required"}), 400
        if len(title) > 255:
            return jsonify({"error": "Title cannot exceed 255 characters"}), 400
        if not content:
            return jsonify({"error": "Note content cannot be empty"}), 400

        try:
            note = Note(
                title=title,
                content=content,
                is_favorite=bool(data.get("is_favorite", False))
            )
            db.session.add(note)
            db.session.commit()
            logger.info(f"Created note #{note.id} ('{note.title}')")
            return jsonify(note.to_dict(include_html=True)), 201
        except SQLAlchemyError as err:
            db.session.rollback()
            logger.error(f"API create note DB error: {err}")
            return jsonify({"error": "Failed to save note due to database error"}), 500

    @app.route("/api/notes/<int:note_id>", methods=["GET"])
    def api_get_note(note_id: int):
        """Retrieve single note with rendered mistune Markdown HTML."""
        try:
            note = db.session.get(Note, note_id)
            if not note or note.is_trashed:
                return jsonify({"error": f"Note #{note_id} not found"}), 404
            return jsonify(note.to_dict(include_html=True)), 200
        except SQLAlchemyError as err:
            logger.error(f"API get note {note_id} DB error: {err}")
            return jsonify({"error": "Database error retrieving note"}), 500

    @app.route("/api/notes/<int:note_id>", methods=["PUT", "PATCH"])
    def api_update_note(note_id: int):
        """Update note title, content, or flags with validation."""
        data = request.get_json(silent=True)
        if data is None:
            data = request.form.to_dict()

        if not data or not isinstance(data, dict):
            return jsonify({"error": "Missing or invalid request payload"}), 400

        try:
            note = db.session.get(Note, note_id)
            if not note:
                return jsonify({"error": f"Note #{note_id} not found"}), 404

            if "title" in data:
                title_val = data["title"]
                if title_val is not None and not isinstance(title_val, str):
                    return jsonify({"error": "Title must be a text string"}), 400
                title = (title_val or "").strip()
                if not title:
                    return jsonify({"error": "Title cannot be empty"}), 400
                if len(title) > 255:
                    return jsonify({"error": "Title cannot exceed 255 characters"}), 400
                note.title = title

            if "content" in data:
                content_val = data["content"]
                if content_val is not None and not isinstance(content_val, str):
                    return jsonify({"error": "Content must be a text string"}), 400
                content = (content_val or "").strip()
                if not content:
                    return jsonify({"error": "Content cannot be empty"}), 400
                note.content = content

            if "is_favorite" in data:
                note.is_favorite = bool(data["is_favorite"])

            if "is_trashed" in data:
                note.is_trashed = bool(data["is_trashed"])

            note.updated_at = datetime.now(timezone.utc)
            db.session.commit()
            logger.info(f"Updated note #{note.id}")
            return jsonify(note.to_dict(include_html=True)), 200
        except SQLAlchemyError as err:
            db.session.rollback()
            logger.error(f"API update note {note_id} DB error: {err}")
            return jsonify({"error": "Database error updating note"}), 500

    @app.route("/api/notes/<int:note_id>", methods=["DELETE"])
    def api_delete_note(note_id: int):
        """Delete note. If permanent=true, hard delete; otherwise move to trash."""
        permanent = request.args.get("permanent", "false").lower() == "true"
        try:
            note = db.session.get(Note, note_id)
            if not note:
                return jsonify({"error": f"Note #{note_id} not found"}), 404

            if permanent or note.is_trashed:
                db.session.delete(note)
                db.session.commit()
                logger.info(f"Permanently deleted note #{note_id}")
                return jsonify({"message": f"Note #{note_id} permanently deleted", "id": note_id}), 200
            else:
                note.is_trashed = True
                note.updated_at = datetime.now(timezone.utc)
                db.session.commit()
                logger.info(f"Moved note #{note_id} to trash")
                return jsonify({"message": f"Note #{note_id} moved to trash", "id": note_id}), 200
        except SQLAlchemyError as err:
            db.session.rollback()
            logger.error(f"API delete note {note_id} DB error: {err}")
            return jsonify({"error": "Database error deleting note"}), 500

    @app.route("/api/notes/<int:note_id>/favorite", methods=["POST"])
    def api_toggle_favorite(note_id: int):
        """Toggle favorite status of a note."""
        try:
            note = db.session.get(Note, note_id)
            if not note:
                return jsonify({"error": f"Note #{note_id} not found"}), 404
            note.is_favorite = not note.is_favorite
            db.session.commit()
            return jsonify({"id": note.id, "is_favorite": note.is_favorite}), 200
        except SQLAlchemyError as err:
            db.session.rollback()
            logger.error(f"API toggle favorite note {note_id} DB error: {err}")
            return jsonify({"error": "Database error toggling favorite"}), 500

    @app.route("/api/notes/<int:note_id>/restore", methods=["POST"])
    def api_restore_note(note_id: int):
        """Restore a note from the trash."""
        try:
            note = db.session.get(Note, note_id)
            if not note:
                return jsonify({"error": f"Note #{note_id} not found"}), 404
            note.is_trashed = False
            note.updated_at = datetime.now(timezone.utc)
            db.session.commit()
            return jsonify({"message": f"Note #{note_id} restored", "id": note.id}), 200
        except SQLAlchemyError as err:
            db.session.rollback()
            logger.error(f"API restore note {note_id} DB error: {err}")
            return jsonify({"error": "Database error restoring note"}), 500

    @app.route("/api/markdown/preview", methods=["POST"])
    def api_markdown_preview():
        """Render raw markdown to HTML on the Flask backend using mistune."""
        data = request.get_json(silent=True) or {}
        if not isinstance(data, dict):
            data = {}
        raw_text = data.get("content", "")
        if not isinstance(raw_text, str):
            raw_text = str(raw_text)
        html = render_markdown(raw_text)
        return jsonify({
            "html": html,
            "word_count": len(raw_text.split()) if raw_text else 0,
            "char_count": len(raw_text)
        }), 200

    # -------------------------------------------------------------------------
    # Global Error Handlers (No raw stack traces in production)
    # -------------------------------------------------------------------------
    @app.errorhandler(404)
    def not_found_error(error):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Resource not found"}), 404
        return render_template(
            "error.html",
            error_title="Page Not Found",
            error_message="The page or note you are looking for does not exist."
        ), 404

    @app.errorhandler(500)
    def internal_server_error(error):
        logger.error(f"Internal server error: {error}")
        if request.path.startswith("/api/"):
            return jsonify({"error": "Internal server error"}), 500
        return render_template(
            "error.html",
            error_title="Server Error",
            error_message="An unexpected server error occurred. Our team has been notified."
        ), 500

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
