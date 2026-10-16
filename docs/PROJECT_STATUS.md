# ResolveX — Project Status

> Last updated: 2026-10-17
> Environment: Development
> Branch: `main`

## Latest Frontend Upgrade

- Added authenticated `/home` onboarding dashboard with real organization, membership-request,
  personal-ticket, and notification data.
- Normal login and registration now land on `/home`; the existing Client Portal remains at
  `/client/dashboard`, and organization workspaces remain under `/org/:orgId/*`.
- Added Home, Client Portal, Organizations, Notifications, and Profile navigation to the client shell.
- Added a read-only Profile page because the current backend exposes no safe profile-update or
  password-change endpoint. Roles, verification state, and permissions remain server-managed.
- Added responsive dark-theme cards, reduced-motion-aware entrance effects, real loading/error/empty
  states, and HomePage frontend coverage.

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
| `67b1d4f210fb` | Create organizations, users, memberships tables | Applied |
| `87c0627f72d9` | Empty migration (no-op) | Applied |
| `8df1d328402c` | Add `password_hash` column to users | Applied |
| `1986f59ad2aa` | Create `issues` and `comments` tables with constraints | Applied |
| `28cf1ea8d116` | Create `issue_activities` table and add `resolution_note` to issues | Applied |
| `a3f7c2e81b05` | Create `notifications` table with constraints & foreign keys | Applied |
| `c7d1e892f304` | Add organization verification, join code hashes, and membership requests | Applied |
| `8b6f2d1e4c90` | Add notification client target paths | Applied |
| `9c7e4a2b6d11` | Add notification source comment IDs for deduplication | Applied |
| `b4e1f7a2c903` | Add permanent organization codes and encrypted invitation codes | Applied |
| `c5d2e8f4a701` | Add explicit platform-reviewed domain verification state | Current migration head |
| `d6e3f9a5b812` | Add ownership transfer and organization archival lifecycle fields | Current migration head |

The migration chain was validated with Alembic and the isolated test database schema. Apply `d6e3f9a5b812` through the normal deployment migration process; production Neon was not modified.

---

## Test Results

```
pytest tests/ -v
Backend full suite: **177 passed, 0 failed in 411.87s**
Backend authorization and organization suites: **63 passed, 0 failed in 147.50s**
Backend lifecycle tests: **2 passed, 0 failed in 8.75s**
Frontend production build: **PASSED** (`tsc -b && vite build`)
Frontend full suite: **18 passed, 0 failed in 10.04s**
Backend Python compilation: **PASSED** (`compileall`)
Alembic migration head: **PASSED** (`d6e3f9a5b812`)
```

| File / Test Suite | Tests | Result | Description |
|---|---|---|---|
| `test_auth.py` — Registration | 14 | PASSED | Validations, lowercase email, Argon2 hashing, duplicate checks |
| `test_auth.py` — Login | 9 | PASSED | Credentials verification, JWT issuance, timing attack mitigation |
| `test_auth.py` — GET /me | 9 | PASSED | Token extraction, claims verification, deactivated user checks |
| `test_authorization_workflows.py` | 10 | PASSED | Platform admin privileges, org verification lifecycle, join codes, requests, client ticket isolation |
| `test_health.py` | 2 | PASSED | Root & health status endpoints |
| `test_organizations.py` — Create | 10 | PASSED | Single-transaction creation, owner assignment, slug generation |
| `test_organizations.py` — List & Isolation | 5 | PASSED | User-only listings, cross-tenant isolation |
| `test_organizations.py` — Get & Isolation | 5 | PASSED | Single org details, non-member 403 enforcement |
| `test_organizations.py` — Pagination | 2 | PASSED | Default metadata (page=1, size=20) and custom slicing |
| `test_organizations.py` — List Members | 5 | PASSED | Authorized member listing, ordering, 403 on non-members |
| `test_organizations.py` — Add Member | 10 | PASSED | Owner/admin add, privilege escalation prevention, duplicates |
| `test_organizations.py` — Update Member Role | 8 | PASSED | Role promotion/demotion, last owner protection (400), admin limits |
| `test_organizations.py` — Remove Member | 8 | PASSED | Self-leave, owner removal, last owner leave/remove prevention (400) |
| `test_issues.py` — Create Issue | 8 | PASSED | Member creation, sequential org key (`ACME-1`), assignee check, validation |
| `test_issues.py` — List Issues | 5 | PASSED | Filtering (status, priority, search), pagination, sorting, tenant isolation |
| `test_issues.py` — Single Issue (IDOR) | 3 | PASSED | Authorized get, cross-tenant IDOR attack protection (403/404), invalid UUID |
| `test_issues.py` — Update Issue | 4 | PASSED | Content edits by reporter/manager, priority escalation block, optimistic locking (409) |
| `test_issues.py` — Assign Issue | 4 | PASSED | Manager/owner assign, unassign (`null`), non-member rejection (400), member assign block (403) |
| `test_issues.py` — Comments | 4 | PASSED | Member add/list comments, empty comment rejection (422), non-member 403 |
| `test_issues.py` — Workflow State Machine | 7 | PASSED | `open -> in_progress -> resolved -> closed`, reopen, 400 on invalid transitions, mandatory resolution note |
| `test_issues.py` — Audit / Activity Log | 7 | PASSED | Status, priority, assignment audit logging, no-op prevention, rollback on failure, pagination, IDOR isolation |
| `test_notifications.py` — Triggers & Dispatch | 9 | PASSED | Assignment, unassignment, status transitions, comments, deduplication, no self-notifications |
| `test_notifications.py` — List & Pagination | 7 | PASSED | Current-user list, read/unread filters, ordering, response schema, tenant/user isolation |
| `test_notifications.py` — Unread Count | 4 | PASSED | Count query, increment on triggers, decrement on read |
| `test_notifications.py` — Mark Single Read | 5 | PASSED | Individual read status toggle, idempotency, 404 for other user/nonexistent |
| `test_notifications.py` — Mark All Read | 5 | PASSED | Bulk read status toggle, user-scoped batch update |
| `test_notifications.py` — Security & Auth | 6 | PASSED | Auth enforcement, cross-user IDOR protection (404), unauthenticated 401 |
| **Verified current run** | **13 backend workflow + 16 frontend** | **100% PASS** | Automatic approval-code workflow and complete frontend suite |

