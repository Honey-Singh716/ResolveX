# ResolveX — Complete Technical Documentation
### A-Z Interview Preparation | System Design | Deployment Guide | Tech Stack Reference

> **HOW TO USE THIS FILE:**
> Paste the entire contents into Claude and say:
> "Convert this into a beautiful, well-formatted PDF document with proper headings, tables, code blocks, and a professional layout."

---

# PART 1 — PROJECT OVERVIEW

## 1.1 What is ResolveX?

ResolveX is a multi-tenant SaaS platform for issue and service management. It allows organizations (companies, institutions, service providers) to manage their customer support tickets, internal issue tracking, and team workflows — all within a single, role-secured platform.

Think of it as a lightweight Jira + Freshdesk hybrid, designed with a clean multi-tenant architecture where each organization is fully isolated from every other.

## 1.2 Core Value Proposition

- Organizations register on the platform and submit for verification
- A central Platform Administrator approves or rejects organizations
- Once approved, the org gets a unique code and join link
- Staff and members join via invitation code
- Clients submit issues (tickets) through a dedicated portal
- Staff manage, assign, and resolve tickets with a full audit trail
- Everyone receives real-time in-app notifications

## 1.3 Business Domain Model

```
Platform (ResolveX itself)
└── Platform Administrators  (superusers — manage the platform)
    └── Organizations        (tenants — companies that sign up)
        ├── Owners           (created the org, full control)
        ├── Admins           (manage members and settings)
        ├── Managers         (can manage issues)
        ├── Staff            (resolve and work on issues)
        ├── Members          (general internal users)
        └── Clients          (customers — raise issues only)
            └── Issues/Tickets
                ├── Comments
                ├── Activity Log (audit trail)
                └── Notifications
```

---

# PART 2 — TECH STACK

## 2.1 Backend Stack

| Layer | Technology | Version | Why Chosen |
|---|---|---|---|
| Language | Python | 3.12 | Modern syntax, type hints, ecosystem |
| Web Framework | FastAPI | Latest | Auto OpenAPI docs, Pydantic validation, async-capable |
| ASGI Server | Uvicorn | Latest (standard) | Production-grade ASGI server |
| ORM | SQLAlchemy | 2.x | Modern mapped_column style, type-safe queries |
| Migrations | Alembic | Latest | Version-controlled schema evolution |
| DB Driver | psycopg (v3) | Latest binary | PostgreSQL driver, faster than psycopg2 |
| Password Hash | pwdlib + Argon2 | Latest | Memory-hard, industry best practice |
| JWT Auth | PyJWT | Latest | HS256 tokens, lightweight |
| Settings | pydantic-settings | Latest | Type-safe env var loading |
| Encryption | cryptography Fernet | Latest | Symmetric encryption for join codes |
| Validation | pydantic v2 | Latest | Fast Rust-backed validation |
| Email Validate | email-validator | Latest | RFC-compliant email validation |
| Testing | pytest + httpx | Latest | Fast async-capable API testing |

## 2.2 Frontend Stack

| Layer | Technology | Version | Why Chosen |
|---|---|---|---|
| Language | TypeScript | 6.x | Type safety, better developer experience |
| UI Framework | React | 19.x | Component model, ecosystem |
| Routing | React Router DOM | v7 | Nested routes, layout support |
| Build Tool | Vite | 8.x | Extremely fast HMR, esbuild bundler |
| Icons | Lucide React | 1.x | Clean, consistent icon set |
| HTTP Client | Native fetch | — | No extra dependency, wrapped in typed ApiClient |
| State | React Context API | — | Simple global auth + org state |
| Testing | Vitest + Testing Library | Latest | Vite-native test runner |
| Linting | oxlint | Latest | Rust-based, blazing fast |

## 2.3 Database

| Aspect | Detail |
|---|---|
| Engine | PostgreSQL 16+ |
| Hosting | Neon (serverless PostgreSQL) |
| Connection | psycopg3 with pool_size=5, max_overflow=10 |
| SSL | sslmode=require + channel_binding=require |
| Schema Management | Alembic (15 migration versions, full history) |
| Primary Keys | UUID v4 on every table |

## 2.4 Infrastructure

