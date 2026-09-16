"""
api/index.py
Vercel Serverless Function entrypoint for NoteForge Flask application.
"""
import os
import sys
import urllib.parse

# Ensure repository root is on sys.path for module resolution in Vercel runtime
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.app import create_app  # noqa: E402


class VercelPathMiddleware:
    """
    WSGI middleware for Vercel Serverless Function deployment.

    Vercel rewrites `/(.*)` to `/api/index?__vercel_path=$1`.
    This middleware extracts `__vercel_path` from the query string to restore
    the original client requested `PATH_INFO` (e.g. `/notes/new`, `/api/notes`, `/health`),
    and cleans up `QUERY_STRING` so Flask route handlers receive undisturbed parameters.
    """

    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        query_string = environ.get("QUERY_STRING", "")
        if "__vercel_path=" in query_string:
            parsed_params = urllib.parse.parse_qs(query_string, keep_blank_values=True)
            if "__vercel_path" in parsed_params:
                raw_path = parsed_params.pop("__vercel_path")[0]
                environ["PATH_INFO"] = "/" + raw_path.lstrip("/")
                environ["QUERY_STRING"] = urllib.parse.urlencode(parsed_params, doseq=True)
        elif environ.get("PATH_INFO") in ("/api/index.py", "/api/index", "/api", "/api/"):
            environ["PATH_INFO"] = "/"

        return self.wsgi_app(environ, start_response)


# Initialize the Flask WSGI application instance for Vercel
app = create_app()
app.wsgi_app = VercelPathMiddleware(app.wsgi_app)