---

## Milestone 1: Authentication & User Management — VERIFIED

- Registration with Argon2 password hashing (plaintext passwords and hashes never returned).
- Email normalization (lowercase).
- Login with JWT issuance (subject, issued-at, expiration).
- Server-side token validation on `get_current_user` dependency.

---

## Milestone 2: Organization & Membership Management — VERIFIED

- Organization creation automatically assigns creator the `owner` role in the same transaction.
- Member listing with role hierarchy sorting and pagination.
- Role management: `owner`, `admin`, `manager`, `staff`, `member`.
- Server-side tenant isolation and owner safeguards:
  - Last remaining owner cannot be demoted or removed (HTTP 400).
  - Admins cannot escalate privileges or alter owners (HTTP 403).

---

## Milestone 3: Issue / Ticket Management — VERIFIED

- Issue CRUD under `/api/v1/organizations/{org_id}/issues`.
- Multi-criteria filtering, search, sorting, and bounded pagination.
- Assignee validation to ensure members belong to the same tenant.
- Comments endpoint (`POST /comments`, `GET /comments`).
- Optimistic concurrency control using `version`.

---

## Milestone 4: Workflow & Audit Trail — COMPLETE

### 1. Status State Machine

The status transitions are strictly validated in `PATCH /api/v1/organizations/{org_id}/issues/{issue_id}`:

```
[open] --------> [in_progress] --------> [resolved] --------> [closed]
                      ^                      |
                      |--- (reopen) ---------|
```

- **Allowed transitions**:
  1. `open -> in_progress` (started by assignee, staff, manager, admin, or owner)
  2. `in_progress -> resolved` (resolved by assignee, staff, manager, admin, or owner; **requires non-empty `resolution_note`**)
  3. `resolved -> closed` (closed strictly by staff, manager, admin, or owner; regular members receive HTTP 403)
  4. `resolved -> in_progress` (reopened by reporter, assignee, staff, manager, admin, or owner; unrelated members receive HTTP 403)
- **Forbidden transitions**:
  - All other transitions (`open -> resolved`, `open -> closed`, `in_progress -> closed`, `closed -> open`, `closed -> in_progress`, `closed -> resolved`, `in_progress -> open`) are rejected with `HTTP 400 Bad Request`.
  - Clients cannot bypass transition validation through generic PATCH updates.

### 2. Audit Trail & Activity Logging

- **Model**: `IssueActivity` (`id`, `organization_id`, `issue_id`, `actor_id`, `action`, `old_value`, `new_value`, `details`, `created_at`).
- **Events Logged**:
  - `status_change`: Logs old status, new status, and resolution note (if resolved).
  - `priority_change`: Logs old priority and new priority.
  - `assignment_change`: Logs old assignee and new assignee.
- **Transactional & Real Changes Only**:
  - Activities are added only when a real value change occurs (no-op updates do not generate log spam).
  - Activities are persisted in the same transaction as the issue update; if an update fails, no orphan activity records are created.
