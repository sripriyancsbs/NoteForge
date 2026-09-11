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
    WSGI middleware to restore original requested client URL path on Vercel.

    When Vercel rewrites incoming traffic `/(.*)` to `/api/index`, the Vercel
    platform passes the original client path in the `x-matched-path` header
    (WSGI: `HTTP_X_MATCHED_PATH`) while `PATH_INFO` may hold the rewritten
    destination `/api/index` or `/api/index.py`. This middleware restores
    `PATH_INFO` so Flask routes (e.g. `/`, `/health`, `/notes/...`, `/api/...`)
    match accurately.
    """

    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        matched_path = (
            environ.get("HTTP_X_MATCHED_PATH")
            or environ.get("HTTP_X_FORWARDED_URI")
            or environ.get("HTTP_X_ORIGINAL_URI")
        )
        if matched_path:
            # Strip query string from matched path if present
            environ["PATH_INFO"] = matched_path.split("?")[0]
        elif environ.get("PATH_INFO") in ("/api/index.py", "/api/index", "/api", "/api/"):
            # If accessed directly at the entrypoint without rewrite headers, map to root
            environ["PATH_INFO"] = "/"

        return self.wsgi_app(environ, start_response)


# Initialize the Flask WSGI application instance for Vercel
app = create_app()
app.wsgi_app = VercelPathMiddleware(app.wsgi_app)
