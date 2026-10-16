"""
Comprehensive authentication tests for:
  POST /api/v1/auth/register
  POST /api/v1/auth/login
  GET  /api/v1/auth/me

All tests run against an isolated SQLite in-memory database; the production
Neon database is never touched.
"""
from __future__ import annotations

import time
from uuid import UUID

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/auth/me"

VALID_USER = {
    "email": "alice@example.com",
    "full_name": "Alice Example",
    "password": "Sup3r$ecretPass!",
}


def register_and_login(client: TestClient, user: dict | None = None) -> str:
    """Register a user, log in, and return the access token."""
    user = user or VALID_USER
    r = client.post(REGISTER_URL, json=user)
    assert r.status_code == 201, r.text
    r = client.post(LOGIN_URL, json={"email": user["email"], "password": user["password"]})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# ===========================================================================
# REGISTRATION
# ===========================================================================


class TestRegistration:
    def test_valid_registration_returns_201(self, client: TestClient):
        r = client.post(REGISTER_URL, json=VALID_USER)
        assert r.status_code == 201

    def test_response_contains_expected_fields(self, client: TestClient):
        r = client.post(REGISTER_URL, json=VALID_USER)
        data = r.json()
        assert "id" in data
        assert data["email"] == "alice@example.com"
        assert data["full_name"] == "Alice Example"
        assert data["is_active"] is True

    def test_password_hash_not_in_response(self, client: TestClient):
        r = client.post(REGISTER_URL, json=VALID_USER)
        body = r.text
        # Neither the plaintext password nor any hash field must leak
        assert VALID_USER["password"] not in body
        assert "password_hash" not in body
        assert "password" not in r.json()

    def test_id_is_valid_uuid(self, client: TestClient):
        r = client.post(REGISTER_URL, json=VALID_USER)
        # This should not raise
        UUID(r.json()["id"])

    def test_email_is_normalized_to_lowercase(self, client: TestClient):
        user = {**VALID_USER, "email": "ALICE@EXAMPLE.COM"}
        r = client.post(REGISTER_URL, json=user)
        assert r.status_code == 201
        assert r.json()["email"] == "alice@example.com"

    def test_duplicate_email_returns_409(self, client: TestClient):
        client.post(REGISTER_URL, json=VALID_USER)
        r = client.post(REGISTER_URL, json=VALID_USER)
        assert r.status_code == 409

    def test_duplicate_email_case_insensitive_returns_409(self, client: TestClient):
        client.post(REGISTER_URL, json=VALID_USER)
        upper = {**VALID_USER, "email": "ALICE@EXAMPLE.COM"}
        r = client.post(REGISTER_URL, json=upper)
        assert r.status_code == 409

    def test_invalid_email_returns_422(self, client: TestClient):
        r = client.post(REGISTER_URL, json={**VALID_USER, "email": "not-an-email"})
        assert r.status_code == 422

    def test_short_password_returns_422(self, client: TestClient):
        r = client.post(REGISTER_URL, json={**VALID_USER, "password": "short"})
        assert r.status_code == 422

    def test_password_under_12_chars_returns_422(self, client: TestClient):
        r = client.post(REGISTER_URL, json={**VALID_USER, "password": "11charpassw"})
        assert r.status_code == 422

    def test_password_exactly_12_chars_accepted(self, client: TestClient):
        r = client.post(REGISTER_URL, json={**VALID_USER, "password": "exactly12chr"})
        assert r.status_code == 201

    def test_missing_full_name_returns_422(self, client: TestClient):
        r = client.post(REGISTER_URL, json={"email": VALID_USER["email"], "password": VALID_USER["password"]})
        assert r.status_code == 422

    def test_full_name_too_short_returns_422(self, client: TestClient):
        r = client.post(REGISTER_URL, json={**VALID_USER, "full_name": "X"})
        assert r.status_code == 422

    def test_empty_body_returns_422(self, client: TestClient):
        r = client.post(REGISTER_URL, json={})
        assert r.status_code == 422


# ===========================================================================
# LOGIN
# ===========================================================================


