"""
Pydantic schemas for Issue/Ticket and Comment management.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


VALID_PRIORITIES = frozenset({"low", "medium", "high", "urgent"})
VALID_STATUSES = frozenset({"open", "in_progress", "resolved", "closed"})


# ---------------------------------------------------------------------------
# User Summary Schema (for reporter/assignee/author)
# ---------------------------------------------------------------------------

class UserSummary(BaseModel):
    id: UUID
    email: str
    full_name: str

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Issue Schemas
# ---------------------------------------------------------------------------

class IssueCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str | None = Field(default=None, max_length=10000)
    category: str = Field(default="general", min_length=2, max_length=50)
    priority: str = Field(default="medium")
    assignee_id: UUID | None = Field(default=None)

    @field_validator("title", mode="before")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Title must be at least 3 characters")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in VALID_PRIORITIES:
            raise ValueError(
                f"Priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}"
            )
        return v

    @field_validator("category", mode="before")
    @classmethod
    def validate_category(cls, v: str) -> str:
        return v.strip().lower() or "general"


class IssueUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=255)
    description: str | None = Field(default=None, max_length=10000)
    category: str | None = Field(default=None, min_length=2, max_length=50)
    priority: str | None = Field(default=None)
    status: str | None = Field(default=None)
    resolution_note: str | None = Field(default=None, max_length=10000)
    version: int | None = Field(default=None, ge=1)

    @field_validator("title", mode="before")
    @classmethod
    def validate_title(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Title must be at least 3 characters")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().lower()
        if v not in VALID_PRIORITIES:
            raise ValueError(
                f"Priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}"
            )
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().lower()
        if v not in VALID_STATUSES:
            raise ValueError(
                f"Status must be one of: {', '.join(sorted(VALID_STATUSES))}"
            )
        return v

    @field_validator("category", mode="before")
    @classmethod
    def validate_category(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return v.strip().lower() or "general"


class IssueAssignRequest(BaseModel):
    assignee_id: UUID | None = None


class IssueResponse(BaseModel):
    id: UUID
    organization_id: UUID
    issue_number: int
    issue_key: str
    title: str
    description: str | None
    category: str
    priority: str
    status: str
    resolution_note: str | None = None
    reporter: UserSummary | None
    assignee: UserSummary | None
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IssueListResponse(BaseModel):
    issues: list[IssueResponse]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Activity / Audit Log Schemas
# ---------------------------------------------------------------------------

class ActivityResponse(BaseModel):
    id: UUID
    organization_id: UUID
    issue_id: UUID
    actor: UserSummary
    action: str
    old_value: str | None = None
    new_value: str | None = None
    details: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ActivityListResponse(BaseModel):
    activities: list[ActivityResponse]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Comment Schemas
# ---------------------------------------------------------------------------

class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=10000)

    @field_validator("content", mode="before")
    @classmethod
    def validate_content(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Comment content cannot be empty")
        return v


class CommentResponse(BaseModel):
    id: UUID
    issue_id: UUID
    organization_id: UUID
    author: UserSummary
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CommentListResponse(BaseModel):
    comments: list[CommentResponse]
    total: int
    page: int
    page_size: int
