"""
Test configuration and fixtures for ResolveX backend tests.

Uses an isolated SQLite in-memory database so tests never touch
the production Neon PostgreSQL database.  StaticPool ensures every
connection (including the TestClient's request thread) shares the
exact same in-memory database instance.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app

# ---------------------------------------------------------------------------
# SQLite in-memory test engine with StaticPool
# ---------------------------------------------------------------------------
# StaticPool means *every* call to engine.connect() returns the same
# underlying DBAPI connection.  This is required for SQLite "sqlite://"
# (pure in-memory) databases: without it, the TestClient's background thread
# opens a new connection and sees an empty database because in-memory DBs are
# per-connection.
#
# check_same_thread=False is required because SQLAlchemy will use the
# connection from the thread that created the pool AND from the TestClient
# worker thread.

_test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(_test_engine, "connect")
def _enable_sqlite_fk(dbapi_connection, connection_record):
    """Enable FK enforcement in SQLite (disabled by default)."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


_TestSessionLocal = sessionmaker(
    bind=_test_engine,
    class_=Session,
    autoflush=False,
    expire_on_commit=False,
)


# ---------------------------------------------------------------------------
# Pytest fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def db():
    """
    Create the full schema before each test, yield a session, then drop
    everything.  Every test starts with an empty database.
    """
    Base.metadata.create_all(_test_engine)
    session = _TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(_test_engine)


@pytest.fixture(scope="function")
def client(db: Session):
    """
    FastAPI TestClient whose `get_db` dependency is replaced by the
    in-memory SQLite session from the `db` fixture.
    """
    def _override_get_db():
        try:
            yield db
        finally:
            pass  # session lifetime is managed by the `db` fixture

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

