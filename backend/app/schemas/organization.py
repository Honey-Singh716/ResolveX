"""
Pydantic schemas for organizations, verification, join codes, and membership.
"""
from __future__ import annotations

from datetime import datetime
import re
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Organization schemas
# ---------------------------------------------------------------------------

VALID_ROLES = frozenset({"owner", "admin", "manager", "staff", "member", "client"})

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DOMAIN_RE = re.compile(r"^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")


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
    official_email_domain: str | None = Field(default=None, min_length=3, max_length=255)
    official_website: str | None = Field(default=None, min_length=8, max_length=500)
    proof_document_reference: str | None = Field(default=None, min_length=1, max_length=1000)
    contact_phone: str | None = Field(default=None, min_length=7, max_length=50)

    @field_validator(
        "official_email_domain",
        "official_website",
        "proof_document_reference",
        "contact_phone",
        mode="before",
    )
    @classmethod
    def trim_value(cls, v: str | None) -> str | None:
        return v.strip() if isinstance(v, str) else v

    @field_validator("official_email_domain")
    @classmethod
    def normalize_domain(cls, v: str | None) -> str | None:
        if v is None:
            return v
        domain = v.strip().lower().rstrip(".")
        if domain.startswith(("http://", "https://")) or "/" in domain:
            raise ValueError("Enter a valid email domain, such as example.org")
        if not DOMAIN_RE.fullmatch(domain):
            raise ValueError("Enter a valid email domain, such as example.org")
        return domain

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
    verification_status: str = "pending"
    rejection_reason: str | None = None
    role: str  # current user's role in this org
    organization_code: str | None = None
    domain_verification_status: str = "pending"
    deletion_requested_at: datetime | None = None
    deletion_scheduled_for: datetime | None = None
    ownership_transfer_target_id: UUID | None = None
    archived_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class OrganizationListResponse(BaseModel):
    organizations: list[OrganizationResponse]
    total: int
    page: int = 1
    page_size: int = 20


# ---------------------------------------------------------------------------
# Platform Admin Schemas
# ---------------------------------------------------------------------------

class OrganizationPlatformResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    industry: str
    official_email_domain: str
    official_website: str
    proof_document_reference: str
    contact_phone: str
    is_active: bool
    verification_status: str
    rejection_reason: str | None = None
    verified_at: datetime | None = None
    verified_by: UUID | None = None
    organization_code: str | None = None
    domain_verification_status: str = "pending"

    model_config = ConfigDict(from_attributes=True)


class OrganizationPlatformListResponse(BaseModel):
    organizations: list[OrganizationPlatformResponse]
    total: int
    page: int = 1
    page_size: int = 20


class OrganizationVerificationAction(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class PlatformStatsResponse(BaseModel):
    total_organizations: int
    pending_organizations: int
    approved_organizations: int
    suspended_organizations: int
    rejected_organizations: int
    total_users: int
    total_issues: int


class PlatformAdminResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PlatformAdminListResponse(BaseModel):
    admins: list[PlatformAdminResponse]
    total: int


class PlatformAdminPromoteRequest(BaseModel):
    email: EmailStr



# ---------------------------------------------------------------------------
# Join Code & Membership Request Schemas
# ---------------------------------------------------------------------------

class JoinCodeResponse(BaseModel):
    join_code: str
    created_at: datetime


class JoinByCodeRequest(BaseModel):
    join_code: str = Field(min_length=4, max_length=64)


class MembershipRequestResponse(BaseModel):
    id: UUID
    organization_id: UUID
    organization_name: str | None = None
    user_id: UUID
    user_email: str | None = None
    user_name: str | None = None
    status: str
    role: str
    rejection_reason: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MembershipRequestListResponse(BaseModel):
    requests: list[MembershipRequestResponse]
    total: int
    page: int = 1
    page_size: int = 50


class MembershipRequestApprove(BaseModel):
    role: str = Field(default="member")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in VALID_ROLES:
            raise ValueError(f"Role must be one of: {', '.join(sorted(VALID_ROLES))}")
        return v


class MembershipRequestReject(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class OwnershipTransferRequest(BaseModel):
    target_user_id: UUID


class OrganizationDeletionResponse(BaseModel):
    requested_at: datetime | None = None
    scheduled_for: datetime | None = None
    archived_at: datetime | None = None


# ---------------------------------------------------------------------------
# Membership schemas
# ---------------------------------------------------------------------------

class MembershipResponse(BaseModel):
    id: UUID
    organization_id: UUID
    user_id: UUID
    role: str

    model_config = ConfigDict(from_attributes=True)


class MemberResponse(BaseModel):
    id: UUID  # membership id
    organization_id: UUID
    user_id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class MemberListResponse(BaseModel):
    members: list[MemberResponse]
    total: int
    page: int = 1
    page_size: int = 50


class MemberCreate(BaseModel):
    email: EmailStr
    role: str = Field(default="member")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in VALID_ROLES:
            raise ValueError(
                f"Role must be one of: {', '.join(sorted(VALID_ROLES))}"
            )
        return v


class MemberUpdate(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in VALID_ROLES:
            raise ValueError(
                f"Role must be one of: {', '.join(sorted(VALID_ROLES))}"
            )
        return v
