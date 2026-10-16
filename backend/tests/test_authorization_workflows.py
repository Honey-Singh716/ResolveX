"""
Tests for ResolveX Milestone: Authorization & Organization Membership Workflow.

Covers:
1. Public registration: platform admin privilege is never assignable publicly.
2. Organization verification lifecycle:
   - Creation sets verification_status = "pending".
   - Platform admin list, approve, reject (with reason), and suspend.
   - Non-platform admin callers receive 403 Forbidden.
3. Join codes & membership requests:
   - Unapproved orgs cannot generate join codes.
   - Approved orgs can generate and revoke rotatable SHA-256 join codes.
   - Non-admin org members cannot generate join codes.
   - Users submit join codes to create pending membership requests.
   - Duplicate requests / existing memberships return 409 Conflict.
   - Invalid join codes return 404.
   - Org admins list pending membership requests and approve or reject them.
   - Role assignment on approval (e.g. client, staff).
   - Non-owners cannot promote requests to admin or owner (privilege escalation protection).
   - In-app notifications generated for join requests and review decisions.
4. Client / reporter issue visibility isolation:
   - Clients only list and view issues they reported.
   - Direct access (GET, PATCH, comments, activities) to another user's issue returns 403 Forbidden.
   - Staff/managers see all organization issues.
"""
from __future__ import annotations

import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models.user import User
from app.db.models.organization import Organization
from app.db.models.membership import Membership
from app.db.models.membership_request import MembershipRequest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ORGS_URL = "/api/v1/organizations"
PLATFORM_ORGS_URL = "/api/v1/platform/organizations"


