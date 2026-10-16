"""
Issue/Ticket, Activity/Audit, and Comment API routes.

Endpoints:
  POST  /api/v1/organizations/{org_id}/issues                           — create issue
  GET   /api/v1/organizations/{org_id}/issues                           — list issues (filters, sort, pagination)
  GET   /api/v1/organizations/{org_id}/issues/{issue_id}                — get single issue
  PATCH /api/v1/organizations/{org_id}/issues/{issue_id}                — update permitted fields (state machine, audit log, optimistic locking)
  POST  /api/v1/organizations/{org_id}/issues/{issue_id}/assign         — assign/unassign issue (audit log)
  GET   /api/v1/organizations/{org_id}/issues/{issue_id}/activities     — list activities/audit log (chronological, paginated)
  POST  /api/v1/organizations/{org_id}/issues/{issue_id}/comments       — add comment
  GET   /api/v1/organizations/{org_id}/issues/{issue_id}/comments       — list comments with pagination
"""
from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models.activity import IssueActivity
from app.db.models.comment import Comment
from app.db.models.issue import Issue
from app.db.models.membership import Membership
from app.db.models.organization import Organization
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.issue import (
    ActivityListResponse,
    CommentCreate,
    CommentListResponse,
    CommentResponse,
    IssueAssignRequest,
    IssueCreate,
    IssueListResponse,
    IssueResponse,
    IssueUpdate,
)
from app.services.notifications import (
    notify_comment_added,
    notify_issue_assigned,
    notify_issue_status_changed,
)

router = APIRouter(prefix="/organizations/{org_id}/issues", tags=["Issues"])

ALLOWED_STATUS_TRANSITIONS = frozenset({
    ("open", "in_progress"),
    ("in_progress", "resolved"),
    ("resolved", "closed"),
    ("resolved", "in_progress"),
})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_org_and_membership(
    db: Session,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
) -> tuple[Organization, Membership]:
    """
    Ensure the organization exists and the current user is an active member.
    Enforces server-side tenant isolation.
    """
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    membership = db.scalar(
        select(Membership).where(
            Membership.organization_id == org_id,
            Membership.user_id == user_id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this organization",
        )

    return org, membership


def _generate_issue_key(db: Session, org: Organization) -> tuple[int, str]:
    """
    Generate the next sequential issue number and human-readable issue key
    within the organization.
    """
    max_number = db.scalar(
        select(func.coalesce(func.max(Issue.issue_number), 0))
        .where(Issue.organization_id == org.id)
    )
    next_number = (max_number or 0) + 1
    prefix = re.sub(r"[^A-Za-z0-9]", "", org.slug).upper()[:6] or "ISSUE"
    return next_number, f"{prefix}-{next_number}"


# ---------------------------------------------------------------------------
# Issue CRUD Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=IssueResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an issue",
)
def create_issue(
    org_id: uuid.UUID,
    data: IssueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IssueResponse:
    """
    Any verified organization membership can create an issue from the
    authenticated user's client experience.
    - Reporter is automatically set to the current user.
    - Assignee (if provided) must be a member of the same organization.
    """
    org, _ = _require_org_and_membership(db, org_id, current_user.id)

    if data.assignee_id is not None:
        assignee_membership = db.scalar(
            select(Membership).where(
                Membership.organization_id == org_id,
                Membership.user_id == data.assignee_id,
            )
        )
        if assignee_membership is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignee must be an active member of this organization",
            )

    next_number, issue_key = _generate_issue_key(db, org)

    issue = Issue(
        id=uuid.uuid4(),
        organization_id=org_id,
        issue_number=next_number,
        issue_key=issue_key,
        title=data.title,
        description=data.description,
        category=data.category,
        priority=data.priority,
        status="open",
        reporter_id=current_user.id,
        assignee_id=data.assignee_id,
        version=1,
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return issue


@router.get(
    "",
    response_model=IssueListResponse,
    summary="List issues with filters, sorting, and pagination",
)
def list_issues(
    org_id: uuid.UUID,
    status_filter: str | None = Query(None, alias="status", description="Filter by status (open, in_progress, resolved, closed)"),
    priority_filter: str | None = Query(None, alias="priority", description="Filter by priority (low, medium, high, urgent)"),
    category: str | None = Query(None, description="Filter by category"),
    assignee_id: uuid.UUID | None = Query(None, description="Filter by assignee user ID"),
    reporter_id: uuid.UUID | None = Query(None, description="Filter by reporter user ID"),
    search: str | None = Query(None, description="Search keyword in title or description"),
    sort_by: str = Query("created_at", pattern="^(created_at|updated_at|priority|status|issue_number)$", description="Field to sort by"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$", description="Sort direction"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IssueListResponse:
    """
    List issues within the organization. Only accessible to organization members.
    Supports filtering by status, priority, category, assignee, reporter, search, sorting, and pagination.
    """
    _, membership = _require_org_and_membership(db, org_id, current_user.id)

    query = select(Issue).where(Issue.organization_id == org_id)

    # Clients/reporters can only see their own issues
    if membership.role == "client":
        query = query.where(Issue.reporter_id == current_user.id)

    if status_filter:
        query = query.where(Issue.status == status_filter.strip().lower())
    if priority_filter:
        query = query.where(Issue.priority == priority_filter.strip().lower())
    if category:
        query = query.where(Issue.category == category.strip().lower())
    if assignee_id:
        query = query.where(Issue.assignee_id == assignee_id)
    if reporter_id:
        query = query.where(Issue.reporter_id == reporter_id)
    if search:
        search_term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(Issue.title).like(search_term),
                func.lower(Issue.description).like(search_term),
            )
        )

    # Count total matching issues
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    # Deterministic sorting
    sort_col = getattr(Issue, sort_by)
    order_clause = sort_col.asc() if sort_dir == "asc" else sort_col.desc()
    offset = (page - 1) * page_size

    query = query.order_by(order_clause, Issue.id.desc()).offset(offset).limit(page_size)
    issues = db.scalars(query).unique().all()

    return IssueListResponse(
        issues=list(issues),
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{issue_id}",
    response_model=IssueResponse,
    summary="Get single issue details",
)
def get_issue(
    org_id: uuid.UUID,
    issue_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IssueResponse:
    """
    Retrieve an issue by ID. Tenant isolation is strictly enforced.
    """
    _, membership = _require_org_and_membership(db, org_id, current_user.id)

    issue = db.scalar(
        select(Issue).where(
            Issue.id == issue_id,
            Issue.organization_id == org_id,
        )
    )
    if issue is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found",
        )

    if membership.role == "client" and issue.reporter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clients can only view issues they reported",
        )

    return issue


