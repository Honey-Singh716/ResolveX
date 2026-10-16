"""
Platform Administrator endpoints.
Requires platform administrator privileges (User.is_platform_admin is True).
"""
from __future__ import annotations

import uuid
import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_platform_admin
from app.core.config import settings
from app.db.models.issue import Issue
from app.db.models.membership import Membership
from app.db.models.notification import Notification
from app.db.models.organization import Organization
from app.db.models.user import User
from app.db.session import get_db
from app.services.organization_codes import (
    encrypt_join_code,
    generate_join_code,
    generate_organization_code,
)
from app.schemas.organization import (
    OrganizationPlatformListResponse,
    OrganizationPlatformResponse,
    OrganizationVerificationAction,
    PlatformAdminListResponse,
    PlatformAdminPromoteRequest,
    PlatformAdminResponse,
    PlatformStatsResponse,
)

router = APIRouter(prefix="/platform", tags=["Platform Administration"])


@router.get(
    "/organizations",
    response_model=OrganizationPlatformListResponse,
    summary="List organizations across the platform (Platform Admin only)",
)
def list_all_organizations(
    status_filter: str | None = Query(None, alias="status", description="Filter by status (pending, approved, rejected, suspended)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_platform_admin),
) -> OrganizationPlatformListResponse:
    query = select(Organization)
    if status_filter:
        query = query.where(Organization.verification_status == status_filter.strip().lower())

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    offset = (page - 1) * page_size
    orgs = db.scalars(
        query.order_by(Organization.name.asc()).offset(offset).limit(page_size)
    ).all()

    return OrganizationPlatformListResponse(
        organizations=list(orgs),
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/organizations/{org_id}/approve",
    response_model=OrganizationPlatformResponse,
    summary="Approve organization verification (Platform Admin only)",
)
def approve_organization(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_platform_admin),
) -> OrganizationPlatformResponse:
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # Lock the row so concurrent approval requests cannot provision two identities.
    org = db.scalar(
        select(Organization)
        .where(Organization.id == org_id)
        .with_for_update()
    )
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    org.verification_status = "approved"
    org.domain_verification_status = "verified"
    org.rejection_reason = None
    org.verified_at = datetime.now(timezone.utc)
    org.verified_by = admin.id
    if not org.organization_code:
        org.organization_code = generate_organization_code(db)
    if not org.join_code_hash or not org.join_code_encrypted:
        join_code = generate_join_code()
        org.join_code_hash = hashlib.sha256(join_code.encode()).hexdigest()
        org.join_code_encrypted = encrypt_join_code(join_code)
        org.join_code_created_at = datetime.now(timezone.utc)

    # Notify organization owners
    owner_memberships = db.scalars(
        select(Membership).where(
            Membership.organization_id == org_id,
            Membership.role == "owner",
        )
    ).all()

    for m in owner_memberships:
        db.add(
            Notification(
                id=uuid.uuid4(),
                organization_id=org_id,
                recipient_id=m.user_id,
                actor_id=admin.id,
                type="issue_status_changed",
                title="Organization Approved",
                message=f"Your organization '{org.name}' has been approved by platform administration.",
            )
        )

    db.commit()
    db.refresh(org)
    return org


@router.post(
    "/organizations/{org_id}/reject",
    response_model=OrganizationPlatformResponse,
    summary="Reject organization verification (Platform Admin only)",
)
def reject_organization(
    org_id: uuid.UUID,
    action: OrganizationVerificationAction,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_platform_admin),
) -> OrganizationPlatformResponse:
    if not action.reason or not action.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A non-empty rejection reason is required",
        )

    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    org.verification_status = "rejected"
    org.domain_verification_status = "rejected"
    org.rejection_reason = action.reason.strip()
    org.verified_at = datetime.now(timezone.utc)
    org.verified_by = admin.id
    org.join_code_hash = None
    org.join_code_encrypted = None
    org.join_code_created_at = None

    # Notify organization owners
    owner_memberships = db.scalars(
        select(Membership).where(
            Membership.organization_id == org_id,
            Membership.role == "owner",
        )
    ).all()

    for m in owner_memberships:
        db.add(
            Notification(
                id=uuid.uuid4(),
                organization_id=org_id,
                recipient_id=m.user_id,
                actor_id=admin.id,
                type="issue_status_changed",
                title="Organization Verification Rejected",
                message=f"Your organization '{org.name}' was not approved. Reason: {action.reason.strip()}",
            )
        )

    db.commit()
    db.refresh(org)
    return org


