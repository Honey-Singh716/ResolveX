"""
Pydantic schemas for in-app notifications.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


VALID_NOTIFICATION_TYPES = frozenset({
    "issue_assigned",
    "issue_unassigned",
    "issue_status_changed",
    "comment_added",
})


# ---------------------------------------------------------------------------
# Response Schemas
# ---------------------------------------------------------------------------

class NotificationResponse(BaseModel):
    id: UUID
    organization_id: UUID
    issue_id: UUID | None = None
    target_path: str | None = None
    type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int
    page: int
    page_size: int


class UnreadCountResponse(BaseModel):
    unread_count: int
