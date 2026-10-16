"""
Tests for Issue/Ticket and Comment management:
  POST  /api/v1/organizations/{org_id}/issues
  GET   /api/v1/organizations/{org_id}/issues
  GET   /api/v1/organizations/{org_id}/issues/{issue_id}
  PATCH /api/v1/organizations/{org_id}/issues/{issue_id}
  POST  /api/v1/organizations/{org_id}/issues/{issue_id}/assign
  POST  /api/v1/organizations/{org_id}/issues/{issue_id}/comments
  GET   /api/v1/organizations/{org_id}/issues/{issue_id}/comments

Covers CRUD, validation, RBAC, tenant isolation, IDOR prevention,
filtering, sorting, pagination, optimistic locking, and comments.
"""
from __future__ import annotations

import uuid
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Test Helpers & Users
# ---------------------------------------------------------------------------

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ORGS_URL = "/api/v1/organizations"

USER_OWNER = {
    "email": "owner@acme.edu",
    "full_name": "Alice Owner",
    "password": "SecureOwnerPass123!",
}

USER_MANAGER = {
    "email": "manager@acme.edu",
    "full_name": "Bob Manager",
    "password": "SecureManagerPass123!",
}

USER_MEMBER = {
    "email": "member@acme.edu",
    "full_name": "Charlie Member",
    "password": "SecureMemberPass123!",
}

USER_OTHER = {
    "email": "other@acme.edu",
    "full_name": "David Member",
    "password": "SecureOtherPass123!",
}

USER_OUTSIDER = {
    "email": "outsider@othercorp.com",
    "full_name": "Eve Outsider",
    "password": "SecureOutsiderPass123!",
}


def _token_for(client: TestClient, user: dict) -> str:
    client.post(REGISTER_URL, json=user)
    r = client.post(LOGIN_URL, json={"email": user["email"], "password": user["password"]})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _setup_org_with_members(client: TestClient) -> dict:
    """
    Creates Org A with:
      - Alice Owner (owner)
      - Bob Manager (manager)
      - Charlie Member (member)
      - David Member (member)
    Also creates Org B with Eve Outsider (owner).
    Returns a dict with tokens, org_ids, and user_ids.
    """
    token_owner = _token_for(client, USER_OWNER)
    token_manager = _token_for(client, USER_MANAGER)
    token_member = _token_for(client, USER_MEMBER)
    token_other = _token_for(client, USER_OTHER)
    token_outsider = _token_for(client, USER_OUTSIDER)

    # Owner creates Org A
    r_org_a = client.post(
        ORGS_URL,
        json={"name": "Acme University", "industry": "education"},
        headers=_headers(token_owner),
    )
    org_a_id = r_org_a.json()["id"]

    # Outsider creates Org B
    r_org_b = client.post(
        ORGS_URL,
        json={"name": "Beacon Tech", "industry": "technology"},
        headers=_headers(token_outsider),
    )
    org_b_id = r_org_b.json()["id"]

    # Owner adds Bob as manager, Charlie as member, David as member
    r_bob = client.post(
        f"{ORGS_URL}/{org_a_id}/members",
        json={"email": USER_MANAGER["email"], "role": "manager"},
        headers=_headers(token_owner),
    )
    bob_id = r_bob.json()["user_id"]

    r_charlie = client.post(
        f"{ORGS_URL}/{org_a_id}/members",
        json={"email": USER_MEMBER["email"], "role": "member"},
        headers=_headers(token_owner),
    )
    charlie_id = r_charlie.json()["user_id"]

    r_david = client.post(
        f"{ORGS_URL}/{org_a_id}/members",
        json={"email": USER_OTHER["email"], "role": "member"},
        headers=_headers(token_owner),
    )
    david_id = r_david.json()["user_id"]

    # Get Alice user_id
    me_alice = client.get("/api/v1/auth/me", headers=_headers(token_owner)).json()
    alice_id = me_alice["id"]

    # Get Eve user_id
    me_eve = client.get("/api/v1/auth/me", headers=_headers(token_outsider)).json()
    eve_id = me_eve["id"]

    return {
        "org_a_id": org_a_id,
        "org_b_id": org_b_id,
        "token_owner": token_owner,
        "token_manager": token_manager,
        "token_member": token_member,
        "token_other": token_other,
        "token_outsider": token_outsider,
        "alice_id": alice_id,
        "bob_id": bob_id,
        "charlie_id": charlie_id,
        "david_id": david_id,
        "eve_id": eve_id,
    }