| Component | Technology |
|---|---|
| Containerization | Docker (multi-stage builds) |
| Hosting | Render (backend API) + Vercel (frontend SPA) |
| Database | Neon (serverless PostgreSQL) |
| Frontend Server | Vercel Edge Network / CDN |
| CI/CD | Git push triggers automatic deployment |

---

# PART 3 — SYSTEM DESIGN

## 3.1 High-Level Architecture

```
[Browser — React SPA — Vercel Edge CDN]
         |
         | HTTPS, calls /api/v1/*
         v
[Backend — FastAPI + Uvicorn — Render]
    API Routes → Pydantic Schemas → Business Logic Services
         |
         | psycopg3 over SSL
         v
[Neon PostgreSQL]
    8 tables, 15 Alembic migrations
```

## 3.2 Multi-Tenancy Design

ResolveX uses Row-Level Multi-Tenancy. All organizations share the same database, but every organization-scoped table carries an organization_id foreign key column.

Tenant isolation is enforced at the API layer through the Membership Guard Pattern:

Every API request to an org-scoped endpoint calls _require_membership() which queries the memberships table to verify the authenticated user has a row linking them to that specific organization. No user can access another org's data without a Membership row.

```python
def _require_membership(db, org_id, user_id) -> Membership:
    membership = db.scalar(
        select(Membership).where(
            Membership.organization_id == org_id,
            Membership.user_id == user_id,
        )
    )
    if membership is None:
        raise HTTPException(403, "You do not have access to this organization")
    return membership
```

## 3.3 Database Schema

### users
- id: UUID (PK)
- email: VARCHAR(320) UNIQUE INDEX
- password_hash: VARCHAR(255)
- full_name: VARCHAR(150)
- is_active: BOOLEAN DEFAULT TRUE
- is_platform_admin: BOOLEAN DEFAULT FALSE
- created_at: TIMESTAMPTZ

### organizations
- id: UUID (PK)
- name: VARCHAR(150)
- slug: VARCHAR(100) UNIQUE INDEX
- industry: VARCHAR(50)
- official_email_domain: VARCHAR(255)
- official_website: VARCHAR(500)
- proof_document_reference: VARCHAR(1000)
- contact_phone: VARCHAR(50)
- is_active: BOOLEAN
- verification_status: VARCHAR(20) INDEX [pending|approved|rejected|suspended]
- domain_verification_status: VARCHAR(20) INDEX
- rejection_reason: VARCHAR(500)
- verified_at: TIMESTAMPTZ
- verified_by: UUID FK(users.id)
- join_code_hash: VARCHAR(255) INDEX [SHA-256 of the join code]
- join_code_encrypted: VARCHAR(500) [Fernet-encrypted join code]
- join_code_created_at: TIMESTAMPTZ
- organization_code: VARCHAR(32) UNIQUE [e.g. RXO-2026-00001]
- deletion_requested_at, deletion_scheduled_for, deletion_requested_by
- ownership_transfer_target_id, ownership_transfer_requested_at
- archived_at: TIMESTAMPTZ
- DB CHECK: verification_status IN ('pending','approved','rejected','suspended')

### memberships
- id: UUID (PK)
- organization_id: UUID FK(organizations.id) CASCADE INDEX
- user_id: UUID FK(users.id) CASCADE INDEX
- role: VARCHAR(20)
- UNIQUE (organization_id, user_id)
- CHECK (role IN ('owner','admin','manager','staff','member','client'))

### membership_requests
- id: UUID (PK)
- organization_id: UUID FK
- user_id: UUID FK
- status: VARCHAR(20) [pending|approved|rejected]
- role: VARCHAR(20)
- rejection_reason: VARCHAR(500)
- decided_by: UUID FK, decided_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ

### issues
- id: UUID (PK)
- organization_id: UUID FK CASCADE INDEX
- issue_number: INTEGER [sequential per org: 1, 2, 3...]
- issue_key: VARCHAR(50) [e.g. ACME-0001]
- title: VARCHAR(255)
- description: TEXT
- category: VARCHAR(50) INDEX
- priority: VARCHAR(20) INDEX [low|medium|high|urgent]
- status: VARCHAR(30) INDEX [open|in_progress|resolved|closed]
- reporter_id: UUID FK SET NULL INDEX
- assignee_id: UUID FK SET NULL INDEX
- version: INTEGER DEFAULT 1 [optimistic locking]
- resolution_note: TEXT
- created_at, updated_at: TIMESTAMPTZ
- UNIQUE (organization_id, issue_number)
- UNIQUE (organization_id, issue_key)
- CHECK constraints on priority and status

