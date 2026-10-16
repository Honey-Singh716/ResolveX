"""
Client-scoped issue endpoints.
Allows authenticated clients to list their own reported tickets across all organizations.
"""
from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, Query
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
    IssueListResponse,
    IssueResponse,
)
from app.services.notifications import notify_comment_added

router = APIRouter(prefix="/issues", tags=["Client Issues"])


@router.get(
    "/mine",
    response_model=IssueListResponse,
    summary="List issues reported by the current user across organizations",
)
def list_my_issues(
    status_filter: str | None = Query(None, alias="status", description="Filter by status (open, in_progress, resolved, closed)"),
    priority_filter: str | None = Query(None, alias="priority", description="Filter by priority"),
    search: str | None = Query(None, description="Search term matching title or description"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IssueListResponse:
    query = select(Issue).where(Issue.reporter_id == current_user.id)

    if status_filter:
        query = query.where(Issue.status == status_filter.strip().lower())
    if priority_filter:
        query = query.where(Issue.priority == priority_filter.strip().lower())
    if search:
        search_term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(Issue.title).like(search_term),
                func.lower(Issue.description).like(search_term),
                func.lower(Issue.issue_key).like(search_term),
            )
        )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    offset = (page - 1) * page_size
    issues = db.scalars(
        query.order_by(Issue.created_at.desc(), Issue.id.desc()).offset(offset).limit(page_size)
    ).all()

    return IssueListResponse(
        issues=list(issues),
        total=total,
        page=page,
        page_size=page_size,
    )


def _get_owned_issue(
    db: Session,
    issue_id: uuid.UUID,
    current_user: User,
) -> tuple[Issue, Membership, Organization]:
    issue = db.scalar(
        select(Issue).where(
            Issue.id == issue_id,
            Issue.reporter_id == current_user.id,
        )
    )
    if issue is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    membership = db.scalar(
        select(Membership).where(
            Membership.organization_id == issue.organization_id,
            Membership.user_id == current_user.id,
        )
    )
    if membership is None:
        raise HTTPException(status_code=403, detail="You do not have access to this ticket")

    organization = db.get(Organization, issue.organization_id)
    if organization is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return issue, membership, organization


@router.get(
    "/mine/{issue_id}",
    response_model=IssueResponse,
    summary="Get a ticket reported by the current user",
)
def get_my_issue(
    issue_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IssueResponse:
    issue, _, _ = _get_owned_issue(db, issue_id, current_user)
    return issue


@router.get(
    "/mine/{issue_id}/comments",
    response_model=CommentListResponse,
    summary="List comments for a ticket reported by the current user",
)
def list_my_issue_comments(
    issue_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentListResponse:
    issue, _, _ = _get_owned_issue(db, issue_id, current_user)
    query = select(Comment).where(Comment.issue_id == issue.id)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    comments = db.scalars(
        query.order_by(Comment.created_at.asc(), Comment.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).unique().all()
    return CommentListResponse(comments=list(comments), total=total, page=page, page_size=page_size)


@router.post(
    "/mine/{issue_id}/comments",
    response_model=CommentResponse,
    status_code=201,
    summary="Add a comment to a ticket reported by the current user",
)
def add_my_issue_comment(
    issue_id: uuid.UUID,
    data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentResponse:
    issue, membership, _ = _get_owned_issue(db, issue_id, current_user)
    comment = Comment(
        id=uuid.uuid4(),
        organization_id=issue.organization_id,
        issue_id=issue.id,
        author_id=current_user.id,
        content=data.content,
    )
    db.add(comment)
    notify_comment_added(
        db,
        org_id=issue.organization_id,
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
    "/mine/{issue_id}/activities",
    response_model=ActivityListResponse,
    summary="List permitted activity history for a ticket reported by the current user",
)
def list_my_issue_activities(
    issue_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ActivityListResponse:
    issue, _, _ = _get_owned_issue(db, issue_id, current_user)
    query = select(IssueActivity).where(IssueActivity.issue_id == issue.id)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    activities = db.scalars(
        query.order_by(IssueActivity.created_at.asc(), IssueActivity.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).unique().all()
    return ActivityListResponse(activities=list(activities), total=total, page=page, page_size=page_size)