# ===========================================================================
# 1. ISSUE CREATION TESTS
# ===========================================================================

class TestCreateIssue:
    def test_member_can_create_issue_success(self, client: TestClient):
        env = _setup_org_with_members(client)
        payload = {
            "title": "Projector not working in room 301",
            "description": "HDMI port appears loose and won't display.",
            "category": "facilities",
            "priority": "high",
        }
        r = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json=payload,
            headers=_headers(env["token_member"]),
        )
        assert r.status_code == 201
        data = r.json()
        assert data["title"] == payload["title"]
        assert data["description"] == payload["description"]
        assert data["category"] == "facilities"
        assert data["priority"] == "high"
        assert data["status"] == "open"
        assert data["issue_number"] == 1
        assert "ACME" in data["issue_key"]
        assert data["reporter"]["email"] == USER_MEMBER["email"]
        assert data["assignee"] is None
        assert data["version"] == 1
        assert "id" in data

    def test_sequential_issue_numbering_per_org(self, client: TestClient):
        env = _setup_org_with_members(client)
        r1 = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Issue One"},
            headers=_headers(env["token_owner"]),
        )
        assert r1.status_code == 201
        assert r1.json()["issue_number"] == 1
        assert r1.json()["issue_key"].endswith("-1")

        r2 = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Issue Two"},
            headers=_headers(env["token_owner"]),
        )
        assert r2.status_code == 201
        assert r2.json()["issue_number"] == 2
        assert r2.json()["issue_key"].endswith("-2")

        # Org B starts its own independent numbering
        r_b = client.post(
            f"{ORGS_URL}/{env['org_b_id']}/issues",
            json={"title": "Org B First Issue"},
            headers=_headers(env["token_outsider"]),
        )
        assert r_b.status_code == 201
        assert r_b.json()["issue_number"] == 1
        assert "BEACON" in r_b.json()["issue_key"]

    def test_create_issue_with_valid_assignee(self, client: TestClient):
        env = _setup_org_with_members(client)
        payload = {
            "title": "Fix leaking faucet",
            "assignee_id": env["bob_id"],
        }
        r = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json=payload,
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 201
        assert r.json()["assignee"]["email"] == USER_MANAGER["email"]

    def test_create_issue_assign_to_non_member_fails(self, client: TestClient):
        env = _setup_org_with_members(client)
        # Attempt to assign issue in Org A to Eve (who is in Org B)
        payload = {
            "title": "Security audit",
            "assignee_id": env["eve_id"],
        }
        r = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json=payload,
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 400
        assert "assignee must be an active member" in r.json()["detail"].lower()

    def test_create_issue_invalid_priority_returns_422(self, client: TestClient):
        env = _setup_org_with_members(client)
        r = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Test issue", "priority": "critical_extreme"},
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 422

    def test_create_issue_title_too_short_returns_422(self, client: TestClient):
        env = _setup_org_with_members(client)
        r = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "hi"},
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 422

    def test_unauthenticated_cannot_create_issue(self, client: TestClient):
        env = _setup_org_with_members(client)
        r = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Anonymous issue"},
        )
        assert r.status_code == 401

    def test_non_member_cannot_create_issue_returns_403(self, client: TestClient):
        env = _setup_org_with_members(client)
        r = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Cross tenant issue"},
            headers=_headers(env["token_outsider"]),
        )
        assert r.status_code == 403


# ===========================================================================
# 2. LIST ISSUES (Filters, Sorting, Pagination, Isolation)
# ===========================================================================