### issue_activities (Audit Log)
- id: UUID (PK)
- organization_id, issue_id: UUID FK INDEX
- actor_id: UUID FK INDEX
- action: VARCHAR(50) INDEX [e.g. status_changed, assigned]
- old_value, new_value: VARCHAR(255)
- details: TEXT
- created_at: TIMESTAMPTZ INDEX

### comments
- id: UUID (PK)
- issue_id: UUID FK CASCADE
- organization_id: UUID FK
- author_id: UUID FK SET NULL
- content: TEXT
- created_at: TIMESTAMPTZ

### notifications
- id: UUID (PK)
- organization_id: UUID FK CASCADE INDEX
- recipient_id: UUID FK CASCADE INDEX
- actor_id: UUID FK SET NULL
- issue_id: UUID FK CASCADE INDEX
- target_path: VARCHAR(500) [frontend route to navigate to on click]
- source_comment_id: UUID FK CASCADE INDEX
- type: VARCHAR(50) INDEX
- title: VARCHAR(255), message: TEXT
- is_read: BOOLEAN DEFAULT FALSE INDEX
- created_at: TIMESTAMPTZ INDEX
- CHECK (type IN ('issue_assigned','issue_unassigned','issue_status_changed','comment_added'))

## 3.4 Issue Status State Machine

Allowed transitions (enforced as a frozenset for O(1) lookup):

```
open → in_progress → resolved → closed
                  ↑          |
                  └──────────┘ (reopen: resolved → in_progress)
```

Invalid transitions (e.g. open → closed) are rejected with HTTP 400 before any DB write.

## 3.5 Organization Lifecycle

```
(created) → pending → approved (active operations)
                   → rejected
          approved → suspended
```

## 3.6 Authentication Flow

1. User POSTs email + password to /auth/login
2. Server: verify Argon2 hash (password, stored_hash)
3. Server: create JWT { "sub": "<user_uuid>", "exp": now+30min, "iat": now }
4. Server: sign with HS256 using JWT_SECRET_KEY
5. Client: store JWT in localStorage
6. Every request: Authorization: Bearer <token>
7. Server get_current_user(): decode token → extract UUID → load User from DB → check is_active

## 3.7 Join Code Security — Dual Storage Design

When org is approved:
1. Generate plaintext code: RX-A1B2C3D4 (RX prefix + 8 hex chars, URL-safe)
2. Compute SHA-256(plaintext) → store as join_code_hash (indexed for fast lookup)
3. Fernet.encrypt(plaintext) → store as join_code_encrypted (for displaying to owners)

Why dual storage:
- SHA-256 hash enables O(1) indexed lookup when a user submits a join code
- Fernet encryption (key derived from JWT_SECRET_KEY via SHA-256) enables owners to see and share the code
- Plaintext is never persisted to the database

## 3.8 Notification System Design

Key design decisions:
- All notification creation runs in FastAPI BackgroundTasks — never blocks the HTTP response
- Background tasks open their own independent SQLAlchemy session
- Errors in notification creation never roll back the issue transaction
- Self-notifications are suppressed: users never get notified about their own actions
- Recipient sets are deduplicated before insertion
- Only active organization members receive notifications

Notification Types:
- issue_assigned: you were assigned to an issue
- issue_unassigned: you were removed from an issue
- issue_status_changed: status changed on an issue you're involved with
- comment_added: someone commented on an issue you're involved with

---

# PART 4 — COMPLETE API REFERENCE

## Auth (/api/v1/auth)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /auth/register | None | Register new user account |
| POST | /auth/login | None | Login → JWT access token |
| POST | /auth/platform-admin/login | None | Platform admin login (checks is_platform_admin) |
| GET | /auth/me | Bearer | Get current user profile |

## Organizations (/api/v1/organizations)