@router.patch(
    "/{issue_id}",
    response_model=IssueResponse,
    summary="Update permitted fields of an issue",
)
def update_issue(
    org_id: uuid.UUID,
    issue_id: uuid.UUID,
    data: IssueUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IssueResponse:
    """
    Update permitted fields of an issue with optimistic concurrency control,
    state machine validation, and transactional audit logging.
    """
    _, membership = _require_org_and_membership(db, org_id, current_user.id)

    issue = db.scalar(
        select(Issue).where(
            Issue.id == issue_id,
            Issue.organization_id == org_id,
        )
    )
    if issue is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found",
        )

    if membership.role == "client" and issue.reporter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clients can only update issues they reported",
        )

    is_management = membership.role in ("owner", "admin", "manager")
    is_staff = membership.role == "staff"
    is_reporter = issue.reporter_id == current_user.id
    is_assignee = issue.assignee_id == current_user.id

    # Specific permission check if status transition is requested
    if data.status is not None and data.status != issue.status:
        if data.status == "closed":
            if not (is_management or is_staff):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only staff, managers, admins, and owners can close issues",
                )
        elif issue.status == "resolved" and data.status == "in_progress":
            if not (is_management or is_staff or is_reporter or is_assignee):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the reporter, assignee, staff, or management can reopen this issue",
                )
        elif issue.status == "open" and data.status == "in_progress":
            if not (is_management or is_staff or is_assignee):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only staff, managers, or the assignee can start progress on this issue",
                )
        elif issue.status == "in_progress" and data.status == "resolved":
            if not (is_management or is_staff or is_assignee):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only staff, managers, or the assignee can resolve this issue",
                )

    # General permission check: caller must have at least one valid role/relation to the issue
    if not (is_management or is_staff or is_reporter or is_assignee):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this issue",
        )

    # Optimistic concurrency control check
    if data.version is not None and issue.version != data.version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Issue was modified concurrently by another user. Please refresh and try again.",
        )

    # Content fields permission check (title, description, category)
    if (data.title is not None or data.description is not None or data.category is not None) and not (is_management or is_reporter):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the reporter or managers can edit issue details",
        )

    has_real_change = False

    # Apply content changes
    if data.title is not None and data.title != issue.title:
        issue.title = data.title
        has_real_change = True

    if data.description is not None and data.description != issue.description:
        issue.description = data.description
        has_real_change = True

    if data.category is not None and data.category != issue.category:
        issue.category = data.category
        has_real_change = True

    # Priority change with permission and activity logging
    if data.priority is not None and data.priority != issue.priority:
        if not is_management:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only managers, admins, and owners can change issue priority",
            )
        activity = IssueActivity(
            id=uuid.uuid4(),
            organization_id=org_id,
            issue_id=issue.id,
            actor_id=current_user.id,
            action="priority_change",
            old_value=issue.priority,
            new_value=data.priority,
            details=None,
        )
        db.add(activity)
        issue.priority = data.priority
        has_real_change = True

    # Status state machine validation, permission check, and activity logging
    _status_changed = False
    _old_status: str | None = None
    if data.status is not None and data.status != issue.status:
        transition = (issue.status, data.status)
        if transition not in ALLOWED_STATUS_TRANSITIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid status transition from '{issue.status}' to '{data.status}'. "
                    "Allowed transitions: open -> in_progress, in_progress -> resolved, "
                    "resolved -> closed, resolved -> in_progress."
                ),
            )

        resolution_note = None
        if data.status == "resolved":
            resolution_note = (data.resolution_note or "").strip()
            if not resolution_note:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A non-empty resolution note is required when resolving an issue",
                )
            issue.resolution_note = resolution_note

        activity = IssueActivity(
            id=uuid.uuid4(),
            organization_id=org_id,
            issue_id=issue.id,
            actor_id=current_user.id,
            action="status_change",
            old_value=issue.status,
            new_value=data.status,
            details=resolution_note,
        )
        db.add(activity)
        _old_status = issue.status
        issue.status = data.status
        _status_changed = True
        has_real_change = True

    if has_real_change:
        issue.version += 1

    # Notify status change (inline, same transaction — safe to fail with issue)
    if _status_changed and _old_status is not None:
        notify_issue_status_changed(
            db,
            org_id=org_id,
            issue_id=issue.id,
            issue_key=issue.issue_key,
            issue_title=issue.title,
            actor_id=current_user.id,
            actor_name=current_user.full_name,
            old_status=_old_status,
            new_status=issue.status,
            reporter_id=issue.reporter_id,
            assignee_id=issue.assignee_id,
        )

    db.commit()
    db.refresh(issue)
    return issue


