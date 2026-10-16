"""
In-app Notification endpoints.

Endpoints:
  GET   /api/v1/notifications                              — paginated list (current user only)
  GET   /api/v1/notifications/unread-count                 — count of unread notifications
  PATCH /api/v1/notifications/{notification_id}/read       — mark a single notification read
  PATCH /api/v1/notifications/read-all                     — mark all notifications read

Security:
  - All endpoints require a valid JWT (current_user dependency).
  - Users can only read or modify their OWN notifications.
  - No cross-user or cross-tenant data leakage.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models.notification import Notification
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.notification import (
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ---------------------------------------------------------------------------
# GET /notifications — paginated list for the current user
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=NotificationListResponse,
    summary="List notifications for the current user",
)
def list_notifications(
    is_read: bool | None = Query(None, description="Filter by read status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationListResponse:
    """
    Return paginated notifications for the authenticated user, newest first.
    Optionally filter by read/unread status.
    """
    query = select(Notification).where(
        Notification.recipient_id == current_user.id,
    )

    if is_read is not None:
        query = query.where(Notification.is_read.is_(is_read))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    offset = (page - 1) * page_size
    notifications = db.scalars(
        query
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .offset(offset)
        .limit(page_size)
    ).unique().all()

    return NotificationListResponse(
        notifications=list(notifications),
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# GET /notifications/unread-count — must be declared BEFORE /{notification_id}
# ---------------------------------------------------------------------------

@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    summary="Get count of unread notifications for the current user",
)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UnreadCountResponse:
    """Return the number of unread notifications for the authenticated user."""
    count = db.scalar(
        select(func.count(Notification.id)).where(
            Notification.recipient_id == current_user.id,
            Notification.is_read.is_(False),
        )
    ) or 0
    return UnreadCountResponse(unread_count=count)


# ---------------------------------------------------------------------------
# PATCH /notifications/read-all — mark all notifications read (before /{id})
# ---------------------------------------------------------------------------

@router.patch(
    "/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark all notifications as read",
)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Mark every unread notification for the authenticated user as read."""
    db.execute(
        update(Notification)
        .where(
            Notification.recipient_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .values(is_read=True)
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# PATCH /notifications/{notification_id}/read — mark single notification read
# ---------------------------------------------------------------------------

@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark a specific notification as read",
)
def mark_notification_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationResponse:
    """
    Mark a single notification as read.
    Returns 404 if the notification does not exist OR belongs to another user.
    """
    notification = db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_id == current_user.id,
        )
    )
    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    if not notification.is_read:
        notification.is_read = True
        db.commit()
        db.refresh(notification)

    return notification
