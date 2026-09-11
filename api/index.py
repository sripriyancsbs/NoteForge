"""
api/index.py
Vercel Serverless Function entrypoint for NoteForge Flask application.
"""
import os
import sys

# Ensure repository root is on sys.path for module resolution in Vercel runtime
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.app import create_app  # noqa: E402

# Initialize the Flask WSGI application instance for Vercel
app = create_app()