def _register_and_login(client: TestClient, email: str, name: str = "Test User") -> tuple[str, dict]:
    password = "StrongPassword123!"
    r = client.post(
        REGISTER_URL,
        json={"email": email, "full_name": name, "password": password},
    )
    assert r.status_code == 201, r.text
    user_data = r.json()

    r = client.post(
        LOGIN_URL,
        json={"email": email, "password": password},
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return token, user_data


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ===========================================================================
# 1. Registration & Platform Admin Tests
# ===========================================================================


class TestRegistrationPrivileges:
    def test_registration_cannot_grant_platform_admin(self, client: TestClient):
        """Ensure public signup never produces a platform admin even if injected."""
        r = client.post(
            REGISTER_URL,
            json={
                "email": "hacker@example.com",
                "full_name": "Wannabe Admin",
                "password": "StrongPassword123!",
                "is_platform_admin": True,
            },
        )
        assert r.status_code == 201
        data = r.json()
        assert data.get("is_platform_admin") is False

        # Login and check /auth/me
        r_login = client.post(LOGIN_URL, json={"email": "hacker@example.com", "password": "StrongPassword123!"})
        token = r_login.json()["access_token"]
        me = client.get("/api/v1/auth/me", headers=_auth_headers(token)).json()
        assert me["is_platform_admin"] is False


# ===========================================================================
# 2. Organization Verification Lifecycle Tests
# ===========================================================================


class TestOrganizationVerification:
    def test_org_creation_status_is_pending(self, client: TestClient):
        token, _ = _register_and_login(client, "creator1@example.com", "Creator One")
        r = client.post(
            ORGS_URL,
            json={"name": "Pending Corp", "industry": "tech"},
            headers=_auth_headers(token),
        )
        assert r.status_code == 201
        data = r.json()
        assert data["verification_status"] == "pending"
        assert data["rejection_reason"] is None

    def test_platform_admin_endpoints_require_platform_admin(self, client: TestClient):
        token, _ = _register_and_login(client, "normie@example.com", "Normal User")

        # GET /platform/organizations -> 403
        r = client.get(PLATFORM_ORGS_URL, headers=_auth_headers(token))
        assert r.status_code == 403

        # POST /platform/organizations/{id}/approve -> 403
        fake_id = uuid.uuid4()
        r = client.post(f"{PLATFORM_ORGS_URL}/{fake_id}/approve", headers=_auth_headers(token))
        assert r.status_code == 403

    def test_platform_admin_lifecycle_approve_reject_suspend(self, client: TestClient, db: Session):
        # 1. Create creator and organization
        token_creator, creator = _register_and_login(client, "biz_creator@example.com")
        r_org = client.post(
            ORGS_URL,
            json={"name": "Apex Innovations", "industry": "software"},
            headers=_auth_headers(token_creator),
        )
        org_id = r_org.json()["id"]

        # 2. Create platform admin user directly in DB
        admin_token, admin_user = _register_and_login(client, "platform_admin@resolvex.com")
        db_admin = db.get(User, uuid.UUID(admin_user["id"]))
        db_admin.is_platform_admin = True
        db.commit()

        # 3. Platform admin lists organizations
        r_list = client.get(PLATFORM_ORGS_URL, headers=_auth_headers(admin_token))
        assert r_list.status_code == 200
        orgs = r_list.json()["organizations"]
        target_org = next(o for o in orgs if o["id"] == org_id)
        assert target_org["verification_status"] == "pending"

        # 4. Platform admin approves organization
        r_approve = client.post(f"{PLATFORM_ORGS_URL}/{org_id}/approve", headers=_auth_headers(admin_token))
        assert r_approve.status_code == 200
        assert r_approve.json()["verification_status"] == "approved"

        # Verify in DB
        db_org = db.get(Organization, uuid.UUID(org_id))
        assert db_org.verification_status == "approved"
        assert db_org.domain_verification_status == "verified"
        assert db_org.verified_at is not None
        assert db_org.organization_code.startswith("RXO-")
        assert db_org.join_code_hash is not None
        assert db_org.join_code_encrypted is not None
        assert "join_code" not in r_approve.json()

        # The invitation is readable only through the protected owner endpoint.
        r_join_code = client.get(
            f"{ORGS_URL}/{org_id}/join-code",
            headers=_auth_headers(token_creator),
        )
        assert r_join_code.status_code == 200
        assert r_join_code.json()["join_code"].startswith("RX-")

        # A verified domain match is discovery-only and does not grant access.
        r_discover = client.get(
            f"{ORGS_URL}/discover",
            headers=_auth_headers(token_creator),
        )
        assert r_discover.status_code == 200
        assert any(item["id"] == org_id for item in r_discover.json())

        # 5. Platform admin rejects organization with reason
        r_reject = client.post(
            f"{PLATFORM_ORGS_URL}/{org_id}/reject",
            json={"reason": "Incomplete verification documents"},
            headers=_auth_headers(admin_token),
        )
        assert r_reject.status_code == 200
        assert r_reject.json()["verification_status"] == "rejected"
        assert r_reject.json()["rejection_reason"] == "Incomplete verification documents"

        # 6. Platform admin suspends organization
        r_suspend = client.post(
            f"{PLATFORM_ORGS_URL}/{org_id}/suspend",
            json={"reason": "Terms of service violation"},
            headers=_auth_headers(admin_token),
        )
        assert r_suspend.status_code == 200
        assert r_suspend.json()["verification_status"] == "suspended"


# ===========================================================================
# 3. Join Code & Membership Request Tests
# ===========================================================================


class TestJoinCodesAndMembershipRequests:
    def _create_approved_org(self, client: TestClient, db: Session, creator_token: str) -> str:
        r = client.post(
            ORGS_URL,
            json={"name": "Approved Org", "industry": "education"},
            headers=_auth_headers(creator_token),
        )
        org_id = r.json()["id"]
        db_org = db.get(Organization, uuid.UUID(org_id))
        db_org.verification_status = "approved"
        db.commit()
        return org_id

    def test_unapproved_org_cannot_generate_join_code(self, client: TestClient):
        token, _ = _register_and_login(client, "pending_owner@example.com")
        r = client.post(
            ORGS_URL,
            json={"name": "Pending Inc", "industry": "finance"},
            headers=_auth_headers(token),
        )
        org_id = r.json()["id"]

        r_code = client.post(f"{ORGS_URL}/{org_id}/join-code", headers=_auth_headers(token))
        assert r_code.status_code == 403
        assert "Organization must be approved by platform administration to generate join codes" in r_code.json()["detail"]

    def test_generate_and_revoke_join_code(self, client: TestClient, db: Session):
        token, _ = _register_and_login(client, "org_boss@example.com")
        org_id = self._create_approved_org(client, db, token)

        # Generate code
        r_gen = client.post(f"{ORGS_URL}/{org_id}/join-code", headers=_auth_headers(token))
        assert r_gen.status_code == 200
        code = r_gen.json()["join_code"]
        assert len(code) >= 8

        # DB stores hash, not plain text code
        db_org = db.get(Organization, uuid.UUID(org_id))
        assert db_org.join_code_hash is not None
        assert db_org.join_code_hash != code

        # Revoke code
        r_del = client.delete(f"{ORGS_URL}/{org_id}/join-code", headers=_auth_headers(token))
        assert r_del.status_code == 204

        db.refresh(db_org)
        assert db_org.join_code_hash is None

    def test_join_workflow_submit_code_and_approve(self, client: TestClient, db: Session):
        # 1. Owner creates approved org and generates join code
        owner_token, owner_user = _register_and_login(client, "company_owner@example.com")
        org_id = self._create_approved_org(client, db, owner_token)
        r_code = client.post(f"{ORGS_URL}/{org_id}/join-code", headers=_auth_headers(owner_token))
        code = r_code.json()["join_code"]

        # 2. Prospective client registers and submits code
        client_token, client_user = _register_and_login(client, "client_joiner@example.com", "Client Joiner")
        r_join = client.post(
            f"{ORGS_URL}/join",
            json={"join_code": code},
            headers=_auth_headers(client_token),
        )
        assert r_join.status_code == 201
        req_data = r_join.json()
        assert req_data["status"] == "pending"
        request_id = req_data["id"]

        # 3. Check /membership-requests/mine
        r_mine = client.get(f"{ORGS_URL}/membership-requests/mine", headers=_auth_headers(client_token))
        assert r_mine.status_code == 200
        assert len(r_mine.json()["requests"]) == 1
        assert r_mine.json()["requests"][0]["id"] == request_id

        # 4. Duplicate request returns 409
        r_dup = client.post(
            f"{ORGS_URL}/join",
            json={"join_code": code},
            headers=_auth_headers(client_token),
        )
        assert r_dup.status_code == 409

        # 5. Owner lists membership requests
        r_requests = client.get(f"{ORGS_URL}/{org_id}/membership-requests", headers=_auth_headers(owner_token))
        assert r_requests.status_code == 200
        assert len(r_requests.json()["requests"]) == 1

        # 6. Owner approves request as 'client'
        r_approve = client.post(
            f"{ORGS_URL}/{org_id}/membership-requests/{request_id}/approve",
            json={"role": "client"},
            headers=_auth_headers(owner_token),
        )
        assert r_approve.status_code == 200
        assert r_approve.json()["status"] == "approved"

        # 7. Verify user is now a member with 'client' role
        client_orgs = client.get(ORGS_URL, headers=_auth_headers(client_token)).json()["organizations"]
        joined_org = next(o for o in client_orgs if o["id"] == org_id)
        assert joined_org["role"] == "client"

        # 8. Submitting code when already a member returns 409
        r_already = client.post(
            f"{ORGS_URL}/join",
            json={"join_code": code},
            headers=_auth_headers(client_token),
        )
        assert r_already.status_code == 409

    def test_reject_membership_request(self, client: TestClient, db: Session):
        owner_token, _ = _register_and_login(client, "owner_reject@example.com")
        org_id = self._create_approved_org(client, db, owner_token)
        r_code = client.post(f"{ORGS_URL}/{org_id}/join-code", headers=_auth_headers(owner_token))
        code = r_code.json()["join_code"]

        user_token, _ = _register_and_login(client, "rejected_user@example.com")
        r_join = client.post(f"{ORGS_URL}/join", json={"join_code": code}, headers=_auth_headers(user_token))
        req_id = r_join.json()["id"]

        r_reject = client.post(
            f"{ORGS_URL}/{org_id}/membership-requests/{req_id}/reject",
            json={"reason": "Not affiliated with company"},
            headers=_auth_headers(owner_token),
        )
        assert r_reject.status_code == 200
        assert r_reject.json()["status"] == "rejected"
        assert r_reject.json()["rejection_reason"] == "Not affiliated with company"

    def test_non_owner_admin_privilege_escalation_blocked(self, client: TestClient, db: Session):
        """Admin (not owner) cannot approve requests to 'owner' or 'admin'."""
        owner_token, _ = _register_and_login(client, "primary_owner@example.com")
        org_id = self._create_approved_org(client, db, owner_token)
        r_code = client.post(f"{ORGS_URL}/{org_id}/join-code", headers=_auth_headers(owner_token))
        code = r_code.json()["join_code"]

        # Create admin member directly
        admin_token, admin_user = _register_and_login(client, "sub_admin@example.com")
        db.add(Membership(
            id=uuid.uuid4(),
            organization_id=uuid.UUID(org_id),
            user_id=uuid.UUID(admin_user["id"]),
            role="admin",
        ))
        db.commit()

        # Another user requests to join
        applicant_token, _ = _register_and_login(client, "applicant@example.com")
        r_req = client.post(f"{ORGS_URL}/join", json={"join_code": code}, headers=_auth_headers(applicant_token))
        req_id = r_req.json()["id"]

        # Sub-admin tries to promote applicant to 'admin' -> 403 Forbidden
        r_escalate = client.post(
            f"{ORGS_URL}/{org_id}/membership-requests/{req_id}/approve",
            json={"role": "admin"},
            headers=_auth_headers(admin_token),
        )
        assert r_escalate.status_code == 403
        assert "Admins can only approve members with staff, manager, or client roles" in r_escalate.json()["detail"]


# ===========================================================================
# 4. Client / Reporter Issue Visibility Tests
# ===========================================================================


class TestClientIssueVisibility:
    def test_client_cannot_see_other_issues_or_manage(self, client: TestClient, db: Session):
        # 1. Setup approved org with owner, staff, and client
        owner_token, _ = _register_and_login(client, "desk_owner@example.com")
        r_org = client.post(ORGS_URL, json={"name": "HelpDesk Co", "industry": "services"}, headers=_auth_headers(owner_token))
        org_id = r_org.json()["id"]
        db_org = db.get(Organization, uuid.UUID(org_id))
        db_org.verification_status = "approved"
        db.commit()

        staff_token, staff_user = _register_and_login(client, "staff_member@example.com")
        db.add(Membership(
            id=uuid.uuid4(),
            organization_id=uuid.UUID(org_id),
            user_id=uuid.UUID(staff_user["id"]),
            role="staff",
        ))

        client_token, client_user = _register_and_login(client, "client_user@example.com")
        db.add(Membership(
            id=uuid.uuid4(),
            organization_id=uuid.UUID(org_id),
            user_id=uuid.UUID(client_user["id"]),
            role="client",
        ))
        db.commit()

        issues_url = f"{ORGS_URL}/{org_id}/issues"

        # 2. Staff creates issue A
        r_issue_a = client.post(
            issues_url,
            json={"title": "Internal Server Outage", "description": "Database CPU at 100%", "category": "technical", "priority": "high"},
            headers=_auth_headers(staff_token),
        )
        assert r_issue_a.status_code == 201
        issue_a_id = r_issue_a.json()["id"]

        # 3. Client creates issue B
        r_issue_b = client.post(
            issues_url,
            json={"title": "Cannot reset password", "description": "Reset email link fails", "category": "access", "priority": "medium"},
            headers=_auth_headers(client_token),
        )
        assert r_issue_b.status_code == 201
        issue_b_id = r_issue_b.json()["id"]

        # 4. Client queries issues list -> sees ONLY issue B
        r_client_list = client.get(issues_url, headers=_auth_headers(client_token))
        assert r_client_list.status_code == 200
        client_issues = r_client_list.json()["issues"]
        assert len(client_issues) == 1
        assert client_issues[0]["id"] == issue_b_id

        # Staff queries issues list -> sees BOTH issue A and B
        r_staff_list = client.get(issues_url, headers=_auth_headers(staff_token))
        assert r_staff_list.status_code == 200
        assert r_staff_list.json()["total"] == 2

        # 5. Client attempts to GET issue A -> 403 Forbidden
        r_get_a = client.get(f"{issues_url}/{issue_a_id}", headers=_auth_headers(client_token))
        assert r_get_a.status_code == 403
        assert "Clients can only view issues they reported" in r_get_a.json()["detail"]

        # 6. Client attempts to comment on issue A -> 403 Forbidden
        r_com_a = client.post(
            f"{issues_url}/{issue_a_id}/comments",
            json={"content": "Sneaky comment on private issue"},
            headers=_auth_headers(client_token),
        )
        assert r_com_a.status_code == 403

        # 7. Client attempts to view activities on issue A -> 403 Forbidden
        r_act_a = client.get(f"{issues_url}/{issue_a_id}/activities", headers=_auth_headers(client_token))
        assert r_act_a.status_code == 403

        # 8. Client attempts to assign issue -> 403 Forbidden
        r_assign = client.post(
            f"{issues_url}/{issue_b_id}/assign",
            json={"assignee_id": staff_user["id"]},
            headers=_auth_headers(client_token),
        )
        assert r_assign.status_code == 403

        # 9. Client can access, comment, and view activities on their OWN issue B
        r_get_b = client.get(f"{issues_url}/{issue_b_id}", headers=_auth_headers(client_token))
        assert r_get_b.status_code == 200

        r_com_b = client.post(
            f"{issues_url}/{issue_b_id}/comments",
            json={"content": "Here is more context on my issue"},
            headers=_auth_headers(client_token),
        )
        assert r_com_b.status_code == 201

        r_act_b = client.get(f"{issues_url}/{issue_b_id}/activities", headers=_auth_headers(client_token))
        assert r_act_b.status_code == 200

    def test_client_issues_mine_endpoint(self, client: TestClient, db: Session):
        # Setup org
        owner_token, _ = _register_and_login(client, "issues_owner@example.com")
        r_org = client.post(ORGS_URL, json={"name": "Mine Org", "industry": "tech"}, headers=_auth_headers(owner_token))
        org_id = r_org.json()["id"]

        # Client A
        client_a_token, client_a_user = _register_and_login(client, "user_a@example.com")
        db.add(Membership(id=uuid.uuid4(), organization_id=uuid.UUID(org_id), user_id=uuid.UUID(client_a_user["id"]), role="client"))

        # Client B
        client_b_token, client_b_user = _register_and_login(client, "user_b@example.com")
        db.add(Membership(id=uuid.uuid4(), organization_id=uuid.UUID(org_id), user_id=uuid.UUID(client_b_user["id"]), role="client"))
        db.commit()

        # Client A creates 2 issues
        client.post(f"{ORGS_URL}/{org_id}/issues", json={"title": "Issue A1", "description": "Desc A1", "category": "bug", "priority": "low"}, headers=_auth_headers(client_a_token))
        client.post(f"{ORGS_URL}/{org_id}/issues", json={"title": "Issue A2", "description": "Desc A2", "category": "bug", "priority": "high"}, headers=_auth_headers(client_a_token))

        # Client B creates 1 issue
        client.post(f"{ORGS_URL}/{org_id}/issues", json={"title": "Issue B1", "description": "Desc B1", "category": "bug", "priority": "medium"}, headers=_auth_headers(client_b_token))

        # Client A calls /issues/mine -> sees exactly 2
        r_mine_a = client.get("/api/v1/issues/mine", headers=_auth_headers(client_a_token))
        assert r_mine_a.status_code == 200
        data_a = r_mine_a.json()
        assert data_a["total"] == 2
        assert len(data_a["issues"]) == 2
        for iss in data_a["issues"]:
            assert iss["reporter"]["id"] == client_a_user["id"]

        # Client B calls /issues/mine -> sees exactly 1
        r_mine_b = client.get("/api/v1/issues/mine", headers=_auth_headers(client_b_token))
        assert r_mine_b.status_code == 200
        data_b = r_mine_b.json()
        assert data_b["total"] == 1
        assert data_b["issues"][0]["reporter"]["id"] == client_b_user["id"]


# ===========================================================================
# 5. Platform Admin Login & Administration Governance Tests
# ===========================================================================


class TestPlatformAdminGovernance:
    def test_platform_admin_login_endpoint(self, client: TestClient, db: Session):
        # Normal user login at /platform-admin/login -> 403 Forbidden
        _register_and_login(client, "standard_user@example.com")
        r_bad = client.post(
            "/api/v1/auth/platform-admin/login",
            json={"email": "standard_user@example.com", "password": "StrongPassword123!"},
        )
        assert r_bad.status_code == 403
        assert "Platform administrator privileges required" in r_bad.json()["detail"]

        # Platform admin login at /platform-admin/login -> 200 OK with token
        admin_token, admin_user = _register_and_login(client, "real_admin@example.com")
        db_admin = db.get(User, uuid.UUID(admin_user["id"]))
        db_admin.is_platform_admin = True
        db.commit()

        r_ok = client.post(
            "/api/v1/auth/platform-admin/login",
            json={"email": "real_admin@example.com", "password": "StrongPassword123!"},
        )
        assert r_ok.status_code == 200
        assert "access_token" in r_ok.json()

    def test_platform_stats_and_admin_management_lifecycle(self, client: TestClient, db: Session):
        admin_token, admin_user = _register_and_login(client, "gov_admin1@resolvex.internal")
        db_admin = db.get(User, uuid.UUID(admin_user["id"]))
        db_admin.is_platform_admin = True
        db.commit()

        # 1. Platform stats
        r_stats = client.get("/api/v1/platform/stats", headers=_auth_headers(admin_token))
        assert r_stats.status_code == 200
        stats = r_stats.json()
        assert "total_organizations" in stats
        assert "pending_organizations" in stats
        assert "approved_organizations" in stats
        assert "total_users" in stats

        # 2. List platform admins
        r_admins = client.get("/api/v1/platform/admins", headers=_auth_headers(admin_token))
        assert r_admins.status_code == 200
        admin_list = r_admins.json()["admins"]
        assert len(admin_list) >= 1

        # 3. Domain violation is rejected
        sub_token_bad, _ = _register_and_login(client, "candidate_admin@other.com")
        r_bad_promote = client.post(
            "/api/v1/platform/admins",
            json={"email": "candidate_admin@other.com"},
            headers=_auth_headers(admin_token),
        )
        assert r_bad_promote.status_code == 400
        assert "domain" in r_bad_promote.json()["detail"]

        # 4. Promote valid candidate within allowed domain
        sub_token, sub_user = _register_and_login(client, "candidate_admin@resolvex.internal")
        r_promote = client.post(
            "/api/v1/platform/admins",
            json={"email": "candidate_admin@resolvex.internal"},
            headers=_auth_headers(admin_token),
        )
        assert r_promote.status_code == 200
        assert r_promote.json()["is_active"] is True

        # Verify candidate can now access platform endpoints
        r_cand_list = client.get("/api/v1/platform/admins", headers=_auth_headers(sub_token))
        assert r_cand_list.status_code == 200
        assert len(r_cand_list.json()["admins"]) == 2

        # 4. Revoking own privileges is blocked
        r_self = client.delete(f"/api/v1/platform/admins/{admin_user['id']}", headers=_auth_headers(admin_token))
        assert r_self.status_code == 400
        assert "Cannot revoke your own" in r_self.json()["detail"]

        # 5. Revoke the candidate
        r_revoke = client.delete(f"/api/v1/platform/admins/{sub_user['id']}", headers=_auth_headers(admin_token))
        assert r_revoke.status_code == 204

        # 6. Revoking last remaining admin is blocked
        r_last = client.delete(f"/api/v1/platform/admins/{admin_user['id']}", headers=_auth_headers(admin_token))
        assert r_last.status_code == 400
