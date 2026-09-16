"""
api/index.py
Vercel Serverless Function entrypoint for NoteForge Flask application.
"""
import os
import sys

# Ensure repository root is on sys.path for module resolution in Vercel runtime
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.app import create_app  # noqa: E402


class VercelPathMiddleware:
    """
    WSGI middleware for Vercel Serverless Function deployment.

    Ensures that client URL paths are preserved for Flask routing.
    If PATH_INFO points to the serverless function entrypoint (/api/index or
    /api/index.py), it restores the original requested path from request headers/URI,
    or falls back to root ('/').
    """

    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        path_info = environ.get("PATH_INFO", "")

        # If PATH_INFO is already a valid application route (e.g. /notes/new, /api/notes, /health),
        # keep it as-is so Flask routes accurately.
        if path_info in ("/api/index.py", "/api/index", "/api", "/api/"):
            # If the entrypoint was invoked via a rewrite, check if an original URI was passed
            original_path = (
                environ.get("HTTP_X_FORWARDED_URI")
                or environ.get("HTTP_X_ORIGINAL_URI")
                or environ.get("REQUEST_URI")
                or environ.get("RAW_URI")
            )
            if original_path and original_path.split("?")[0] not in ("/api/index.py", "/api/index", "/api", "/api/"):
                environ["PATH_INFO"] = original_path.split("?")[0]
            else:
                environ["PATH_INFO"] = "/"

        return self.wsgi_app(environ, start_response)


# Initialize the Flask WSGI application instance for Vercel
app = create_app()
app.wsgi_app = VercelPathMiddleware(app.wsgi_app)