| Method | Path | Role Required | Description |
|---|---|---|---|
| POST | /organizations | Any logged-in | Create organization (caller becomes owner) |
| GET | /organizations | Any | List my organizations with pagination |
| GET | /organizations/discover | Any | List all approved organizations |
| GET | /organizations/{id} | Member | Get organization details |
| GET | /organizations/{id}/members | Member | List members (paginated) |
| POST | /organizations/{id}/members | Owner/Admin | Add member directly |
| PATCH | /organizations/{id}/members/{user_id} | Owner/Admin | Update member role |
| DELETE | /organizations/{id}/members/{user_id} | Owner/Admin or Self | Remove or leave |
| GET | /organizations/{id}/join-code | Owner/Admin | Retrieve join code |
| POST | /organizations/join | Any | Join org by submitting join code |
| GET | /organizations/membership-requests/mine | Any | View my own join requests |
| GET | /organizations/{id}/membership-requests | Owner/Admin | View all requests |
| POST | /organizations/{id}/membership-requests/{req_id}/approve | Owner/Admin | Approve |
| POST | /organizations/{id}/membership-requests/{req_id}/reject | Owner/Admin | Reject |
| POST | /organizations/{id}/ownership-transfer | Owner | Request ownership transfer |
| POST | /organizations/{id}/ownership-transfer/accept | Target user | Accept ownership |
| POST | /organizations/{id}/deletion-request | Owner | Request deletion |
| DELETE | /organizations/{id}/deletion-request | Owner | Cancel deletion |
| POST | /organizations/{id}/archive | Owner | Archive organization |

## Issues (/api/v1/organizations/{org_id}/issues)

| Method | Path | Role | Description |
|---|---|---|---|
| POST | /{org_id}/issues | Member | Create issue |
| GET | /{org_id}/issues | Member | List (filters: status, priority, assignee, category, search, sort, page) |
| GET | /{org_id}/issues/{id} | Member | Get single issue |
| PATCH | /{org_id}/issues/{id} | Staff+ | Update (state machine enforced, optimistic lock) |
| POST | /{org_id}/issues/{id}/assign | Staff+ | Assign or unassign issue |
| GET | /{org_id}/issues/{id}/activities | Member | Audit trail |
| POST | /{org_id}/issues/{id}/comments | Member | Add comment |
| GET | /{org_id}/issues/{id}/comments | Member | List comments |

## Client Issues (/api/v1/issues)

| Method | Path | Description |
|---|---|---|
| GET | /issues/mine | Client sees only their own issues |
| GET | /issues/mine/{id} | Client views specific issue |
| GET | /issues/mine/{id}/comments | Client reads comments |
| POST | /issues/mine/{id}/comments | Client adds comment |
| GET | /issues/mine/{id}/activities | Client views history |

## Platform Administration (/api/v1/platform)