class TestLogin:
    def test_correct_credentials_return_200(self, client: TestClient):
        client.post(REGISTER_URL, json=VALID_USER)
        r = client.post(LOGIN_URL, json={"email": VALID_USER["email"], "password": VALID_USER["password"]})
        assert r.status_code == 200

    def test_login_response_contains_access_token(self, client: TestClient):
        client.post(REGISTER_URL, json=VALID_USER)
        r = client.post(LOGIN_URL, json={"email": VALID_USER["email"], "password": VALID_USER["password"]})
        data = r.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data

    def test_access_token_is_valid_jwt(self, client: TestClient):
        client.post(REGISTER_URL, json=VALID_USER)
        r = client.post(LOGIN_URL, json={"email": VALID_USER["email"], "password": VALID_USER["password"]})
        token = r.json()["access_token"]
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=["HS256"],
            options={"require": ["sub", "exp", "iat"]},
        )
        assert "sub" in payload
        # sub should be a valid UUID string
        UUID(payload["sub"])

    def test_wrong_password_returns_401(self, client: TestClient):
        client.post(REGISTER_URL, json=VALID_USER)
        r = client.post(LOGIN_URL, json={"email": VALID_USER["email"], "password": "wrongpassword!"})
        assert r.status_code == 401

    def test_unknown_email_returns_401(self, client: TestClient):
        r = client.post(LOGIN_URL, json={"email": "nobody@example.com", "password": "somepassword!"})
        assert r.status_code == 401

    def test_wrong_password_and_unknown_email_same_error(self, client: TestClient):
        """Ensure the error message doesn't reveal which field was wrong."""
        client.post(REGISTER_URL, json=VALID_USER)
        r_wrong_pw = client.post(LOGIN_URL, json={"email": VALID_USER["email"], "password": "wrongpassword!"})
        r_unknown = client.post(LOGIN_URL, json={"email": "nobody@example.com", "password": "somepassword!"})
        # Both must return 401 with the same detail message
        assert r_wrong_pw.status_code == 401
        assert r_unknown.status_code == 401
        assert r_wrong_pw.json()["detail"] == r_unknown.json()["detail"]

    def test_inactive_user_cannot_login(self, client: TestClient, db):
        from app.db.models.user import User
        from sqlalchemy import select

        client.post(REGISTER_URL, json=VALID_USER)
        # Deactivate user directly via DB
        user = db.scalar(select(User).where(User.email == VALID_USER["email"]))
        user.is_active = False
        db.commit()

        r = client.post(LOGIN_URL, json={"email": VALID_USER["email"], "password": VALID_USER["password"]})
        assert r.status_code == 401

    def test_login_email_case_insensitive(self, client: TestClient):
        client.post(REGISTER_URL, json=VALID_USER)
        r = client.post(LOGIN_URL, json={"email": "ALICE@EXAMPLE.COM", "password": VALID_USER["password"]})
        assert r.status_code == 200

    def test_missing_password_field_returns_422(self, client: TestClient):
        r = client.post(LOGIN_URL, json={"email": VALID_USER["email"]})
        assert r.status_code == 422


# ===========================================================================
# PROTECTED ENDPOINT: GET /api/v1/auth/me
# ===========================================================================


class TestGetMe:
    def test_no_token_returns_401(self, client: TestClient):
        r = client.get(ME_URL)
        assert r.status_code == 401

    def test_valid_token_returns_200_and_correct_user(self, client: TestClient):
        token = register_and_login(client)
        r = client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["email"] == "alice@example.com"

    def test_response_does_not_contain_password(self, client: TestClient):
        token = register_and_login(client)
        r = client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})
        body = r.text
        assert "password_hash" not in body
        assert "password" not in r.json()

    def test_invalid_token_returns_401(self, client: TestClient):
        r = client.get(ME_URL, headers={"Authorization": "Bearer totally.invalid.token"})
        assert r.status_code == 401

    def test_malformed_bearer_header_returns_401(self, client: TestClient):
        r = client.get(ME_URL, headers={"Authorization": "notbearer sometoken"})
        assert r.status_code == 401

    def test_wrong_signature_returns_401(self, client: TestClient):
        """Token signed with a different secret must be rejected."""
        fake_token = jwt.encode(
            {"sub": "00000000-0000-0000-0000-000000000001", "exp": int(time.time()) + 3600, "iat": int(time.time())},
            "completely-wrong-secret-key",
            algorithm="HS256",
        )
        r = client.get(ME_URL, headers={"Authorization": f"Bearer {fake_token}"})
        assert r.status_code == 401

    def test_expired_token_returns_401(self, client: TestClient):
        """An already-expired token must be rejected, not crash."""
        expired_token = jwt.encode(
            {"sub": "00000000-0000-0000-0000-000000000001", "exp": int(time.time()) - 1, "iat": int(time.time()) - 60},
            settings.jwt_secret_key,
            algorithm="HS256",
        )
        r = client.get(ME_URL, headers={"Authorization": f"Bearer {expired_token}"})
        assert r.status_code == 401

    def test_inactive_user_cannot_use_valid_token(self, client: TestClient, db):
        from app.db.models.user import User
        from sqlalchemy import select

        token = register_and_login(client)

        # Deactivate user directly in DB after obtaining token
        user = db.scalar(select(User).where(User.email == VALID_USER["email"]))
        user.is_active = False
        db.commit()

        r = client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401

    def test_nonexistent_user_id_in_token_returns_401(self, client: TestClient):
        """A valid JWT whose `sub` does not correspond to any user returns 401."""
        fake_token = jwt.encode(
            {
                "sub": "00000000-0000-0000-0000-000000000099",
                "exp": int(time.time()) + 3600,
                "iat": int(time.time()),
            },
            settings.jwt_secret_key,
            algorithm="HS256",
        )
        r = client.get(ME_URL, headers={"Authorization": f"Bearer {fake_token}"})
        assert r.status_code == 401
