import os
from dotenv import load_dotenv

load_dotenv()


class BaseConfig:
    """Base configuration for NoteForge."""
    SECRET_KEY = os.environ.get("SECRET_KEY", "noteforge-dev-secret-key-change-in-prod-482910")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MISTUNE_ESCAPE_HTML = False
    PAGINATION_PER_PAGE = 20

    # Resolve database URL from DATABASE_URL or individual environment components
    _raw_db_url = os.environ.get("DATABASE_URL")
    if not _raw_db_url:
        _db_user = os.environ.get("DATABASE_USER", os.environ.get("POSTGRES_USER", "noteforge_user"))
        _db_pwd = os.environ.get("DATABASE_PASSWORD", os.environ.get("POSTGRES_PASSWORD", "noteforge_dev_pwd"))
        _db_host = os.environ.get("DATABASE_HOST", "db")
        _db_port = os.environ.get("DATABASE_PORT", "5432")
        _db_name = os.environ.get("DATABASE_NAME", os.environ.get("POSTGRES_DB", "noteforge"))
        _raw_db_url = f"postgresql://{_db_user}:{_db_pwd}@{_db_host}:{_db_port}/{_db_name}"
    elif _raw_db_url.startswith("postgres://"):
        _raw_db_url = _raw_db_url.replace("postgres://", "postgresql://", 1)

    SQLALCHEMY_DATABASE_URI = _raw_db_url
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }


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