@router.post(
    "/{issue_id}/assign",
    response_model=IssueResponse,
    summary="Assign an issue to an organization member",
)
def assign_issue(
    org_id: uuid.UUID,
    issue_id: uuid.UUID,
    data: IssueAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IssueResponse:
    """
    Assign or unassign an issue.
    - Only owners, admins, and managers can assign issues.
    - Assignee must be an active member of the same organization.
    - Records assignment_change in activity log only when a real change occurs.
    """
    _, membership = _require_org_and_membership(db, org_id, current_user.id)

    if membership.role not in ("owner", "admin", "manager"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers, admins, and owners can assign issues",
        )

    issue = db.scalar(
        select(Issue).where(
            Issue.id == issue_id,
            Issue.organization_id == org_id,
        )
    )
    if issue is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found",
        )

    if data.assignee_id is not None:
        assignee_membership = db.scalar(
            select(Membership).where(
                Membership.organization_id == org_id,
                Membership.user_id == data.assignee_id,
            )
        )
        if assignee_membership is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignee must be an active member of this organization",
            )

    # Log activity + notify only when real change occurs
    if data.assignee_id != issue.assignee_id:
        old_assignee_id = issue.assignee_id
        old_val = str(issue.assignee_id) if issue.assignee_id else None
        new_val = str(data.assignee_id) if data.assignee_id else None
        activity = IssueActivity(
            id=uuid.uuid4(),
            organization_id=org_id,
            issue_id=issue.id,
            actor_id=current_user.id,
            action="assignment_change",
            old_value=old_val,
            new_value=new_val,
            details=f"Assigned to {data.assignee_id}" if data.assignee_id else "Unassigned",
        )
        db.add(activity)
        issue.assignee_id = data.assignee_id
        issue.version += 1

        # Notify inline, same transaction
        notify_issue_assigned(
            db,
            org_id=org_id,
            issue_id=issue.id,
            issue_key=issue.issue_key,
            issue_title=issue.title,
            actor_id=current_user.id,
            actor_name=current_user.full_name,
            new_assignee_id=data.assignee_id,
            old_assignee_id=old_assignee_id,
        )

    db.commit()
    db.refresh(issue)
    return issue


