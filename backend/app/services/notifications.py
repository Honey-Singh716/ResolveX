"""
Notification service for ResolveX.

Design decisions:
- All notification creation runs *inside* or *after* the calling transaction,
  never before (to avoid phantom notifications for rolled-back operations).
- Trigger functions accept an open SQLAlchemy Session and flush notifications
  but do NOT commit; the caller controls the transaction boundary.
- Delivery logic is intentionally absent here; a future email/push adapter
  can hook into the `Notification` rows or an event bus without touching this
  service.
- Self-notifications are suppressed: users are never notified about their own
  actions.
- Duplicate-recipient guards: we deduplicate recipient sets before insertion.
- Only active organization members receive notifications.

Safe transaction strategy:
  The background-task helpers (_dispatch_*) open their OWN short-lived
  session using the same session factory and commit independently so that
  any error in notification creation never corrupts the issue transaction.
  The issue endpoint uses FastAPI BackgroundTasks which run after the
  response is sent.
"""
from __future__ import annotations

import logging
import uuid
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.membership import Membership
from app.db.models.notification import Notification
from app.db.models.user import User

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _active_member_ids(
    db: Session,
    org_id: uuid.UUID,
) -> list[uuid.UUID]:
    """Return user IDs of all active members of the organization."""
    rows = db.scalars(
        select(Membership.user_id).where(
            Membership.organization_id == org_id,
        )
    ).all()
    # Filter to only active users
    if not rows:
        return []
    active = db.scalars(
        select(User.id).where(
            User.id.in_(rows),
            User.is_active.is_(True),
        )
    ).all()
    return list(active)


def _bulk_create(
    db: Session,
    *,
    organization_id: uuid.UUID,
    issue_id: uuid.UUID | None,
    actor_id: uuid.UUID | None,
    notification_type: str,
    title: str,
    message: str,
    recipient_ids: Iterable[uuid.UUID],
    exclude_actor: bool = True,
    target_path: str | None = None,
    source_comment_id: uuid.UUID | None = None,
) -> None:
    """
    Flush (but don't commit) notification rows for each unique recipient.
    Silently skips actor if exclude_actor is True.
    """
    seen: set[uuid.UUID] = set()
    for rid in recipient_ids:
        if rid in seen:
            continue
        seen.add(rid)
        if exclude_actor and rid == actor_id:
            continue
        if source_comment_id is not None:
            existing = db.scalar(
                select(Notification).where(
                    Notification.source_comment_id == source_comment_id,
                    Notification.recipient_id == rid,
                    Notification.type == notification_type,
                )
            )
            if existing is not None:
                continue

        n = Notification(
            id=uuid.uuid4(),
            organization_id=organization_id,
            recipient_id=rid,
            actor_id=actor_id,
            issue_id=issue_id,
            target_path=target_path,
            source_comment_id=source_comment_id,
            type=notification_type,
            title=title,
            message=message,
            is_read=False,
        )
        db.add(n)


# ---------------------------------------------------------------------------
# Trigger functions (called by background tasks via a fresh session)
# ---------------------------------------------------------------------------

