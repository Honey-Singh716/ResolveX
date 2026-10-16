"""
Tests for organization and membership API endpoints:
  POST /api/v1/organizations
  GET  /api/v1/organizations
  GET  /api/v1/organizations/{org_id}

Includes cross-tenant isolation tests.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models.organization import Organization

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


# ===========================================================================
# PAGINATION TESTS
# ===========================================================================


class TestListOrganizationsPagination:
    def test_pagination_defaults_and_metadata(self, client: TestClient):
        token = _register_and_token(client, USER_A)
        # Create 3 orgs
        for i in range(3):
            client.post(
                ORGS_URL,
                json={"name": f"Org Number {i}"},
                headers=_auth_headers(token),
            )

        r = client.get(ORGS_URL, headers=_auth_headers(token))
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 3
        assert data["page"] == 1
        assert data["page_size"] == 20
        assert len(data["organizations"]) == 3

    def test_pagination_custom_page_and_size(self, client: TestClient):
        token = _register_and_token(client, USER_A)
        for i in range(5):
            client.post(
                ORGS_URL,
                json={"name": f"Paged Org {i:02d}"},
                headers=_auth_headers(token),
            )

        # Request page 2 with page_size=2
        r = client.get(f"{ORGS_URL}?page=2&page_size=2", headers=_auth_headers(token))
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 5
        assert data["page"] == 2
        assert data["page_size"] == 2
        assert len(data["organizations"]) == 2


# ===========================================================================
# MEMBER LISTING TESTS
# ===========================================================================


class TestListMembers:
    def test_owner_can_list_members(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        r = client.get(f"{ORGS_URL}/{org_id}/members", headers=_auth_headers(token_a))
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 1
        assert data["members"][0]["email"] == USER_A["email"]
        assert data["members"][0]["role"] == "owner"

    def test_member_can_list_members(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        # Owner adds user B
        client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "member"},
            headers=_auth_headers(token_a),
        )

        # User B lists members
        r = client.get(f"{ORGS_URL}/{org_id}/members", headers=_auth_headers(token_b))
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 2

    def test_non_member_cannot_list_members_returns_403(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        # User B is not a member of Org A
        r = client.get(f"{ORGS_URL}/{org_id}/members", headers=_auth_headers(token_b))
        assert r.status_code == 403

    def test_unauthenticated_cannot_list_members_returns_401(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        r = client.get(f"{ORGS_URL}/{org_id}/members")
        assert r.status_code == 401

    def test_list_members_nonexistent_org_returns_404(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        fake_id = "00000000-0000-0000-0000-000000000099"
        r = client.get(f"{ORGS_URL}/{fake_id}/members", headers=_auth_headers(token_a))
        assert r.status_code == 404


# ===========================================================================
# ADD MEMBER TESTS (Privilege Escalation, Validation, Isolation)
# ===========================================================================


class TestAddMember:
    def test_owner_can_add_member(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        _register_and_token(client, USER_B)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        r = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "member"},
            headers=_auth_headers(token_a),
        )
        assert r.status_code == 201
        data = r.json()
        assert data["email"] == USER_B["email"]
        assert data["role"] == "member"
        assert data["organization_id"] == org_id

    def test_owner_can_add_admin_and_another_owner(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        _register_and_token(client, USER_B)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        r = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "owner"},
            headers=_auth_headers(token_a),
        )
        assert r.status_code == 201
        assert r.json()["role"] == "owner"

    def test_admin_can_add_regular_member(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)
        user_c = {"email": "user-c@example.com", "full_name": "User C", "password": "SecurePassC123!"}
        _register_and_token(client, user_c)

        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        # Owner adds B as admin
        client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "admin"},
            headers=_auth_headers(token_a),
        )

        # Admin B adds User C as staff
        r = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": user_c["email"], "role": "staff"},
            headers=_auth_headers(token_b),
        )
        assert r.status_code == 201
        assert r.json()["role"] == "staff"

    def test_admin_cannot_add_owner_returns_403(self, client: TestClient):
        """Privilege escalation prevention: admin cannot create an owner."""
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)
        user_c = {"email": "user-c@example.com", "full_name": "User C", "password": "SecurePassC123!"}
        _register_and_token(client, user_c)

        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        # Owner adds B as admin
        client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "admin"},
            headers=_auth_headers(token_a),
        )

        # Admin B attempts to add User C as owner -> MUST be 403
        r = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": user_c["email"], "role": "owner"},
            headers=_auth_headers(token_b),
        )
        assert r.status_code == 403

    def test_admin_cannot_add_admin_returns_403(self, client: TestClient):
        """Privilege escalation prevention: admin cannot create another admin."""
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)
        user_c = {"email": "user-c@example.com", "full_name": "User C", "password": "SecurePassC123!"}
        _register_and_token(client, user_c)

        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "admin"},
            headers=_auth_headers(token_a),
        )

        r = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": user_c["email"], "role": "admin"},
            headers=_auth_headers(token_b),
        )
        assert r.status_code == 403

    def test_regular_member_cannot_add_member_returns_403(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)
        user_c = {"email": "user-c@example.com", "full_name": "User C", "password": "SecurePassC123!"}
        _register_and_token(client, user_c)

        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        # Owner adds B as regular member
        client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "member"},
            headers=_auth_headers(token_a),
        )

        # Member B attempts to add member C -> 403
        r = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": user_c["email"], "role": "member"},
            headers=_auth_headers(token_b),
        )
        assert r.status_code == 403

    def test_add_already_existing_member_returns_409(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        _register_and_token(client, USER_B)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        # First add succeeds
        r1 = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "member"},
            headers=_auth_headers(token_a),
        )
        assert r1.status_code == 201

        # Second add for same user returns 409
        r2 = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "member"},
            headers=_auth_headers(token_a),
        )
        assert r2.status_code == 409

    def test_add_nonexistent_user_email_returns_404(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        r = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": "nonexistent@example.com", "role": "member"},
            headers=_auth_headers(token_a),
        )
        assert r.status_code == 404

    def test_add_invalid_role_returns_422(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        _register_and_token(client, USER_B)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        r = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "superadmin"},
            headers=_auth_headers(token_a),
        )
        assert r.status_code == 422

    def test_cross_tenant_add_member_returns_403(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)
        user_c = {"email": "user-c@example.com", "full_name": "User C", "password": "SecurePassC123!"}
        _register_and_token(client, user_c)

        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        # User B attempts to add User C to Org A -> 403
        r = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": user_c["email"], "role": "member"},
            headers=_auth_headers(token_b),
        )
        assert r.status_code == 403


# ===========================================================================
# UPDATE MEMBER ROLE TESTS (Owner protections, escalation)
# ===========================================================================


class TestUpdateMemberRole:
    def test_owner_can_update_member_role(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        _register_and_token(client, USER_B)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        r_add = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "member"},
            headers=_auth_headers(token_a),
        )
        member_id = r_add.json()["id"]

        r_patch = client.patch(
            f"{ORGS_URL}/{org_id}/members/{member_id}",
            json={"role": "manager"},
            headers=_auth_headers(token_a),
        )
        assert r_patch.status_code == 200
        assert r_patch.json()["role"] == "manager"

    def test_owner_cannot_demote_last_owner_returns_400(self, client: TestClient):
        """Critical owner protection: Cannot demote the last owner of an org."""
        token_a = _register_and_token(client, USER_A)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        # Get own membership ID
        r_members = client.get(f"{ORGS_URL}/{org_id}/members", headers=_auth_headers(token_a))
        own_member_id = r_members.json()["members"][0]["id"]

        # Attempt to demote self (only owner) to admin
        r = client.patch(
            f"{ORGS_URL}/{org_id}/members/{own_member_id}",
            json={"role": "admin"},
            headers=_auth_headers(token_a),
        )
        assert r.status_code == 400
        assert "last owner" in r.json()["detail"].lower()

    def test_owner_can_demote_owner_when_multiple_owners_exist(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        _register_and_token(client, USER_B)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        # Add B as second owner
        r_add = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "owner"},
            headers=_auth_headers(token_a),
        )
        b_member_id = r_add.json()["id"]

        # Now demote B to admin — should succeed because User A is still an owner
        r = client.patch(
            f"{ORGS_URL}/{org_id}/members/{b_member_id}",
            json={"role": "admin"},
            headers=_auth_headers(token_a),
        )
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_admin_cannot_modify_owner_returns_403(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        # Owner adds B as admin
        client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "admin"},
            headers=_auth_headers(token_a),
        )

        # Get Owner A's membership id
        r_members = client.get(f"{ORGS_URL}/{org_id}/members", headers=_auth_headers(token_a))
        owner_member_id = [m["id"] for m in r_members.json()["members"] if m["role"] == "owner"][0]

        # Admin B tries to demote Owner A -> 403
        r = client.patch(
            f"{ORGS_URL}/{org_id}/members/{owner_member_id}",
            json={"role": "member"},
            headers=_auth_headers(token_b),
        )
        assert r.status_code == 403

    def test_admin_cannot_promote_to_owner_returns_403(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)
        user_c = {"email": "user-c@example.com", "full_name": "User C", "password": "SecurePassC123!"}
        _register_and_token(client, user_c)

        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        # Add B as admin, C as member
        client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "admin"},
            headers=_auth_headers(token_a),
        )
        r_c = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": user_c["email"], "role": "member"},
            headers=_auth_headers(token_a),
        )
        c_member_id = r_c.json()["id"]

        # Admin B tries to promote C to owner -> 403
        r = client.patch(
            f"{ORGS_URL}/{org_id}/members/{c_member_id}",
            json={"role": "owner"},
            headers=_auth_headers(token_b),
        )
        assert r.status_code == 403

    def test_member_cannot_update_roles_returns_403(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        r_b = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "member"},
            headers=_auth_headers(token_a),
        )
        b_member_id = r_b.json()["id"]

        # Member B tries to promote self to owner -> 403
        r = client.patch(
            f"{ORGS_URL}/{org_id}/members/{b_member_id}",
            json={"role": "owner"},
            headers=_auth_headers(token_b),
        )
        assert r.status_code == 403


# ===========================================================================
# REMOVE MEMBER TESTS (Owner protections, self-leave, isolation)
# ===========================================================================


class TestRemoveMember:
    def test_owner_can_remove_member(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        _register_and_token(client, USER_B)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        r_add = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "member"},
            headers=_auth_headers(token_a),
        )
        b_member_id = r_add.json()["id"]

        r_del = client.delete(
            f"{ORGS_URL}/{org_id}/members/{b_member_id}",
            headers=_auth_headers(token_a),
        )
        assert r_del.status_code == 204

        # Verify member count is now 1
        r_members = client.get(f"{ORGS_URL}/{org_id}/members", headers=_auth_headers(token_a))
        assert r_members.json()["total"] == 1

    def test_member_can_leave_organization(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        r_add = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "member"},
            headers=_auth_headers(token_a),
        )
        b_member_id = r_add.json()["id"]

        # User B leaves
        r_leave = client.delete(
            f"{ORGS_URL}/{org_id}/members/{b_member_id}",
            headers=_auth_headers(token_b),
        )
        assert r_leave.status_code == 204

    def test_last_owner_cannot_leave_returns_400(self, client: TestClient):
        """Owner protection: The sole owner cannot leave."""
        token_a = _register_and_token(client, USER_A)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        r_members = client.get(f"{ORGS_URL}/{org_id}/members", headers=_auth_headers(token_a))
        own_id = r_members.json()["members"][0]["id"]

        r = client.delete(
            f"{ORGS_URL}/{org_id}/members/{own_id}",
            headers=_auth_headers(token_a),
        )
        assert r.status_code == 400
        assert "last owner" in r.json()["detail"].lower()

    def test_owner_can_leave_when_another_owner_exists(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        _register_and_token(client, USER_B)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        # Add B as owner
        client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "owner"},
            headers=_auth_headers(token_a),
        )

        r_members = client.get(f"{ORGS_URL}/{org_id}/members", headers=_auth_headers(token_a))
        a_id = [m["id"] for m in r_members.json()["members"] if m["email"] == USER_A["email"]][0]

        # Owner A leaves
        r = client.delete(
            f"{ORGS_URL}/{org_id}/members/{a_id}",
            headers=_auth_headers(token_a),
        )
        assert r.status_code == 204

    def test_admin_cannot_remove_owner_returns_403(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        # Add B as admin
        client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "admin"},
            headers=_auth_headers(token_a),
        )

        r_members = client.get(f"{ORGS_URL}/{org_id}/members", headers=_auth_headers(token_a))
        owner_id = [m["id"] for m in r_members.json()["members"] if m["role"] == "owner"][0]

        # Admin B tries to remove Owner A -> 403
        r = client.delete(
            f"{ORGS_URL}/{org_id}/members/{owner_id}",
            headers=_auth_headers(token_b),
        )
        assert r.status_code == 403

    def test_regular_member_cannot_remove_other_member_returns_403(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)
        user_c = {"email": "user-c@example.com", "full_name": "User C", "password": "SecurePassC123!"}
        _register_and_token(client, user_c)

        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        # Add B and C as members
        client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "member"},
            headers=_auth_headers(token_a),
        )
        r_c = client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": user_c["email"], "role": "member"},
            headers=_auth_headers(token_a),
        )
        c_id = r_c.json()["id"]

        # Member B tries to remove Member C -> 403
        r = client.delete(
            f"{ORGS_URL}/{org_id}/members/{c_id}",
            headers=_auth_headers(token_b),
        )
        assert r.status_code == 403

    def test_cross_tenant_remove_member_returns_403(self, client: TestClient):
        token_a = _register_and_token(client, USER_A)
        token_b = _register_and_token(client, USER_B)
        r_create = client.post(ORGS_URL, json=ORG_A_PAYLOAD, headers=_auth_headers(token_a))
        org_id = r_create.json()["id"]

        r_members = client.get(f"{ORGS_URL}/{org_id}/members", headers=_auth_headers(token_a))
        a_id = r_members.json()["members"][0]["id"]

        # User B (not in Org A) tries to remove Member A -> 403
        r = client.delete(
            f"{ORGS_URL}/{org_id}/members/{a_id}",
            headers=_auth_headers(token_b),
        )
        assert r.status_code == 403


class TestOrganizationLifecycle:
    def test_owner_transfer_requires_member_acceptance(self, client: TestClient):
        owner_token = _register_and_token(client, USER_A)
        member_token = _register_and_token(client, USER_B)
        org_id = client.post(
            ORGS_URL,
            json=ORG_A_PAYLOAD,
            headers=_auth_headers(owner_token),
        ).json()["id"]
        client.post(
            f"{ORGS_URL}/{org_id}/members",
            json={"email": USER_B["email"], "role": "member"},
            headers=_auth_headers(owner_token),
        )
        member_id = next(
            member["user_id"]
            for member in client.get(
            f"{ORGS_URL}/{org_id}/members",
            headers=_auth_headers(member_token),
            ).json()["members"]
            if member["email"] == USER_B["email"]
        )

        offered = client.post(
            f"{ORGS_URL}/{org_id}/ownership-transfer",
            json={"target_user_id": member_id},
            headers=_auth_headers(owner_token),
        )
        assert offered.status_code == 200
        accepted = client.post(
            f"{ORGS_URL}/{org_id}/ownership-transfer/accept",
            headers=_auth_headers(member_token),
        )
        assert accepted.status_code == 200
        assert accepted.json()["role"] == "owner"

    def test_deletion_request_can_be_cancelled_and_archive_is_non_destructive(
        self,
        client: TestClient,
        db: Session,
    ):
        owner_token = _register_and_token(client, USER_A)
        org_id = client.post(
            ORGS_URL,
            json=ORG_A_PAYLOAD,
            headers=_auth_headers(owner_token),
        ).json()["id"]
        scheduled = client.post(
            f"{ORGS_URL}/{org_id}/deletion-request",
            headers=_auth_headers(owner_token),
        )
        assert scheduled.status_code == 200
        assert scheduled.json()["scheduled_for"] is not None
        cancelled = client.delete(
            f"{ORGS_URL}/{org_id}/deletion-request",
            headers=_auth_headers(owner_token),
        )
        assert cancelled.status_code == 200
        assert cancelled.json()["scheduled_for"] is None

        # Reschedule, expire the grace period in the isolated DB, then archive.
        client.post(
            f"{ORGS_URL}/{org_id}/deletion-request",
            headers=_auth_headers(owner_token),
        )
        org = db.get(Organization, uuid.UUID(org_id))
        assert org is not None
        org.deletion_scheduled_for = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
        archived = client.post(
            f"{ORGS_URL}/{org_id}/archive",
            headers=_auth_headers(owner_token),
        )
        assert archived.status_code == 200
        assert archived.json()["archived_at"] is not None
        assert db.get(Organization, uuid.UUID(org_id)).is_active is False