# ---------------------------------------------------------------------------
# Activity / Audit Trail Endpoint
# ---------------------------------------------------------------------------

@router.get(
    "/{issue_id}/activities",
    response_model=ActivityListResponse,
    summary="List chronological activities/audit trail for an issue",
)
def list_activities(
    org_id: uuid.UUID,
    issue_id: uuid.UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ActivityListResponse:
    """
    List chronological audit records for an issue.
    - Accessible only to organization members.
    - Verified issue belongs to target organization (tenant isolation).
    - Immutable: No editing or deletion is permitted.
    """
    _, membership = _require_org_and_membership(db, org_id, current_user.id)

    issue = db.scalar(
        select(Issue).where(
            Issue.id == issue_id,
            Issue.organization_id == org_id,
        )
    )
    if issue is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found",
        )

    if membership.role == "client" and issue.reporter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clients can only view activities on their own reported issues",
        )

    total = db.scalar(
        select(func.count(IssueActivity.id)).where(
            IssueActivity.issue_id == issue_id,
            IssueActivity.organization_id == org_id,
        )
    ) or 0

    offset = (page - 1) * page_size
    activities = db.scalars(
        select(IssueActivity)
        .where(
            IssueActivity.issue_id == issue_id,
            IssueActivity.organization_id == org_id,
        )
        .order_by(IssueActivity.created_at.asc(), IssueActivity.id.asc())
        .offset(offset)
        .limit(page_size)
    ).unique().all()

    return ActivityListResponse(
        activities=list(activities),
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# Comment Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/{issue_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a comment to an issue",
)
def add_comment(
    org_id: uuid.UUID,
    issue_id: uuid.UUID,
    data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentResponse:
    """
    Add a comment to an issue. Any member of the organization can comment on an issue.
    Posting a comment does NOT alter issue status.
    """
    _, membership = _require_org_and_membership(db, org_id, current_user.id)

    issue = db.scalar(
        select(Issue).where(
            Issue.id == issue_id,
            Issue.organization_id == org_id,
        )
    )
    if issue is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found",
        )

    if membership.role == "client" and issue.reporter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clients can only comment on their own reported issues",
        )

    comment = Comment(
        id=uuid.uuid4(),
        organization_id=org_id,
        issue_id=issue_id,
        author_id=current_user.id,
        content=data.content,
    )
    db.add(comment)

    # Notify reporter and assignee about new comment (inline, same transaction)
    notify_comment_added(
        db,
        org_id=org_id,
        issue_id=issue.id,
        issue_key=issue.issue_key,
        issue_title=issue.title,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        reporter_id=issue.reporter_id,
        assignee_id=issue.assignee_id,
        commenter_role=membership.role,
        comment_id=comment.id,
        comment_preview=comment.content,
    )

    db.commit()
    db.refresh(comment)
    return comment


@router.get(
    "/{issue_id}/comments",
    response_model=CommentListResponse,
    summary="List comments for an issue",
)
def list_comments(
    org_id: uuid.UUID,
    issue_id: uuid.UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentListResponse:
    """
    List comments for an issue with pagination, ordered chronologically.
    """
    _, membership = _require_org_and_membership(db, org_id, current_user.id)

    issue = db.scalar(
        select(Issue).where(
            Issue.id == issue_id,
            Issue.organization_id == org_id,
        )
    )
    if issue is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found",
        )

    if membership.role == "client" and issue.reporter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clients can only view comments on their own reported issues",
        )

    total = db.scalar(
        select(func.count(Comment.id)).where(
            Comment.issue_id == issue_id,
            Comment.organization_id == org_id,
        )
    ) or 0

    offset = (page - 1) * page_size
    comments = db.scalars(
        select(Comment)
        .where(
            Comment.issue_id == issue_id,
            Comment.organization_id == org_id,
        )
        .order_by(Comment.created_at.asc())
        .offset(offset)
        .limit(page_size)
    ).unique().all()

    return CommentListResponse(
        comments=list(comments),
        total=total,
        page=page,
        page_size=page_size,
    )