- **Activity API Endpoint**:
  - `GET /api/v1/organizations/{org_id}/issues/{issue_id}/activities`
  - Chronologically ordered (`created_at ASC, id ASC`) with bounded pagination (`page`, `page_size`, `total`).
  - Read-only: no endpoint allows editing or deleting activity records.
- **Tenant Isolation & IDOR Protection**:
  - Verifies caller is a member of the organization and issue belongs to the organization (HTTP 403/404 on IDOR attempts).
- **Comment Isolation**:
  - Adding comments does not alter issue status or inject false activity records.

---

## Milestone 5: Notifications & In-App Alerts — COMPLETE

### 1. Model & Migration
- **Model**: `Notification` (`id`, `organization_id`, `recipient_id`, `actor_id`, `issue_id`, `type`, `title`, `message`, `is_read`, `created_at`).
- **Migration**: `a3f7c2e81b05_create_notifications_table.py` (chained after `28cf1ea8d116`).
- **Indexes**: Composite indexes on `(recipient_id, is_read)` and `(recipient_id, created_at DESC)` for efficient inbox reads and badge counters.

### 2. Endpoints
- `GET /api/v1/notifications`: Paginated list of current-user notifications with optional `is_read` boolean filter. Ordered newest-first (`created_at DESC, id DESC`).
- `GET /api/v1/notifications/unread-count`: High-performance badge counter for unread in-app alerts.
- `PATCH /api/v1/notifications/{id}/read`: Mark an individual notification read. Returns 404 on IDOR attempts (preventing notification enumeration).
- `PATCH /api/v1/notifications/read-all`: Bulk mark all unread notifications read for the current user. Returns HTTP 204.

### 3. Business Triggers & Safeguards
- **Event triggers**:
  - Issue assignment & reassignment (notifying the assignee).
  - Issue unassignment (notifying the previous assignee).
  - Issue status transition (notifying reporter and assignee).
  - Issue comments (notifying reporter and assignee).
- **Self-notification suppression**: Users never receive notifications for their own actions.
- **Deduplication**: When an actor plays multiple roles (e.g. reporter is also assignee), duplicate notification records are prevented.
- **Active member isolation**: Only active members in the organization receive notifications.

---

## Milestone 6: Frontend Integration — COMPLETE

### 1. Architecture & Core Stack
- **Framework & Bundler**: React 19 + TypeScript 5.8 + Vite 8
- **Routing**: React Router DOM (v7) with protected route guards and tenant-aware path hierarchies
- **Design System**: Vanilla CSS tokens in `index.css` implementing an obsidian dark mode, glassmorphism, glowing indigo accents, and custom semantic badges
- **Iconography & Typography**: `lucide-react`, Google Fonts (Inter + Outfit + JetBrains Mono)
- **State Management**:
  - `AuthContext`: Centralized JWT authentication, reactive session tracking, auto 401 unauthorization dispatch
  - `OrgContext`: Multi-tenant organization workspace switcher, active tenant caching, role-based helpers (`isOwner`, `canManageIssues`, `canManageMembers`)
- **API Client**: Centralized typed `ApiClient` in `src/services/api.ts` connecting to `/api/v1` (with Vite dev proxy to `http://127.0.0.1:8000`), handling error extraction, and injecting bearer tokens

### 2. Implemented Screens
1. **Login & Registration** (`/login`, `/register`):
   - Form field validations (email format, 8+ character password, password confirmation matching)
   - Real-time error alerts and automatic session hydration
2. **Organization Workspaces** (`/organizations`):
   - Workspace card selector with role badges and industry tags
   - "New Organization" modal creating a tenant with auto-generated/custom slug
3. **Issue & Service Desk Dashboard** (`/org/:orgId/issues`):
   - KPI metric counters (Open, In Progress, Resolved, Urgent)
   - Real-time search by keyword, status filtering, priority filtering, and multi-field sorting
   - Responsive table view and bounded pagination
4. **Issue Creation** (`/org/:orgId/issues/new`):
   - Ticket submission with title validation, category selection, priority level, assignee picker (populated dynamically with organization members), and detailed description
5. **Issue Details & Workflow Actions** (`/org/:orgId/issues/:issueId`):
   - Status state machine action triggers:
     - `open -> in_progress` ("Start Progress")
     - `in_progress -> resolved` ("Resolve Issue", with mandatory resolution note modal)
     - `resolved -> closed` ("Close Ticket")
     - `resolved -> in_progress` ("Reopen")
   - Re-assignment and unassignment picker with optimistic locking (`version` concurrency guard)
   - Interactive dual tabs:
     - **Discussion**: Real-time comment submission and threaded conversation list
     - **Audit Trail**: Chronological activity timeline with actor, action, old/new diffs, and timestamps