def notify_issue_assigned(
    db: Session,
    *,
    org_id: uuid.UUID,
    issue_id: uuid.UUID,
    issue_key: str,
    issue_title: str,
    actor_id: uuid.UUID,
    actor_name: str,
    new_assignee_id: uuid.UUID | None,
    old_assignee_id: uuid.UUID | None,
) -> None:
    """
    Notify on assignment/unassignment.
    - When assigning: notify the new assignee (skip if assigning to self).
    - When unassigning: notify the old assignee (skip if actor is the old assignee).
    Both cases also notify all managers/admins/owners for visibility.
    """
    management_ids = db.scalars(
        select(Membership.user_id).where(
            Membership.organization_id == org_id,
            Membership.role.in_(("owner", "admin", "manager")),
        )
    ).all()
    # Filter to active users
    active_mgmt: set[uuid.UUID] = set()
    if management_ids:
        rows = db.scalars(
            select(User.id).where(
                User.id.in_(management_ids),
                User.is_active.is_(True),
            )
        ).all()
        active_mgmt = set(rows)

    if new_assignee_id is not None:
        # Assignment
        recipients = {new_assignee_id} | active_mgmt
        _bulk_create(
            db,
            organization_id=org_id,
            issue_id=issue_id,
            actor_id=actor_id,
            notification_type="issue_assigned",
            title=f"Issue assigned: {issue_key}",
            message=f"{actor_name} assigned {issue_key} \"{issue_title}\" to you.",
            recipient_ids=recipients,
            exclude_actor=True,
        )
    else:
        # Unassignment
        recipients = active_mgmt.copy()
        if old_assignee_id:
            recipients.add(old_assignee_id)
        _bulk_create(
            db,
            organization_id=org_id,
            issue_id=issue_id,
            actor_id=actor_id,
            notification_type="issue_unassigned",
            title=f"Issue unassigned: {issue_key}",
            message=f"{actor_name} removed the assignee from {issue_key} \"{issue_title}\".",
            recipient_ids=recipients,
            exclude_actor=True,
        )


def notify_issue_status_changed(
    db: Session,
    *,
    org_id: uuid.UUID,
    issue_id: uuid.UUID,
    issue_key: str,
    issue_title: str,
    actor_id: uuid.UUID,
    actor_name: str,
    old_status: str,
    new_status: str,
    reporter_id: uuid.UUID | None,
    assignee_id: uuid.UUID | None,
) -> None:
    """
    Notify reporter, assignee, and management when issue status changes.
    """
    management_ids = db.scalars(
        select(Membership.user_id).where(
            Membership.organization_id == org_id,
            Membership.role.in_(("owner", "admin", "manager")),
        )
    ).all()

    recipient_ids: set[uuid.UUID] = set(management_ids)
    if reporter_id:
        recipient_ids.add(reporter_id)
    if assignee_id:
        recipient_ids.add(assignee_id)

    # Filter to active users only
    if recipient_ids:
        active = db.scalars(
            select(User.id).where(
                User.id.in_(recipient_ids),
                User.is_active.is_(True),
            )
        ).all()
        recipient_ids = set(active)

    status_label = new_status.replace("_", " ").title()
    _bulk_create(
        db,
        organization_id=org_id,
        issue_id=issue_id,
        actor_id=actor_id,
        notification_type="issue_status_changed",
        title=f"Issue {status_label}: {issue_key}",
        message=(
            f"{actor_name} changed the status of {issue_key} "
            f"\"{issue_title}\" from '{old_status}' to '{new_status}'."
        ),
        recipient_ids=recipient_ids,
        exclude_actor=True,
    )


def notify_comment_added(
    db: Session,
    *,
    org_id: uuid.UUID,
    issue_id: uuid.UUID,
    issue_key: str,
    issue_title: str,
    actor_id: uuid.UUID,
    actor_name: str,
    reporter_id: uuid.UUID | None,
    assignee_id: uuid.UUID | None,
    commenter_role: str,
    comment_id: uuid.UUID,
    comment_preview: str,
) -> None:
    """
    Notify reporter and assignee about a new comment (excluding the commenter).
    """
    recipient_ids: set[uuid.UUID] = set()
    if reporter_id:
        recipient_ids.add(reporter_id)
    if assignee_id:
        recipient_ids.add(assignee_id)

    # Filter to active users only
    if recipient_ids:
        active = db.scalars(
            select(User.id).where(
                User.id.in_(recipient_ids),
                User.is_active.is_(True),
            )
        ).all()
        recipient_ids = set(active)

    preview = comment_preview.strip().replace("\r", " ").replace("\n", " ")
    if len(preview) > 180:
        preview = f"{preview[:177]}..."
    message = (
        f'{actor_name} ({commenter_role.title()}) commented on '
        f'{issue_key} — "{issue_title}": "{preview}"'
    )

    if reporter_id:
        _bulk_create(
            db,
            organization_id=org_id,
            issue_id=issue_id,
            actor_id=actor_id,
            notification_type="comment_added",
            title=f"New comment on {issue_key}",
            message=message,
            recipient_ids=(reporter_id,),
            exclude_actor=True,
            target_path=f"/client/tickets/{issue_id}",
            source_comment_id=comment_id,
        )

    other_recipients = {rid for rid in recipient_ids if rid != reporter_id}
    _bulk_create(
        db,
        organization_id=org_id,
        issue_id=issue_id,
        actor_id=actor_id,
        notification_type="comment_added",
        title=f"New comment on {issue_key}",
        message=message,
        recipient_ids=other_recipients,
        exclude_actor=True,
        source_comment_id=comment_id,
    )


