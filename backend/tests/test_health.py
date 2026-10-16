"""
Tests for the /api/v1/health and root endpoints.

These tests use the shared `client` fixture from conftest.py which
provides an isolated SQLite database and overrides the `get_db` dependency.
"""

from fastapi.testclient import TestClient


def test_root_endpoint(client: TestClient):
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["message"] == "Welcome to ResolveX"


def test_health_endpoint(client: TestClient):
    response = client.get("/api/v1/health")

    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ResolveX API"
    assert data["version"] == "0.1.0"
