"""
Organization API routes.

Endpoints:
  POST /api/v1/organizations            — create an organization (authenticated)
  GET  /api/v1/organizations            — list organizations the user belongs to
  GET  /api/v1/organizations/{org_id}   — get a single organization (must be member)
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models.membership import Membership
from app.db.models.organization import Organization
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationListResponse,
    OrganizationResponse,
    _make_slug,
)

router = APIRouter(prefix="/organizations", tags=["Organizations"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_membership(
    db: Session,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Membership:
    """
    Return the Membership row if it exists, otherwise raise 403.
    This is the single enforcement point for cross-tenant isolation.
    """
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
    return membership


def _org_to_response(org: Organization, role: str) -> OrganizationResponse:
    return OrganizationResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        industry=org.industry,
        is_active=org.is_active,
        role=role,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an organization",
)
def create_organization(
    data: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrganizationResponse:
    """
    The authenticated user creates a new organization and becomes its owner.
    The slug is auto-derived from the name if not provided.
    """
    slug = data.slug or _make_slug(data.name)

    org = Organization(
        id=uuid.uuid4(),
        name=data.name.strip(),
        slug=slug,
        industry=data.industry,
        is_active=True,
    )
    db.add(org)

    try:
        db.flush()  # assign org.id without committing
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An organization with this slug already exists",
        )

    membership = Membership(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=current_user.id,
        role="owner",
    )
    db.add(membership)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An organization with this slug already exists",
        )

    db.refresh(org)
    return _org_to_response(org, role="owner")


@router.get(
    "",
    response_model=OrganizationListResponse,
    summary="List my organizations",
)
def list_organizations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrganizationListResponse:
    """
    Return all organizations where the current user has a membership.
    Only the user's own organizations are returned — no cross-tenant leakage.
    """
    rows = db.execute(
        select(Organization, Membership.role)
        .join(Membership, Membership.organization_id == Organization.id)
        .where(Membership.user_id == current_user.id)
        .order_by(Organization.name)
    ).all()

    orgs = [_org_to_response(org, role) for org, role in rows]
    return OrganizationListResponse(organizations=orgs, total=len(orgs))


@router.get(
    "/{org_id}",
    response_model=OrganizationResponse,
    summary="Get a single organization",
)
def get_organization(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrganizationResponse:
    """
    Return a single organization.  The caller must be a member; attempting to
    access another tenant's organization returns 403, not 404, to avoid leaking
    whether the organization exists.
    """
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    membership = _require_membership(db, org_id, current_user.id)
    return _org_to_response(org, role=membership.role)
