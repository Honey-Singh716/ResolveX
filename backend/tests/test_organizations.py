"""
Tests for organization and membership API endpoints:
  POST /api/v1/organizations
  GET  /api/v1/organizations
  GET  /api/v1/organizations/{org_id}

Includes cross-tenant isolation tests.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ORGS_URL = "/api/v1/organizations"

USER_A = {
    "email": "tenant-a@example.com",
    "full_name": "Tenant A User",
    "password": "SecurePassA123!",
}

USER_B = {
    "email": "tenant-b@example.com",
    "full_name": "Tenant B User",
    "password": "SecurePassB123!",
}

ORG_A_PAYLOAD = {
    "name": "Acme University",
    "industry": "education",
}

ORG_B_PAYLOAD = {
    "name": "Beacon Library",
    "industry": "library",
}


def _register_and_token(client: TestClient, user: dict) -> str:
    r = client.post(REGISTER_URL, json=user)
    assert r.status_code == 201, r.text
    r = client.post(LOGIN_URL, json={"email": user["email"], "password": user["password"]})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ===========================================================================
# CREATE ORGANIZATION
# ===========================================================================


class TestCreateOrganization:
    def test_create_org_authenticated_returns_201(self, client: TestClient):
        token = _register_and_token(client, USER_A)
        r = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token))
        assert r.status_code == 201

    def test_create_org_response_fields(self, client: TestClient):
        token = _register_and_token(client, USER_A)
        r = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token))
        data = r.json()
        assert data["name"] == "Acme University"
        assert data["industry"] == "education"
        assert data["is_active"] is True
        assert data["role"] == "owner"
        assert "id" in data
        assert "slug" in data

    def test_creator_becomes_owner(self, client: TestClient):
        token = _register_and_token(client, USER_A)
        r = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token))
        assert r.json()["role"] == "owner"

    def test_slug_auto_generated_from_name(self, client: TestClient):
        token = _register_and_token(client, USER_A)
        r = client.post(ORGS_URL, json={"name": "Hello World Org"}, headers=_auth_headers(token))
        assert r.status_code == 201
        assert r.json()["slug"] == "hello-world-org"

    def test_explicit_slug_accepted(self, client: TestClient):
        token = _register_and_token(client, USER_A)
        r = client.post(
            ORGS_URL,
            json={"name": "Test Org", "slug": "my-custom-slug"},
            headers=_auth_headers(token),
        )
        assert r.status_code == 201
        assert r.json()["slug"] == "my-custom-slug"

    def test_duplicate_slug_returns_409(self, client: TestClient):
        token = _register_and_token(client, USER_A)
        client.post(
            ORGS_URL,
            json={"name": "First Org", "slug": "same-slug"},
            headers=_auth_headers(token),
        )
        r = client.post(
            ORGS_URL,
            json={"name": "Second Org", "slug": "same-slug"},
            headers=_auth_headers(token),
        )
        assert r.status_code == 409

    def test_unauthenticated_create_returns_401(self, client: TestClient):
        r = client.post(ORGS_URL, json=ORG_A_PAYLOAD)
        assert r.status_code == 401

    def test_missing_name_returns_422(self, client: TestClient):
        token = _register_and_token(client, USER_A)
        r = client.post(ORGS_URL, json={}, headers=_auth_headers(token))
        assert r.status_code == 422

    def test_name_too_short_returns_422(self, client: TestClient):
        token = _register_and_token(client, USER_A)
        r = client.post(ORGS_URL, json={"name": "X"}, headers=_auth_headers(token))
        assert r.status_code == 422

    def test_invalid_slug_chars_returns_422(self, client: TestClient):
        token = _register_and_token(client, USER_A)
        r = client.post(
            ORGS_URL,
            json={"name": "Test", "slug": "BAD SLUG!"},
            headers=_auth_headers(token),
        )
        assert r.status_code == 422


# ===========================================================================
# LIST ORGANIZATIONS
# ===========================================================================


class TestListOrganizations:
    def test_list_returns_own_orgs_only(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)

        # User A creates an org
        client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        # User B creates a different org
        client.post(ORGS_URL, json=ORG_B_PAYLOAD, headers=_auth_headers(token_b))

        r_a = client.get(ORGS_URL, headers=_auth_headers(token_a))
        assert r_a.status_code == 200
        data_a = r_a.json()
        assert data_a["total"] == 1
        assert data_a["organizations"][0]["name"] == "Acme University"

    def test_list_empty_for_new_user(self, client: TestClient):
        token = _register_and_token(client, USER_A)
        r = client.get(ORGS_URL, headers=_auth_headers(token))
        assert r.status_code == 200
        assert r.json()["total"] == 0

    def test_list_unauthenticated_returns_401(self, client: TestClient):
        r = client.get(ORGS_URL)
        assert r.status_code == 401

    def test_list_includes_role_field(self, client: TestClient):
        token = _register_and_token(client, USER_A)
        client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token))
        r = client.get(ORGS_URL, headers=_auth_headers(token))
        org = r.json()["organizations"][0]
        assert org["role"] == "owner"

    def test_user_b_cannot_see_user_a_org(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)

        client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))

        r = client.get(ORGS_URL, headers=_auth_headers(token_b))
        assert r.status_code == 200
        assert r.json()["total"] == 0  # Cross-tenant isolation verified


# ===========================================================================
# GET SINGLE ORGANIZATION — Cross-tenant isolation
# ===========================================================================


class TestGetOrganization:
    def test_owner_can_read_own_org(self, client: TestClient):
        token = _register_and_token(client, USER_A)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token))
        org_id = r_create.json()["id"]

        r = client.get(f"{ORGS_URL}/{org_id}", headers=_auth_headers(token))
        assert r.status_code == 200
        assert r.json()["id"] == org_id

    def test_nonmember_cannot_read_org_returns_403(self, client: TestClient):
        """
        CRITICAL: User B must not be able to read User A's organization even
        if they know the org_id.  Backend must enforce this, not just hide it.
        """
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)

        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        # User B tries to access User A's org directly by ID
        r = client.get(f"{ORGS_URL}/{org_id}", headers=_auth_headers(token_b))
        assert r.status_code == 403, (
            f"Expected 403 (cross-tenant isolation), got {r.status_code}: {r.text}"
        )

    def test_unauthenticated_returns_401(self, client: TestClient):
        token = _register_and_token(client, USER_A)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token))
        org_id = r_create.json()["id"]

        r = client.get(f"{ORGS_URL}/{org_id}")
        assert r.status_code == 401

    def test_nonexistent_org_returns_404(self, client: TestClient):
        token = _register_and_token(client, USER_A)
        fake_id = "00000000-0000-0000-0000-000000000099"
        r = client.get(f"{ORGS_URL}/{fake_id}", headers=_auth_headers(token))
        assert r.status_code == 404

    def test_multiple_users_each_see_only_their_orgs(self, client: TestClient):
        """
        Regression test: ensure the list endpoint never leaks cross-tenant data
        even when multiple users and multiple orgs exist in the same database.
        """
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)

        client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        client.post(ORGS_URL, json=ORG_B_PAYLOAD, headers=_auth_headers(token_b))
        # Give User A a second org
        client.post(ORGS_URL, json={"name": "Second Acme"}, headers=_auth_headers(token_a))

        r_a = client.get(ORGS_URL, headers=_auth_headers(token_a))
        r_b = client.get(ORGS_URL, headers=_auth_headers(token_b))

        org_names_a = {o["name"] for o in r_a.json()["organizations"]}
        org_names_b = {o["name"] for o in r_b.json()["organizations"]}

        assert org_names_a == {"Acme University", "Second Acme"}
        assert org_names_b == {"Beacon Library"}
        # No overlap
        assert org_names_a.isdisjoint(org_names_b)
