"""
Pydantic schemas for organizations and membership.
"""
from __future__ import annotations

import re
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# Organization schemas
# ---------------------------------------------------------------------------

VALID_ROLES = frozenset({"owner", "admin", "manager", "staff", "member"})

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _make_slug(name: str) -> str:
    """Derive a URL-safe slug from an organization name."""
    slug = name.strip().lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug or "org"


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    slug: str | None = Field(default=None, min_length=2, max_length=100)
    industry: str = Field(default="general", max_length=50)

    @field_validator("slug", mode="before")
    @classmethod
    def validate_slug(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().lower()
        if not SLUG_RE.match(v):
            raise ValueError(
                "Slug must contain only lowercase letters, digits, and hyphens, "
                "and must not start or end with a hyphen."
            )
        return v


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    industry: str
    is_active: bool
    role: str  # current user's role in this org

    model_config = ConfigDict(from_attributes=True)


class OrganizationListResponse(BaseModel):
    organizations: list[OrganizationResponse]
    total: int


# ---------------------------------------------------------------------------
# Membership schemas
# ---------------------------------------------------------------------------

class MembershipResponse(BaseModel):
    id: UUID
    organization_id: UUID
    user_id: UUID
    role: str

    model_config = ConfigDict(from_attributes=True)
