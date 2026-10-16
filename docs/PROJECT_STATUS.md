# ResolveX — Project Status

> Last updated: 2026-10-16
> Environment: Development
> Branch: `main`

---

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Python 3.13 + FastAPI 0.143 |
| Database | PostgreSQL on Neon (production) / SQLite in-memory (tests) |
| ORM | SQLAlchemy 2.1 |
| Migrations | Alembic 1.20 |
| Auth | pwdlib[argon2] + PyJWT (HS256) |
| Testing | pytest 9.1 + FastAPI TestClient + SQLite StaticPool |
| Architecture | Modular monolith |

---

## Migration State

| Revision | Description | Status |
|---|---|---|
| `67b1d4f210fb` | Create organizations, users, memberships tables | Applied (head -2) |
| `87c0627f72d9` | Empty migration (no-op) | Applied (head -1) |
| `8df1d328402c` | Add `password_hash` column to users | Applied (**head**) |

`alembic check` result: **No new upgrade operations detected** — ORM metadata matches production DB.

---

## Test Results (2026-10-16)

```
pytest tests/ -v --tb=short
54 passed, 0 failed in 7.06s
```

| File | Tests | Result |
|---|---|---|
| test_auth.py — Registration | 14 | PASSED |
| test_auth.py — Login | 9 | PASSED |
| test_auth.py — GET /me | 9 | PASSED |
| test_health.py | 2 | PASSED |
| test_organizations.py — Create | 10 | PASSED |
| test_organizations.py — List | 5 | PASSED |
| test_organizations.py — Get/Isolation | 5 | PASSED |

---

## Authentication Status: PASS

| Check | Status |
|---|---|
| Registration returns 201 | PASS |
| Email normalized to lowercase | PASS |
| Password hashed (Argon2) never returned | PASS |
| Duplicate email returns 409 | PASS |
| Invalid email / short password returns 422 | PASS |
| Login returns 200 + valid JWT | PASS |
| Wrong password / unknown email returns 401 (same message) | PASS |
| Inactive user cannot login | PASS |
| /me without token returns 401 | PASS |
| /me with valid token returns correct user | PASS |
| /me with expired/malformed/wrong-secret token returns 401 | PASS |
| Deactivated user cannot reuse old token | PASS |

---

## Organization / Membership: IMPLEMENTED AND TESTED

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/v1/organizations | Required | Create org; creator becomes owner |
| GET | /api/v1/organizations | Required | List user's own orgs only |
| GET | /api/v1/organizations/{org_id} | Required | Get single org (must be member) |

### Authorization model

- Authorization enforced server-side via Membership table JOIN/lookup.
- Non-members get HTTP 403 when accessing another tenant's org by ID.
- List endpoint returns only orgs where `Membership.user_id = current_user.id`.
- Cross-tenant isolation verified by `test_nonmember_cannot_read_org_returns_403`
  and `test_multiple_users_each_see_only_their_orgs`.

---

## Security Review

| Check | Status | Notes |
|---|---|---|
| JWT secret in .env | PASS | Required field, no default, excluded from git |
| .env never committed | PASS | Confirmed via git ls-files |
| Password algorithm | PASS | Argon2 via pwdlib.PasswordHash.recommended() |
| Plaintext password never returned | PASS | UserResponse has no password fields |
| Password hash never returned | PASS | Verified by test |
| SQL injection | PASS | SQLAlchemy parameterized queries only |
| JWT require sub+exp+iat | PASS | Enforced in decode_access_token |
| Inactive user check | PASS | login and get_current_user both check is_active |
| Registration race condition | PASS | pre-check + flush + IntegrityError handler |

### Remaining items (environment-dependent)

- Generate a 32+ byte JWT secret for production:
  `python -c "import secrets; print(secrets.token_hex(32))"`
- Review Neon connection pool settings (`pool_size=5, max_overflow=10`)
  against expected concurrency.

---

## Files Changed This Session

| File | Action | Description |
|---|---|---|
| backend/tests/conftest.py | Created | SQLite StaticPool fixtures, get_db override |
| backend/tests/test_health.py | Updated | Uses client fixture from conftest |
| backend/tests/test_auth.py | Created | 32 auth tests |
| backend/tests/test_organizations.py | Created | 20 organization + isolation tests |
| backend/app/schemas/organization.py | Created | Org/membership Pydantic schemas |
| backend/app/api/v1/organizations.py | Created | Organization API router |
| backend/app/api/v1/router.py | Updated | Wired organizations router |
| backend/pytest.ini | Created | pythonpath = . for test discovery |
| docs/PROJECT_STATUS.md | Created | This file |

---

## Commands Run

```bash
# Install all requirements
pip install -r requirements.txt

# Verify ORM vs DB alignment (connects to Neon)
alembic check
# => No new upgrade operations detected

# Full test suite (isolated SQLite, never touches production DB)
pytest tests/ -v --tb=short
# => 54 passed, 0 failed in 7.06s
```

---

## Next Milestone: Issue Management

1. Issue model: id, org_id (FK), created_by (FK), title, description,
   status enum (open/in_progress/resolved/closed), priority, assignee_id,
   created_at, updated_at
2. POST /api/v1/organizations/{org_id}/issues — member creates issue
3. GET  /api/v1/organizations/{org_id}/issues — list with status/priority filters
4. GET  /api/v1/organizations/{org_id}/issues/{issue_id} — get single issue
5. PATCH /api/v1/organizations/{org_id}/issues/{issue_id} — update (role-based)
6. Alembic migration for issues table
7. Tests: CRUD + authorization + cross-tenant isolation

### Lower-priority organization features

- POST /api/v1/organizations/{org_id}/members — invite user (owner/admin only)
- DELETE /api/v1/organizations/{org_id}/members/{user_id}
- PATCH /api/v1/organizations/{org_id}/members/{user_id} — change role

---

## Git Status

Modified (uncommitted, pre-existing working files):
- backend/app/__init__.py
- backend/app/api/v1/router.py
- backend/app/core/security.py

Untracked (new work this session):
- backend/app/api/deps.py
- backend/app/api/v1/auth.py
- backend/app/api/v1/organizations.py
- backend/app/schemas/
- backend/tests/conftest.py
- backend/tests/test_auth.py
- backend/tests/test_organizations.py
- backend/pytest.ini
- docs/

Commit command:

```bash
git add backend/app/ backend/tests/ backend/pytest.ini docs/
git commit -m "feat: add auth routes, organization API, and test suite (54 tests)"
git push origin main
```
