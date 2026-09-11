import os
from dotenv import load_dotenv

load_dotenv()


class BaseConfig:
    """Base configuration for NoteForge."""
    SECRET_KEY = os.environ.get("SECRET_KEY", "noteforge-dev-secret-key-change-in-prod-482910")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MISTUNE_ESCAPE_HTML = False
    PAGINATION_PER_PAGE = 20

    # Ensure postgresql:// schema
    _raw_db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/noteforge"
    )
    if _raw_db_url and _raw_db_url.startswith("postgres://"):
        _raw_db_url = _raw_db_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI = _raw_db_url


class DevelopmentConfig(BaseConfig):
    """Development configuration."""
    DEBUG = True
    ENV = "development"


class StagingConfig(BaseConfig):
    """Staging configuration."""
    DEBUG = False
    TESTING = False
    ENV = "staging"


class ProductionConfig(BaseConfig):
    """Production configuration."""
    DEBUG = False
    TESTING = False
    ENV = "production"


class TestingConfig(BaseConfig):
    """Testing configuration."""
    TESTING = True
    DEBUG = True
    # If a test database url is provided, use it; otherwise sqlite in-memory
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "TEST_DATABASE_URL",
        "sqlite:///:memory:"
    )


config_by_name = {
    "development": DevelopmentConfig,
    "staging": StagingConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
    "default": DevelopmentConfig,
}