class TestListIssues:
    def test_list_issues_returns_only_org_issues(self, client: TestClient):
        env = _setup_org_with_members(client)
        client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Org A Issue 1"},
            headers=_headers(env["token_owner"]),
        )
        client.post(
            f"{ORGS_URL}/{env['org_b_id']}/issues",
            json={"title": "Org B Issue 1"},
            headers=_headers(env["token_outsider"]),
        )

        r_a = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            headers=_headers(env["token_member"]),
        )
        assert r_a.status_code == 200
        data_a = r_a.json()
        assert data_a["total"] == 1
        assert data_a["issues"][0]["title"] == "Org A Issue 1"

        r_b = client.get(
            f"{ORGS_URL}/{env['org_b_id']}/issues",
            headers=_headers(env["token_outsider"]),
        )
        assert r_b.status_code == 200
        data_b = r_b.json()
        assert data_b["total"] == 1
        assert data_b["issues"][0]["title"] == "Org B Issue 1"

    def test_filter_by_status_and_priority(self, client: TestClient):
        env = _setup_org_with_members(client)
        client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Low priority open", "priority": "low"},
            headers=_headers(env["token_owner"]),
        )
        client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Urgent open", "priority": "urgent"},
            headers=_headers(env["token_owner"]),
        )

        # Filter by priority=urgent
        r = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues?priority=urgent",
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 1
        assert data["issues"][0]["title"] == "Urgent open"

    def test_search_by_keyword(self, client: TestClient):
        env = _setup_org_with_members(client)
        client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Broken printer in library", "description": "Needs toner"},
            headers=_headers(env["token_owner"]),
        )
        client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Air conditioner noisy", "description": "Room 102"},
            headers=_headers(env["token_owner"]),
        )

        r = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues?search=printer",
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 200
        assert r.json()["total"] == 1
        assert "printer" in r.json()["issues"][0]["title"].lower()

    def test_pagination_and_deterministic_sorting(self, client: TestClient):
        env = _setup_org_with_members(client)
        for i in range(5):
            client.post(
                f"{ORGS_URL}/{env['org_a_id']}/issues",
                json={"title": f"Batch Issue {i:02d}"},
                headers=_headers(env["token_owner"]),
            )

        # Page 1, size 2, sorted by issue_number asc
        r = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues?page=1&page_size=2&sort_by=issue_number&sort_dir=asc",
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 5
        assert len(data["issues"]) == 2
        assert data["issues"][0]["issue_number"] == 1
        assert data["issues"][1]["issue_number"] == 2

    def test_non_member_cannot_list_issues_returns_403(self, client: TestClient):
        env = _setup_org_with_members(client)
        r = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            headers=_headers(env["token_outsider"]),
        )
        assert r.status_code == 403


# ===========================================================================
# 3. GET SINGLE ISSUE (IDOR & Isolation)
# ===========================================================================

class TestGetSingleIssue:
    def test_member_can_get_issue_details(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Detailed issue"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        r = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            headers=_headers(env["token_member"]),
        )
        assert r.status_code == 200
        assert r.json()["id"] == issue_id

    def test_cross_tenant_idor_protection(self, client: TestClient):
        """
        Eve in Org B tries to access Alice's issue in Org A.
        Must return 403 when accessing Org A's URL, and 404 when querying
        Alice's issue ID under Org B's URL.
        """
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Secret Org A issue"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        # Attempt 1: Direct access via Org A's path
        r1 = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            headers=_headers(env["token_outsider"]),
        )
        assert r1.status_code == 403

        # Attempt 2: Probing issue ID via Org B's path
        r2 = client.get(
            f"{ORGS_URL}/{env['org_b_id']}/issues/{issue_id}",
            headers=_headers(env["token_outsider"]),
        )
        assert r2.status_code == 404

    def test_invalid_uuid_returns_422(self, client: TestClient):
        env = _setup_org_with_members(client)
        r = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues/not-a-valid-uuid",
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 422


# ===========================================================================
# 4. PATCH ISSUE & OPTIMISTIC CONCURRENCY
# ===========================================================================