| Method | Path | Description |
|---|---|---|
| GET | /platform/organizations | List all orgs (filter by status) |
| POST | /platform/organizations/{id}/approve | Approve (generates org code + join code) |
| POST | /platform/organizations/{id}/reject | Reject with mandatory reason |
| POST | /platform/organizations/{id}/suspend | Suspend with mandatory reason |
| GET | /platform/stats | Platform-wide statistics (users, orgs, issues) |
| GET | /platform/admins | List all platform admins |
| POST | /platform/admins | Promote user to platform admin |
| DELETE | /platform/admins/{user_id} | Revoke admin (safety: can't revoke self or last admin) |

## Notifications (/api/v1/notifications)

| Method | Path | Description |
|---|---|---|
| GET | /notifications | My notifications (paginated, filterable by is_read) |
| GET | /notifications/unread-count | Unread badge count |
| PATCH | /notifications/{id}/read | Mark single as read |
| PATCH | /notifications/read-all | Mark all as read |

## Health

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/health | Returns status, service name, version |

---

# PART 5 — SECURITY DESIGN

## Authentication Security

| Mechanism | Detail |
|---|---|
| Password Hash | Argon2id via pwdlib — memory-hard, GPU-resistant |
| JWT Algorithm | HS256 — symmetric, server-signed |
| Token Lifetime | 30 minutes (configurable via env var) |
| JWT Claims | sub, exp, iat — all required by decode_access_token() |
| Token Storage | localStorage (XSS risk — known weakness) |
| 401 Handling | resolvex:unauthorized browser event fires → global logout in all tabs |

## Authorization Layers (In Order)

```
Layer 1: Is the request authenticated?
  → get_current_user(): decode JWT, load User from DB, check is_active == True

Layer 2: Is the user a Platform Admin?
  → get_current_platform_admin(): check is_platform_admin flag

Layer 3: Is the user a member of this org?
  → _require_membership(): query memberships table for (org_id, user_id) row

Layer 4: Does the user have sufficient role within the org?
  → Per-endpoint role check: owner, admin, staff, etc.
```

## Database Security

- All PKs are UUID v4 — prevents sequential enumeration attacks
- CASCADE deletes preserve referential integrity
- SET NULL preserves data when a linked user is deleted
- CHECK constraints at DB level enforce enum values as a safety net
- SSL required for all connections (sslmode=require, channel_binding=require)

## Race Condition Prevention

The org approval endpoint uses SELECT ... FOR UPDATE (pessimistic DB lock).
First admin acquires the lock and completes. Second admin waits. This prevents two org codes or two join codes from being generated for the same organization.

## Known Weaknesses and Recommended Fixes

| Weakness | Risk | Fix |
|---|---|---|
| JWT in localStorage | Medium | HttpOnly cookie |
| No rate limiting on auth endpoints | High | slowapi + Redis |
| No refresh tokens | Medium | Add refresh token flow |
| Join code encryption key derived from JWT secret | Medium | Use dedicated encryption key |
| No email verification | Medium | Add email OTP on registration |
| Notifications not real-time | Low | WebSocket or Server-Sent Events |

---

# PART 6 — FRONTEND ARCHITECTURE

## Structure

```
src/
├── App.tsx              ← Root: BrowserRouter + AuthProvider + OrgProvider + all Routes
├── pages/               ← 16 full-page components
├── components/          ← Layouts (OrgLayout, ClientLayout, PlatformAdminLayout)
│                           Guards (OrgGuard, ClientGuard, PlatformAdminGuard)
│                           Shared (LoadingSpinner, etc.)
├── context/
│   ├── AuthContext.tsx  ← Global auth state, login/logout/refreshUser
│   └── OrgContext.tsx   ← Current active organization
├── services/
│   └── api.ts           ← Singleton ApiClient with namespaced methods
├── types/               ← TypeScript interfaces for all domain models
└── test/                ← Vitest + React Testing Library test files
```

## The 16 Pages

LoginPage, RegisterPage, PlatformAdminLoginPage, HomePage, NotificationsPage, OrganizationsPage, ProfilePage, ClientDashboardPage, ClientTicketDetailsPage, OrgDashboardPage, IssueDashboardPage, IssueDetailPage, CreateIssuePage, MembersPage, PlatformAdminPage, NotFoundPage

## Role-Based Routes

```
/login, /register, /platform-admin/login → Public (no auth needed)
/platform-admin/*     → PlatformAdminGuard → PlatformAdminLayout
/org/:orgId/*         → OrgGuard → OrgLayout
/client/*, /home,
/notifications,
/organizations,
/profile              → ClientGuard → ClientLayout
```

## API Client (api.ts)

Single ApiClient class with namespaced method groups:
- api.auth: register, login, platformAdminLogin, getMe
- api.organizations: list, discover, get, create, listMembers, addMember, updateMemberRole, removeMember, joinByCode, getJoinCode, requestOwnershipTransfer, acceptOwnershipTransfer, requestDeletion, cancelDeletion, archive, listMembershipRequests, approveMembershipRequest, rejectMembershipRequest, getMyMembershipRequests
- api.issues: listMine, getMine, listMineComments, addMineComment, listMineActivities, list, get, create, update, assign, listComments, addComment, listActivities
- api.notifications: list, getUnreadCount, markRead, markAllRead
- api.platform: listOrganizations, approveOrg, rejectOrg, suspendOrg, getStats, listAdmins, promoteAdmin, revokeAdmin

Features of the API client:
- JWT token auto-attached to every request as Authorization: Bearer
- 401 responses fire resolvex:unauthorized browser event → global logout
- resolvex:auth-change event for tab synchronization on login/logout
- Errors throw typed ApiError with .status and .details
- Network errors throw ApiError(0, "Unable to connect...")
- 204 No Content returns undefined without parse error

## Dev vs Production URL

Development: VITE_API_BASE_URL defaults to /api/v1 (Vite proxies /api → localhost:8000)
Production: VITE_API_BASE_URL=https://<your-backend>.onrender.com/api/v1 (baked into bundle at build time on Vercel)

---

# PART 7 — WHAT CHANGES WHEN DEPLOYING

## Backend — Development vs Production

| What | Development | Production | How to Change |
|---|---|---|---|
| Database | SQLite test.db | PostgreSQL on Neon | Set DATABASE_URL env var |
| CORS Origins | localhost:3000, 5173 | Vercel frontend URL | Set ALLOWED_ORIGINS env var |
| JWT Secret | Any string | 48+ char random secret | Set JWT_SECRET_KEY env var |
| ASGI Server | uvicorn --reload | uvicorn (no reload) | Dockerfile / Render start command |
| Environment flag | development | production | Set ENVIRONMENT=production |
| API Docs | /docs enabled by default | Consider disabling | Pass docs_url=None to FastAPI() |
| Admin bootstrap | Runs every startup | Idempotent — runs safely every time | No change needed |

## Frontend — Development vs Production

| What | Development | Production | How to Change |
|---|---|---|---|
| API URL | /api/v1 (Vite proxy) | Full backend URL | Set VITE_API_BASE_URL before build in Vercel |
| Server | Vite dev server (HMR) | Vercel Edge CDN (dist/) | vercel.json + Vercel deploy |
| Port | 3000 | HTTPS (443) Edge CDN | Handled automatically by Vercel |

## Environment Variables — Backend (.env)

| Variable | Required | Default | Description |
|---|---|---|---|
| DATABASE_URL | YES | — | PostgreSQL connection string (with +psycopg driver) |
| JWT_SECRET_KEY | YES | — | Signs JWTs + derives Fernet encryption key |
| ACCESS_TOKEN_EXPIRE_MINUTES | No | 30 | JWT lifetime in minutes |
| ALLOWED_ORIGINS | No | localhost | Comma-separated frontend URLs for CORS |
| PLATFORM_ADMIN_EMAIL | No | — | Bootstrap admin on first startup |
| PLATFORM_ADMIN_PASSWORD | No | — | Bootstrap admin password |
| PLATFORM_ADMIN_ALLOWED_DOMAIN | No | — | Restricts admin emails to this domain |
| ENVIRONMENT | No | development | Flag (dev/production) |

## Environment Variables — Frontend (build-time)

| Variable | Required | Description |
|---|---|---|
| VITE_API_BASE_URL | YES in prod | Full URL to backend API root |

## Render + Vercel Deployment — Step by Step

Step 1: Push code to GitHub
  git add . && git commit -m "feat: deployment configuration" && git push origin main

Step 2: Create Backend Web Service on Render
  - New + → Web Service (or Blueprint with render.yaml) → Deploy from GitHub
  - Root Directory: backend
  - Runtime: Python 3
  - Build Command: pip install -r requirements.txt
  - Start Command: alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
  - Set all required environment variables in Environment
  - Health check path: /api/v1/health

Step 3: Deploy backend and verify it is healthy
  - Visit https://<your-backend>.onrender.com/api/v1/health
  - Should return: {"status": "healthy", "service": "ResolveX API", "version": "0.1.0"}

Step 4: Create Frontend Project on Vercel
  - Add New Project → Import GitHub repo
  - Root Directory: frontend
  - Framework Preset: Vite
  - Set VITE_API_BASE_URL = https://<your-backend>.onrender.com/api/v1

Step 5: Deploy frontend and note its URL
  - https://<your-project>.vercel.app

Step 6: Update backend ALLOWED_ORIGINS
  - Go to Render backend service → Environment
  - Set ALLOWED_ORIGINS = https://<your-project>.vercel.app
  - Render auto-redeploys backend

Step 7: Full test
  - /api/v1/health (backend)
  - /docs (API explorer)
  - Frontend loads correctly
  - Login works at /login
  - Platform admin login works at /platform-admin/login

## Docker Architecture — Explained

Backend Dockerfile:
```
FROM python:3.12-slim          ← minimal base
apt install libpq-dev          ← psycopg C library dependency
pip install -r requirements.txt
COPY app source
CMD: alembic upgrade head      ← run migrations before server starts
  && uvicorn app.main:app      ← start API server on $PORT
```

Frontend Dockerfile (multi-stage):
```
Stage 1 BUILD:
  FROM node:22-alpine
  npm ci                       ← clean install, reproducible
  ARG VITE_API_BASE_URL        ← injected from Railway variables
  npm run build                ← Vite compiles TypeScript + bundles

Stage 2 SERVE:
  FROM nginx:1.27-alpine
  apk add gettext              ← for envsubst command
  COPY dist/                   ← the built static files
  COPY nginx.conf as template
  CMD: envsubst '$PORT' < template > nginx config
    && nginx -g 'daemon off;'  ← replace $PORT placeholder then start
```

---

# PART 8 — INTERVIEW QUESTIONS AND ANSWERS

Q: Explain your authentication mechanism.

ResolveX uses stateless JWT authentication. When a user logs in, the server validates credentials using Argon2id password hashing (memory-hard, much stronger than bcrypt against GPU attacks), then returns a signed JWT with HS256. The token contains only a user UUID in the sub claim, with exp and iat. On every request, the get_current_user() FastAPI dependency decodes the token, extracts the UUID, and loads the fresh User record from the database. This means any account changes (like deactivation) take effect within 30 minutes, even without a token blacklist.

---

Q: How do you ensure tenant isolation in a multi-tenant system?

Every table that belongs to an organization has an organization_id foreign key. Isolation is enforced at the API layer through the Membership Guard Pattern. Every organization-scoped endpoint calls _require_membership() which queries the memberships table to verify the authenticated user has a row for that specific organization. If no row exists, we return HTTP 403 immediately before any business logic runs. There is no way to access another org's data without that row.

---

Q: What is the Issue State Machine and why does it matter?

Issues follow a defined lifecycle: open → in_progress → resolved → closed, with one allowed backtrack: resolved → in_progress. Only transitions listed in the ALLOWED_STATUS_TRANSITIONS frozenset are permitted. This prevents data integrity problems like a client marking an issue closed without it ever being resolved. The frozenset check is O(1) and runs before any database write.

---

Q: How do you handle the race condition when two admins approve an org simultaneously?

The approval endpoint uses SELECT ... FOR UPDATE — a pessimistic row-level lock. The first admin acquires the lock and completes the transaction including generating the org code and join code. The second admin's query waits until the first transaction commits, then proceeds. This guarantees exactly one set of codes is generated per organization.

---

Q: Explain your join code security design.

The join code (e.g. RX-A1B2C3D4) is never stored in plaintext. We store it in two forms simultaneously: a SHA-256 hash for fast indexed lookup when a user submits the code, and a Fernet-encrypted version for display back to org owners. The Fernet key is derived from JWT_SECRET_KEY via SHA-256. The key insight is that hashing enables O(1) indexed lookup without decrypting every row, while encryption allows the original code to be recovered for display only.

---

Q: Why UUID primary keys instead of auto-increment integers?

Sequential integers are an enumeration attack vector. An attacker who can probe GET /issues/1, /issues/2, etc. can discover record existence even if the data is hidden. UUIDs are 128-bit random values — unpredictable and non-sequential. Even if authorization fails on a particular request, no information about record counts or IDs leaks to the attacker.

---

Q: How do notifications work without blocking the API response?

Notification creation uses FastAPI's BackgroundTasks. The HTTP response is sent to the client immediately, and notification logic runs asynchronously in a background thread afterward. Each background task opens its own independent SQLAlchemy session, so a crash in notification creation never rolls back the issue transaction. This design is explicitly documented in the notifications service docstring.

---

Q: What is optimistic locking and where is it used in ResolveX?

The Issue model has a version field (integer starting at 1). When an update is submitted, the client includes the version it last read. The server verifies issue.version == submitted_version before applying changes. If they differ, another update happened concurrently and the server returns 409 Conflict, telling the client to reload and retry. This prevents lost updates in concurrent editing without holding a database lock.

---

Q: What would you improve if you had more time?

The most important improvements are: moving JWT to HttpOnly cookies to prevent XSS token theft; adding rate limiting on auth endpoints with slowapi and Redis; implementing a refresh token mechanism so access tokens can be much shorter-lived; using WebSocket or SSE for real-time notifications instead of client polling; and adding email verification on registration. On the infrastructure side, I would add a Redis cache layer and pin all Python dependencies with pip freeze.

---

Q: How does the frontend handle 401 unauthorized responses globally?

The API client fires a custom browser event called resolvex:unauthorized whenever any request receives a 401 response. The AuthContext component listens to this event at mount time and clears the user state when it fires, which triggers React Router to redirect to the login page. This means any component in the entire application — even deep nested ones — triggers a clean logout automatically without each component needing to handle 401 itself.

---

Q: How do you run database migrations automatically on deployment?

The backend start command / Dockerfile CMD is: alembic upgrade head && uvicorn app.main:app. Before Uvicorn starts accepting traffic, Alembic runs all pending migrations. The health check waits for /api/v1/health to return 200 before routing live traffic to the service, so migrations always finish completely before the first real request is processed.

---

Q: Explain how the Vite development proxy works and why it matters.

In development, vite.config.ts configures a proxy: any request to /api is forwarded to http://127.0.0.1:8000. This makes the frontend and backend appear to be on the same origin (localhost:3000) from the browser's perspective, which eliminates CORS entirely during development. In production this proxy does not exist. Instead, VITE_API_BASE_URL is baked into the compiled JavaScript bundle at build time pointing to the real backend URL, and CORS is handled on the backend via the ALLOWED_ORIGINS environment variable.

---

# PART 9 — FUTURE IMPROVEMENTS ROADMAP

## High Priority

- Email verification on signup (need SMTP: Resend or SendGrid)
- Password reset flow via email OTP
- Refresh token mechanism (access tokens currently 30 min)
- Rate limiting on authentication endpoints (slowapi + Redis)
- HttpOnly cookie for JWT storage (eliminates XSS risk)

## Medium Priority

- Real-time notifications via WebSocket or Server-Sent Events
- File attachments on issues (S3 or Cloudflare R2)
- Issue labels and tags for flexible categorization
- Organization analytics dashboard
- Cursor-based pagination (scales better than offset at high record counts)
- Separate Fernet encryption key for join codes

## Low Priority

- Bulk issue operations (multi-select, bulk status update)
- Dark/light mode toggle persisted in user preferences
- Webhook delivery to external systems
- Custom issue categories per organization
- SLA tracking (time-to-first-response, time-to-resolution)

## Infrastructure

- Redis layer for caching, rate limiting, session data
- CDN (CloudFlare) in front of Railway frontend
- PgBouncer for PostgreSQL connection pooling at high scale
- Automated uptime monitoring (UptimeRobot or Railway built-in)
- Staging environment separate from production

---

# PART 10 — QUICK REFERENCE

## Roles Hierarchy (Highest to Lowest)
platform_admin > owner > admin > manager > staff > member > client

## Issue Priority
urgent > high > medium > low

## Issue Status Flow
open → in_progress → resolved → closed (resolved can go back to in_progress)

## Org Verification Status
pending → approved → suspended
pending → rejected

## Key Table Relationships
User has many Memberships (to Organizations)
User has many MembershipRequests
Organization has many Issues
Issue has many Comments
Issue has many IssueActivities
User has many Notifications

## API Roots
Dev Backend:   http://localhost:8000/api/v1
Dev Frontend:  http://localhost:3000
Prod Backend:  https://<your-backend>.onrender.com/api/v1
API Docs:      https://<your-backend>.onrender.com/docs
Health Check:  https://<your-backend>.onrender.com/api/v1/health

## Useful Commands

Generate a strong JWT secret (run in Python):
  import secrets; print(secrets.token_urlsafe(48))

Run backend locally:
  cd backend && .venv\Scripts\activate && uvicorn app.main:app --reload --port 8000

Run frontend locally:
  cd frontend && npm run dev

Run full stack with Docker:
  docker compose up --build

Apply all pending migrations:
  cd backend && alembic upgrade head

Create a new migration after model changes:
  cd backend && alembic revision --autogenerate -m "describe the change"

Pin Python dependencies:
  cd backend && pip freeze > requirements.txt

Build frontend for production:
  cd frontend && npm run build

---

End of ResolveX Technical Documentation — Version 1.0 — October 2026