6. **Team & Membership Management** (`/org/:orgId/members`):
   - Member roster table with roles and join dates
   - "Add Member" modal for owners/admins
   - Role adjustment selector and member removal/leave action with last-owner protection
7. **In-App Notification Center & Bell Popover** (`/notifications`):
   - Real-time unread badge counter in top navbar
   - Quick notification dropdown popover with direct link to ticket
   - Full inbox page with read/unread filtering, mark single as read, and bulk mark all read

### 3. Verification & Build Results
- **Frontend Test Suite (Vitest)**:
  ```
  npx vitest run --pool=forks --maxWorkers=1
  16 passed across 6 test files in 18.76s
  ```
- **Frontend Production Build**:
  ```
  npm run build
  dist/index.html                   1.18 kB │ gzip:   0.63 kB
  dist/assets/index-DzuT4PHY.css   10.94 kB │ gzip:   2.93 kB
  dist/assets/index-aDsmThXE.js   428.04 kB │ gzip: 114.13 kB
  ✓ built in 1.88s
  ```
- **Backend Test Suite (Pytest)**:
  ```
  pytest -q tests/test_authorization_workflows.py
  13 passed, 0 failed in 38.44s
  ```

The first parallel frontend run encountered Vitest worker-start timeouts; the single-worker rerun passed. The full backend run completed before the final automatic-code assertion was added; the affected organization workflow suite passed afterward.

---

## Milestone 7: Authorization & Organization Membership Workflow — VERIFIED

### 1. Role Architecture & Registration Security
- Public registration (`/api/v1/auth/register`) only creates standard generic `User` accounts. `is_platform_admin` is enforced server-side as `False` and cannot be injected via registration payloads.
- Organization roles (`owner`, `admin`, `manager`, `staff`, `client`, `member`) are strictly organization-scoped via `Membership`.

### 2. Organization Verification Lifecycle
- Newly created organizations default to `verification_status="pending"`.
- Dedicated Platform Administrator APIs (`/api/v1/platform/organizations`) protected by `get_current_platform_admin`:
  - List all organizations with status filter (`pending`, `approved`, `rejected`, `suspended`) and member/issue counts.
  - Approve organization (`POST /approve`).
  - Reject organization with mandatory/optional reason (`POST /reject`).
  - Suspend organization (`POST /suspend`).
- Non-platform admins attempting access receive `403 Forbidden`.

### 3. High-Entropy Join Codes & Membership Requests
- Join codes are generated with high entropy (`RX-` + 8 hex chars), stored in DB as SHA-256 hashes (`join_code_hash`), with clear codes returned only at creation time.
- Only approved organizations can generate join codes (unapproved orgs receive `403 Forbidden`).
- Join codes can be rotated or revoked at any time (`DELETE /join-code`).
- Prospective members submit codes (`POST /api/v1/organizations/join`), creating pending `MembershipRequest` records.
- Duplicate requests or submissions from existing members return `409 Conflict`.
- Org admins and owners review pending requests (`GET /membership-requests`):
  - Approve request (`POST /approve`) with assigned role (`client`, `staff`, `manager`). Self-approval and privilege escalation by non-owner admins are strictly forbidden (`400`/`403`).
  - Reject request (`POST /reject`) with optional reason.
  - Generates real-time in-app notifications for join requests and review decisions.

### 4. Client / Reporter Issue Isolation
- Strict reporter isolation for `role="client"`:
  - `GET /issues`: Returns only issues where `reporter_id == current_user.id`.
  - `GET /issues/{id}`, `PATCH /issues/{id}`, `GET /activities`, `POST/GET /comments`: Direct access to issues reported by other users returns `403 Forbidden`.
  - Clients cannot assign or reassign issues (`403 Forbidden`).
  - Staff, managers, admins, and owners maintain full organization-wide visibility.

### 5. Frontend UI Integration
- **Organization Workspaces**: Verification status badges, rejection reason warnings, "Join with Code" modal, and user's pending join requests table.
- **Team & Memberships**: Join code card with copy/rotate/revoke actions for org admins; "Pending Requests" review tab with role assignment and approval/rejection buttons.
- **Client Issue View**: Tailored "My Reported Tickets" dashboard.
- **Platform Admin View** (`/platform`): Dedicated governance dashboard for platform admins with status filters, organization metrics, and approve/reject/suspend actions.

---

## Next Milestone Recommendation: SLA & Automation Policies

1. **SLA Management**:
   - Add `due_at` calculation and `sla_breached` indicators based on priority-based SLA tiers (Urgent = 4h, High = 24h, Medium = 48h, Low = 5d).
2. **Automated Escalations**:
   - Background job identifying tickets nearing or exceeding SLA thresholds.
3. **Email / Webhook Delivery Stub**:
   - Outbound dispatch worker stub for critical notifications.