class TestUpdateIssue:
    def test_manager_can_update_issue_fields(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Initial title", "priority": "low"},
            headers=_headers(env["token_member"]),
        )
        issue_id = r_create.json()["id"]

        r_patch = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={
                "title": "Updated title by manager",
                "priority": "urgent",
                "status": "in_progress",
            },
            headers=_headers(env["token_manager"]),
        )
        assert r_patch.status_code == 200
        data = r_patch.json()
        assert data["title"] == "Updated title by manager"
        assert data["priority"] == "urgent"
        assert data["status"] == "in_progress"
        assert data["version"] == 2

    def test_reporter_can_update_content_but_not_priority(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "My reported issue", "priority": "low"},
            headers=_headers(env["token_member"]),
        )
        issue_id = r_create.json()["id"]

        # Reporter updates description -> 200
        r1 = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"description": "Added more info"},
            headers=_headers(env["token_member"]),
        )
        assert r1.status_code == 200

        # Reporter tries to bump priority to urgent -> 403
        r2 = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"priority": "urgent"},
            headers=_headers(env["token_member"]),
        )
        assert r2.status_code == 403
        assert "priority" in r2.json()["detail"].lower()

    def test_unrelated_member_cannot_update_issue_returns_403(self, client: TestClient):
        env = _setup_org_with_members(client)
        # Charlie creates an issue
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Charlie's issue"},
            headers=_headers(env["token_member"]),
        )
        issue_id = r_create.json()["id"]

        # David (unrelated regular member) tries to update -> 403
        r = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"title": "Hijacked title"},
            headers=_headers(env["token_other"]),
        )
        assert r.status_code == 403

    def test_optimistic_concurrency_conflict_returns_409(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Concurrent test issue"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]
        assert r_create.json()["version"] == 1

        # First update succeeds, bumps version to 2
        r1 = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"title": "Update 1", "version": 1},
            headers=_headers(env["token_owner"]),
        )
        assert r1.status_code == 200
        assert r1.json()["version"] == 2

        # Second update uses stale version 1 -> 409 Conflict
        r2 = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"title": "Update 2 with stale version", "version": 1},
            headers=_headers(env["token_owner"]),
        )
        assert r2.status_code == 409
        assert "concurrently" in r2.json()["detail"].lower()


# ===========================================================================
# 5. ASSIGNMENT ENDPOINT
# ===========================================================================

class TestAssignIssue:
    def test_manager_can_assign_to_org_member(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "To be assigned"},
            headers=_headers(env["token_member"]),
        )
        issue_id = r_create.json()["id"]

        r = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/assign",
            json={"assignee_id": env["bob_id"]},
            headers=_headers(env["token_manager"]),
        )
        assert r.status_code == 200
        assert r.json()["assignee"]["id"] == env["bob_id"]

    def test_manager_can_unassign_issue(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Assigned issue", "assignee_id": env["bob_id"]},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        r = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/assign",
            json={"assignee_id": None},
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 200
        assert r.json()["assignee"] is None

    def test_regular_member_cannot_assign_issue_returns_403(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Issue"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        # Charlie (member) attempts to assign -> 403
        r = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/assign",
            json={"assignee_id": env["david_id"]},
            headers=_headers(env["token_member"]),
        )
        assert r.status_code == 403

    def test_assign_to_non_member_returns_400(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Issue"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        r = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/assign",
            json={"assignee_id": env["eve_id"]},
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 400


# ===========================================================================
# 6. COMMENTS ENDPOINTS
# ===========================================================================

class TestIssueComments:
    def test_add_and_list_comments(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Issue for discussion"},
            headers=_headers(env["token_member"]),
        )
        issue_id = r_create.json()["id"]

        # Member adds comment
        r1 = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/comments",
            json={"content": "First comment by member"},
            headers=_headers(env["token_member"]),
        )
        assert r1.status_code == 201
        data1 = r1.json()
        assert data1["content"] == "First comment by member"
        assert data1["author"]["email"] == USER_MEMBER["email"]

        # Manager adds reply
        r2 = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/comments",
            json={"content": "Manager investigating now."},
            headers=_headers(env["token_manager"]),
        )
        assert r2.status_code == 201

        # List comments
        r_list = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/comments",
            headers=_headers(env["token_owner"]),
        )
        assert r_list.status_code == 200
        comments = r_list.json()["comments"]
        assert len(comments) == 2
        assert comments[0]["content"] == "First comment by member"
        assert comments[1]["content"] == "Manager investigating now."

    def test_empty_comment_returns_422(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Issue"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        r = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/comments",
            json={"content": "   "},
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 422

    def test_non_member_cannot_add_or_view_comments(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Private issue"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        # Eve from Org B attempts to comment on Org A's issue
        r_post = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/comments",
            json={"content": "I am outside Org A"},
            headers=_headers(env["token_outsider"]),
        )
        assert r_post.status_code == 403

        # Eve attempts to list comments
        r_get = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/comments",
            headers=_headers(env["token_outsider"]),
        )
        assert r_get.status_code == 403

    def test_comment_on_nonexistent_issue_returns_404(self, client: TestClient):
        env = _setup_org_with_members(client)
        fake_issue_id = uuid.uuid4()
        r = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{fake_issue_id}/comments",
            json={"content": "Hello on ghost issue"},
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 404


