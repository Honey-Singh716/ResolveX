"""
Tests for the GET /api/v1/health and HEAD /api/v1/health endpoints,
plus the root GET / endpoint.

These tests use the shared `client` fixture from conftest.py which
provides an isolated SQLite database and overrides the `get_db` dependency.

Coverage:
  1.  GET  /api/v1/health  → HTTP 200
  2.  GET  returns expected JSON body
  3.  HEAD /api/v1/health  → HTTP 200
  4.  HEAD returns an empty body (per HTTP semantics)
  5.  HEAD returns the same content-type header as GET
  6.  Both methods are publicly accessible (no auth required)
  7.  Protected auth endpoints still require a token
"""

from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Root endpoint
# ---------------------------------------------------------------------------


def test_root_endpoint(client: TestClient):
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["message"] == "Welcome to ResolveX"


# ---------------------------------------------------------------------------
# GET /api/v1/health
# ---------------------------------------------------------------------------


def test_health_get_returns_200(client: TestClient):
    """GET /api/v1/health must return HTTP 200."""
    response = client.get("/api/v1/health")

    assert response.status_code == 200


def test_health_get_returns_expected_json(client: TestClient):
    """GET /api/v1/health must return the full expected JSON body."""
    response = client.get("/api/v1/health")

    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ResolveX API"
    assert data["version"] == "0.1.0"


def test_health_get_no_auth_required(client: TestClient):
    """GET /api/v1/health must succeed without any Authorization header."""
    response = client.get("/api/v1/health")

    # Must not be 401 or 403 — the endpoint is fully public
    assert response.status_code == 200


def test_health_get_does_not_expose_secrets(client: TestClient):
    """GET response must not contain credential or secret field names."""
    response = client.get("/api/v1/health")
    body = response.text

    for forbidden in ("password", "secret", "database_url", "jwt", "token"):
        assert forbidden not in body.lower(), (
            f"Health response unexpectedly contains sensitive field: '{forbidden}'"
        )


# ---------------------------------------------------------------------------
# HEAD /api/v1/health
# ---------------------------------------------------------------------------


def test_health_head_returns_200(client: TestClient):
    """HEAD /api/v1/health must return HTTP 200 (not 405)."""
    response = client.head("/api/v1/health")

    assert response.status_code == 200


def test_health_head_returns_empty_body(client: TestClient):
    """HEAD /api/v1/health must return an empty body per HTTP semantics."""
    response = client.head("/api/v1/health")

    assert response.status_code == 200
    assert len(response.content) == 0


def test_health_head_no_auth_required(client: TestClient):
    """HEAD /api/v1/health must succeed without any Authorization header."""
    response = client.head("/api/v1/health")

    assert response.status_code == 200


def test_health_head_returns_content_type_header(client: TestClient):
    """HEAD response must carry the same content-type as GET."""
    get_response = client.get("/api/v1/health")
    head_response = client.head("/api/v1/health")

    assert head_response.status_code == 200
    assert head_response.headers.get("content-type") == get_response.headers.get(
        "content-type"
    )


# ---------------------------------------------------------------------------
# Authentication security: protected endpoints still require a token
# ---------------------------------------------------------------------------


def test_protected_auth_me_requires_token(client: TestClient):
    """GET /api/v1/auth/me must return 401 when called without a token."""
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401


def test_health_get_with_bogus_token_still_returns_200(client: TestClient):
    """
    The health endpoint must not fail when an invalid token header is present.
    This confirms the route does not accidentally require authentication.
    """
    response = client.get(
        "/api/v1/health",
        headers={"Authorization": "Bearer totally.invalid.token"},
    )

    assert response.status_code == 200