# ---------------------------------------------------------------------------
# Background task wrappers (open their own session; errors are logged, not raised)
# ---------------------------------------------------------------------------

def _get_session_factory():
    """Lazy import to avoid circular dependency."""
    from app.db.session import SessionLocal  # noqa: PLC0415
    return SessionLocal


def run_notify_issue_assigned(
    *,
    org_id: uuid.UUID,
    issue_id: uuid.UUID,
    issue_key: str,
    issue_title: str,
    actor_id: uuid.UUID,
    actor_name: str,
    new_assignee_id: uuid.UUID | None,
    old_assignee_id: uuid.UUID | None,
) -> None:
    """Background-safe wrapper: opens its own session and commits."""
    SessionLocal = _get_session_factory()
    db = SessionLocal()
    try:
        notify_issue_assigned(
            db,
            org_id=org_id,
            issue_id=issue_id,
            issue_key=issue_key,
            issue_title=issue_title,
            actor_id=actor_id,
            actor_name=actor_name,
            new_assignee_id=new_assignee_id,
            old_assignee_id=old_assignee_id,
        )
        db.commit()
    except Exception:
        logger.exception(
            "Failed to create assignment notification for issue %s", issue_id
        )
    finally:
        db.close()


def run_notify_issue_status_changed(
    *,
    org_id: uuid.UUID,
    issue_id: uuid.UUID,
    issue_key: str,
    issue_title: str,
    actor_id: uuid.UUID,
    actor_name: str,
    old_status: str,
    new_status: str,
    reporter_id: uuid.UUID | None,
    assignee_id: uuid.UUID | None,
) -> None:
    """Background-safe wrapper: opens its own session and commits."""
    SessionLocal = _get_session_factory()
    db = SessionLocal()
    try:
        notify_issue_status_changed(
            db,
            org_id=org_id,
            issue_id=issue_id,
            issue_key=issue_key,
            issue_title=issue_title,
            actor_id=actor_id,
            actor_name=actor_name,
            old_status=old_status,
            new_status=new_status,
            reporter_id=reporter_id,
            assignee_id=assignee_id,
        )
        db.commit()
    except Exception:
        logger.exception(
            "Failed to create status-change notification for issue %s", issue_id
        )
    finally:
        db.close()


def run_notify_comment_added(
    *,
    org_id: uuid.UUID,
    issue_id: uuid.UUID,
    issue_key: str,
    issue_title: str,
    actor_id: uuid.UUID,
    actor_name: str,
    reporter_id: uuid.UUID | None,
    assignee_id: uuid.UUID | None,
) -> None:
    """Background-safe wrapper: opens its own session and commits."""
    SessionLocal = _get_session_factory()
    db = SessionLocal()
    try:
        notify_comment_added(
            db,
            org_id=org_id,
            issue_id=issue_id,
            issue_key=issue_key,
            issue_title=issue_title,
            actor_id=actor_id,
            actor_name=actor_name,
            reporter_id=reporter_id,
            assignee_id=assignee_id,
        )
        db.commit()
    except Exception:
        logger.exception(
            "Failed to create comment notification for issue %s", issue_id
        )
    finally:
        db.close()