# ===========================================================================
# 7. WORKFLOW STATE MACHINE TESTS
# ===========================================================================

class TestWorkflowStateMachine:
    def test_allowed_workflow_lifecycle(self, client: TestClient):
        """
        Tests complete valid lifecycle:
        open -> in_progress -> resolved (with resolution_note) -> closed
        """
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Lifecycle issue"},
            headers=_headers(env["token_member"]),
        )
        issue_id = r_create.json()["id"]
        assert r_create.json()["status"] == "open"

        # 1. open -> in_progress (by manager)
        r1 = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "in_progress"},
            headers=_headers(env["token_manager"]),
        )
        assert r1.status_code == 200
        assert r1.json()["status"] == "in_progress"

        # 2. in_progress -> resolved (with resolution_note)
        r2 = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "resolved", "resolution_note": "Replaced faulty power supply."},
            headers=_headers(env["token_manager"]),
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "resolved"
        assert r2.json()["resolution_note"] == "Replaced faulty power supply."

        # 3. resolved -> closed (by manager/staff)
        r3 = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "closed"},
            headers=_headers(env["token_manager"]),
        )
        assert r3.status_code == 200
        assert r3.json()["status"] == "closed"

    def test_reopen_workflow(self, client: TestClient):
        """
        Tests reopening: resolved -> in_progress
        """
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Reopen issue"},
            headers=_headers(env["token_member"]),
        )
        issue_id = r_create.json()["id"]

        # Move to in_progress then resolved
        client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "in_progress"},
            headers=_headers(env["token_manager"]),
        )
        client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "resolved", "resolution_note": "Fixed initially."},
            headers=_headers(env["token_manager"]),
        )

        # Reporter reopens: resolved -> in_progress
        r_reopen = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "in_progress"},
            headers=_headers(env["token_member"]),
        )
        assert r_reopen.status_code == 200
        assert r_reopen.json()["status"] == "in_progress"

    def test_resolve_missing_resolution_note_returns_400(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Issue without note"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "in_progress"},
            headers=_headers(env["token_owner"]),
        )

        # Attempt to resolve with no resolution_note
        r1 = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "resolved"},
            headers=_headers(env["token_owner"]),
        )
        assert r1.status_code == 400
        assert "resolution note is required" in r1.json()["detail"].lower()

        # Attempt to resolve with empty whitespace resolution_note
        r2 = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "resolved", "resolution_note": "    "},
            headers=_headers(env["token_owner"]),
        )
        assert r2.status_code == 400
        assert "resolution note is required" in r2.json()["detail"].lower()

    def test_forbidden_transitions_return_400(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Strict transition test"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        # 1. open -> resolved (skipping in_progress) -> 400
        r = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "resolved", "resolution_note": "Jumped"},
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 400
        assert "invalid status transition" in r.json()["detail"].lower()

        # 2. open -> closed (skipping in_progress and resolved) -> 400
        r = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "closed"},
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 400

        # Move to in_progress
        client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "in_progress"},
            headers=_headers(env["token_owner"]),
        )

        # 3. in_progress -> closed (skipping resolved) -> 400
        r = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "closed"},
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 400

        # 4. in_progress -> open (regression to open not permitted) -> 400
        r = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "open"},
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 400

        # Move to resolved then closed
        client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "resolved", "resolution_note": "Resolved legitimately."},
            headers=_headers(env["token_owner"]),
        )
        client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "closed"},
            headers=_headers(env["token_owner"]),
        )

        # 5. closed -> open -> 400
        r = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "open"},
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 400

        # 6. closed -> in_progress -> 400
        r = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "in_progress"},
            headers=_headers(env["token_owner"]),
        )
        assert r.status_code == 400

    def test_close_issue_permission_check(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Permission close issue"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        # Move to resolved
        client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "in_progress"},
            headers=_headers(env["token_owner"]),
        )
        client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "resolved", "resolution_note": "Resolved."},
            headers=_headers(env["token_owner"]),
        )

        # Regular member Charlie tries to close -> 403
        r_member_close = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "closed"},
            headers=_headers(env["token_member"]),
        )
        assert r_member_close.status_code == 403
        assert "only staff, managers, admins, and owners can close" in r_member_close.json()["detail"].lower()

        # Manager closes -> 200
        r_mgr_close = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "closed"},
            headers=_headers(env["token_manager"]),
        )
        assert r_mgr_close.status_code == 200
        assert r_mgr_close.json()["status"] == "closed"

    def test_reopen_permission_check(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Reopen permission issue"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "in_progress"},
            headers=_headers(env["token_owner"]),
        )
        client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "resolved", "resolution_note": "Resolved."},
            headers=_headers(env["token_owner"]),
        )

        # Unrelated member Charlie (not reporter, not assignee, not staff/mgmt) tries to reopen -> 403
        r_unrelated = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "in_progress"},
            headers=_headers(env["token_member"]),
        )
        assert r_unrelated.status_code == 403
        assert "reopen" in r_unrelated.json()["detail"].lower()

    def test_comment_does_not_change_status(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Issue testing comment isolation"},
            headers=_headers(env["token_member"]),
        )
        issue_id = r_create.json()["id"]
        assert r_create.json()["status"] == "open"

        # Manager comments
        client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/comments",
            json={"content": "Looking into this now."},
            headers=_headers(env["token_manager"]),
        )

        # Verify status is still "open"
        r_get = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            headers=_headers(env["token_member"]),
        )
        assert r_get.json()["status"] == "open"