@router.post(
    "/organizations/{org_id}/suspend",
    response_model=OrganizationPlatformResponse,
    summary="Suspend organization (Platform Admin only)",
)
def suspend_organization(
    org_id: uuid.UUID,
    action: OrganizationVerificationAction,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_platform_admin),
) -> OrganizationPlatformResponse:
    if not action.reason or not action.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A non-empty suspension reason is required",
        )

    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    org.verification_status = "suspended"
    org.domain_verification_status = "pending"
    org.rejection_reason = action.reason.strip()
    org.verified_at = datetime.now(timezone.utc)
    org.verified_by = admin.id
    org.join_code_hash = None
    org.join_code_encrypted = None
    org.join_code_created_at = None

    # Notify organization owners
    owner_memberships = db.scalars(
        select(Membership).where(
            Membership.organization_id == org_id,
            Membership.role == "owner",
        )
    ).all()

    for m in owner_memberships:
        db.add(
            Notification(
                id=uuid.uuid4(),
                organization_id=org_id,
                recipient_id=m.user_id,
                actor_id=admin.id,
                type="issue_status_changed",
                title="Organization Suspended",
                message=f"Your organization '{org.name}' has been suspended. Reason: {action.reason.strip()}",
            )
        )

    db.commit()
    db.refresh(org)
    return org


@router.get(
    "/stats",
    response_model=PlatformStatsResponse,
    summary="Get platform aggregate statistics (Platform Admin only)",
)
def get_platform_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_platform_admin),
) -> PlatformStatsResponse:
    total_orgs = db.scalar(select(func.count(Organization.id))) or 0
    pending_orgs = db.scalar(select(func.count(Organization.id)).where(Organization.verification_status == "pending")) or 0
    approved_orgs = db.scalar(select(func.count(Organization.id)).where(Organization.verification_status == "approved")) or 0
    suspended_orgs = db.scalar(select(func.count(Organization.id)).where(Organization.verification_status == "suspended")) or 0
    rejected_orgs = db.scalar(select(func.count(Organization.id)).where(Organization.verification_status == "rejected")) or 0
    total_users = db.scalar(select(func.count(User.id))) or 0
    total_issues = db.scalar(select(func.count(Issue.id))) or 0

    return PlatformStatsResponse(
        total_organizations=total_orgs,
        pending_organizations=pending_orgs,
        approved_organizations=approved_orgs,
        suspended_organizations=suspended_orgs,
        rejected_organizations=rejected_orgs,
        total_users=total_users,
        total_issues=total_issues,
    )


@router.get(
    "/admins",
    response_model=PlatformAdminListResponse,
    summary="List platform administrators (Platform Admin only)",
)
def list_platform_admins(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_platform_admin),
) -> PlatformAdminListResponse:
    admins = db.scalars(
        select(User).where(User.is_platform_admin == True).order_by(User.email.asc())
    ).all()
    return PlatformAdminListResponse(
        admins=list(admins),
        total=len(admins),
    )


@router.post(
    "/admins",
    response_model=PlatformAdminResponse,
    summary="Promote user to platform administrator (Platform Admin only)",
)
def promote_platform_admin(
    data: PlatformAdminPromoteRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_platform_admin),
) -> PlatformAdminResponse:
    email = str(data.email).strip().lower()

    if settings.platform_admin_allowed_domain:
        allowed = settings.platform_admin_allowed_domain.strip().lower()
        if not email.endswith(f"@{allowed}"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Platform admin email must belong to domain '@{allowed}'",
            )

    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email '{email}' not found. The user must register first before being promoted.",
        )

    user.is_platform_admin = True
    db.commit()
    db.refresh(user)
    return user


@router.delete(
    "/admins/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke platform administrator privileges (Platform Admin only)",
)
def revoke_platform_admin(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_platform_admin),
):
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot revoke your own platform administrator privileges",
        )

    target_user = db.get(User, user_id)
    if target_user is None or not target_user.is_platform_admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Platform administrator not found",
        )

    # Prevent revoking last remaining admin
    admin_count = db.scalar(select(func.count(User.id)).where(User.is_platform_admin == True)) or 0
    if admin_count <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot revoke the last remaining platform administrator",
        )

    target_user.is_platform_admin = False
    db.commit()
    return None