# ===========================================================================
# 8. AUDIT / ACTIVITY LOG TESTS
# ===========================================================================

class TestAuditActivityLog:
    def test_status_change_creates_activity_record(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Status audit issue"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        # Move to in_progress
        client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "in_progress"},
            headers=_headers(env["token_manager"]),
        )

        # Move to resolved
        client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "resolved", "resolution_note": "Replaced fuse."},
            headers=_headers(env["token_manager"]),
        )

        r_act = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/activities",
            headers=_headers(env["token_owner"]),
        )
        assert r_act.status_code == 200
        data = r_act.json()
        assert data["total"] == 2
        act1, act2 = data["activities"]

        assert act1["action"] == "status_change"
        assert act1["old_value"] == "open"
        assert act1["new_value"] == "in_progress"
        assert act1["actor"]["email"] == USER_MANAGER["email"]

        assert act2["action"] == "status_change"
        assert act2["old_value"] == "in_progress"
        assert act2["new_value"] == "resolved"
        assert act2["details"] == "Replaced fuse."

    def test_priority_change_creates_activity_record(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Priority audit issue", "priority": "low"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        # Manager changes priority low -> urgent
        client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"priority": "urgent"},
            headers=_headers(env["token_manager"]),
        )

        r_act = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/activities",
            headers=_headers(env["token_owner"]),
        )
        assert r_act.status_code == 200
        activities = r_act.json()["activities"]
        assert len(activities) == 1
        assert activities[0]["action"] == "priority_change"
        assert activities[0]["old_value"] == "low"
        assert activities[0]["new_value"] == "urgent"
        assert activities[0]["actor"]["email"] == USER_MANAGER["email"]

    def test_assignment_change_creates_activity_record(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Assignment audit issue"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        # Assign to Bob
        client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/assign",
            json={"assignee_id": env["bob_id"]},
            headers=_headers(env["token_owner"]),
        )

        # Unassign
        client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/assign",
            json={"assignee_id": None},
            headers=_headers(env["token_owner"]),
        )

        r_act = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/activities",
            headers=_headers(env["token_owner"]),
        )
        assert r_act.status_code == 200
        activities = r_act.json()["activities"]
        assert len(activities) == 2
        assert activities[0]["action"] == "assignment_change"
        assert activities[0]["old_value"] is None
        assert activities[0]["new_value"] == env["bob_id"]

        assert activities[1]["action"] == "assignment_change"
        assert activities[1]["old_value"] == env["bob_id"]
        assert activities[1]["new_value"] is None

    def test_no_activity_when_values_unchanged(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Unchanged values issue", "priority": "medium"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        # PATCH with same priority and title change only
        client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"priority": "medium", "title": "Updated title only"},
            headers=_headers(env["token_owner"]),
        )

        # Assign with same assignee (None -> None)
        client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/assign",
            json={"assignee_id": None},
            headers=_headers(env["token_owner"]),
        )

        r_act = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/activities",
            headers=_headers(env["token_owner"]),
        )
        assert r_act.status_code == 200
        # No activities logged because priority and assignee were not actually changed
        assert r_act.json()["total"] == 0

    def test_no_activity_when_transaction_fails(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Failing update issue"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        # Attempt forbidden transition (open -> resolved directly)
        r_fail = client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "resolved", "resolution_note": "Invalid skip"},
            headers=_headers(env["token_owner"]),
        )
        assert r_fail.status_code == 400

        # Verify no activity records were created
        r_act = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/activities",
            headers=_headers(env["token_owner"]),
        )
        assert r_act.status_code == 200
        assert r_act.json()["total"] == 0

    def test_list_activities_chronological_and_paginated(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Paginated activity issue", "priority": "low"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        # Action 1: priority change
        client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"priority": "high"},
            headers=_headers(env["token_owner"]),
        )
        # Action 2: assignment
        client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/assign",
            json={"assignee_id": env["bob_id"]},
            headers=_headers(env["token_owner"]),
        )
        # Action 3: status change
        client.patch(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}",
            json={"status": "in_progress"},
            headers=_headers(env["token_owner"]),
        )

        # Page 1, page_size 2
        r_p1 = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/activities?page=1&page_size=2",
            headers=_headers(env["token_owner"]),
        )
        assert r_p1.status_code == 200
        assert r_p1.json()["total"] == 3
        assert len(r_p1.json()["activities"]) == 2
        assert r_p1.json()["activities"][0]["action"] == "priority_change"
        assert r_p1.json()["activities"][1]["action"] == "assignment_change"

        # Page 2, page_size 2
        r_p2 = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/activities?page=2&page_size=2",
            headers=_headers(env["token_owner"]),
        )
        assert r_p2.status_code == 200
        assert len(r_p2.json()["activities"]) == 1
        assert r_p2.json()["activities"][0]["action"] == "status_change"

    def test_cross_tenant_activity_access_is_forbidden(self, client: TestClient):
        env = _setup_org_with_members(client)
        r_create = client.post(
            f"{ORGS_URL}/{env['org_a_id']}/issues",
            json={"title": "Private activity issue"},
            headers=_headers(env["token_owner"]),
        )
        issue_id = r_create.json()["id"]

        # Eve (Org B) tries to read Org A's issue activities via Org A's URL -> 403
        r1 = client.get(
            f"{ORGS_URL}/{env['org_a_id']}/issues/{issue_id}/activities",
            headers=_headers(env["token_outsider"]),
        )
        assert r1.status_code == 403

        # Eve tries to read Org A's issue activities via Org B's URL -> 404
        r2 = client.get(
            f"{ORGS_URL}/{env['org_b_id']}/issues/{issue_id}/activities",
            headers=_headers(env["token_outsider"]),
        )
        assert r2.status_code == 404

