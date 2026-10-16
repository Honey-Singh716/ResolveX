"""
Organization & Membership API routes.

Endpoints:
  POST   /api/v1/organizations                         — create an organization (authenticated)
  GET    /api/v1/organizations                         — list my organizations with pagination
  GET    /api/v1/organizations/{org_id}                — get a single organization (must be member)
  GET    /api/v1/organizations/{org_id}/members        — list organization members (must be member)
  POST   /api/v1/organizations/{org_id}/members        — add a member (owner/admin)
  PATCH  /api/v1/organizations/{org_id}/members/{id}   — update member role (owner/admin)
  DELETE /api/v1/organizations/{org_id}/members/{id}   — remove member / leave organization
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models.membership import Membership
from app.db.models.membership_request import MembershipRequest
from app.db.models.notification import Notification
from app.db.models.organization import Organization
from app.db.models.user import User
from app.services.organization_codes import (
    decrypt_join_code,
    encrypt_join_code,
    generate_join_code,
    generate_organization_code,
)
from app.db.session import get_db
from app.schemas.organization import (
    JoinByCodeRequest,
    JoinCodeResponse,
    MemberCreate,
    MemberListResponse,
    MemberResponse,
    MemberUpdate,
    MembershipRequestApprove,
    MembershipRequestListResponse,
    MembershipRequestReject,
    MembershipRequestResponse,
    OrganizationCreate,
    OrganizationListResponse,
    OrganizationResponse,
    OrganizationDeletionResponse,
    OwnershipTransferRequest,
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
    This is the primary enforcement point for cross-tenant isolation.
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


def _require_admin(
    db: Session,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
) -> tuple[Organization, Membership]:
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    membership = _require_membership(db, org_id, user_id)
    if membership.role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization owner or admin privileges required",
        )
    return org, membership


def _org_to_response(org: Organization, role: str) -> OrganizationResponse:
    return OrganizationResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        industry=org.industry,
        is_active=org.is_active,
        verification_status=org.verification_status,
        rejection_reason=org.rejection_reason,
        role=role,
        domain_verification_status=org.domain_verification_status,
        deletion_requested_at=org.deletion_requested_at,
        deletion_scheduled_for=org.deletion_scheduled_for,
        ownership_transfer_target_id=org.ownership_transfer_target_id,
        archived_at=org.archived_at,
    )


# ---------------------------------------------------------------------------
# Organization Routes
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
    The authenticated user creates a new organization and automatically becomes
    its owner in the same transaction.
    """
    slug = data.slug or _make_slug(data.name)

    existing = db.scalar(select(Organization).where(Organization.slug == slug))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An organization with this slug already exists",
        )

    org = Organization(
        id=uuid.uuid4(),
        name=data.name.strip(),
        slug=slug,
        industry=data.industry,
        official_email_domain=data.official_email_domain or current_user.email.rsplit("@", 1)[-1],
        official_website=data.official_website or "not-provided",
        proof_document_reference=data.proof_document_reference or "not-provided",
        contact_phone=data.contact_phone or "not-provided",
        is_active=True,
        verification_status="pending",
        domain_verification_status="pending",
    )
    db.add(org)
    try:
        db.flush()
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
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrganizationListResponse:
    """
    Return organizations where the current user has a membership, with pagination.
    Only the user's own organizations are returned — strictly preventing cross-tenant leakage.
    """
    count_stmt = (
        select(func.count(Membership.id))
        .where(Membership.user_id == current_user.id)
    )
    total = db.scalar(count_stmt) or 0

    offset = (page - 1) * page_size
    stmt = (
        select(Organization, Membership.role)
        .join(Membership, Membership.organization_id == Organization.id)
        .where(Membership.user_id == current_user.id)
        .order_by(Organization.name)
        .offset(offset)
        .limit(page_size)
    )
    rows = db.execute(stmt).all()

    orgs = [_org_to_response(org, role) for org, role in rows]
    return OrganizationListResponse(
        organizations=orgs,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/discover",
    response_model=list[OrganizationResponse],
    summary="Suggest approved organizations matching the user's verified email domain",
)
def discover_organizations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[OrganizationResponse]:
    """Suggestions never create membership or grant a role."""
    email_domain = current_user.email.rsplit("@", 1)[-1].lower()
    rows = db.scalars(
        select(Organization)
        .where(
            Organization.is_active.is_(True),
            Organization.verification_status == "approved",
            Organization.domain_verification_status == "verified",
            Organization.official_email_domain == email_domain,
        )
        .order_by(Organization.name)
        .limit(20)
    ).all()
    return [_org_to_response(org, role="") for org in rows]


@router.post(
    "/join",
    response_model=MembershipRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a join code to request membership",
)
def join_by_code(
    data: JoinByCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MembershipRequestResponse:
    code = data.join_code.strip()
    hashed = hashlib.sha256(code.encode()).hexdigest()

    org = db.scalar(
        select(Organization).where(
            Organization.join_code_hash == hashed,
            Organization.is_active.is_(True),
            Organization.verification_status == "approved",
        )
    )
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired join code",
        )

    # Check if user is already a member
    existing_member = db.scalar(
        select(Membership).where(
            Membership.organization_id == org.id,
            Membership.user_id == current_user.id,
        )
    )
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already a member of this organization",
        )

    # Check if user already has a pending request
    existing_req = db.scalar(
        select(MembershipRequest).where(
            MembershipRequest.organization_id == org.id,
            MembershipRequest.user_id == current_user.id,
            MembershipRequest.status == "pending",
        )
    )
    if existing_req:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending membership request for this organization",
        )

    req = MembershipRequest(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=current_user.id,
        status="pending",
        role="client",
    )
    db.add(req)

    # Notify organization owners and admins
    admins = db.scalars(
        select(Membership).where(
            Membership.organization_id == org.id,
            Membership.role.in_(("owner", "admin")),
        )
    ).all()
    for adm in admins:
        db.add(
            Notification(
                id=uuid.uuid4(),
                organization_id=org.id,
                recipient_id=adm.user_id,
                actor_id=current_user.id,
                type="issue_status_changed",
                title="New Membership Request",
                message=f"{current_user.full_name} ({current_user.email}) requested to join {org.name}.",
            )
        )

    db.commit()
    db.refresh(req)

    return MembershipRequestResponse(
        id=req.id,
        organization_id=org.id,
        organization_name=org.name,
        user_id=current_user.id,
        user_email=current_user.email,
        user_name=current_user.full_name,
        status=req.status,
        role=req.role,
        rejection_reason=req.rejection_reason,
        created_at=req.created_at,
    )


@router.get(
    "/membership-requests/mine",
    response_model=MembershipRequestListResponse,
    summary="List current user's submitted membership requests",
)
def list_my_membership_requests(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MembershipRequestListResponse:
    query = (
        select(MembershipRequest, Organization.name)
        .join(Organization, Organization.id == MembershipRequest.organization_id)
        .where(MembershipRequest.user_id == current_user.id)
    )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    offset = (page - 1) * page_size
    rows = db.execute(
        query.order_by(MembershipRequest.created_at.desc()).offset(offset).limit(page_size)
    ).all()

    results = [
        MembershipRequestResponse(
            id=req.id,
            organization_id=req.organization_id,
            organization_name=org_name,
            user_id=req.user_id,
            user_email=current_user.email,
            user_name=current_user.full_name,
            status=req.status,
            role=req.role,
            rejection_reason=req.rejection_reason,
            created_at=req.created_at,
        )
        for req, org_name in rows
    ]
    return MembershipRequestListResponse(
        requests=results,
        total=total,
        page=page,
        page_size=page_size,
    )


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
    Return a single organization. The caller must be a member; attempting to
    access another tenant's organization returns 403.
    """
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    membership = _require_membership(db, org_id, current_user.id)
    return _org_to_response(org, role=membership.role)


@router.post(
    "/{org_id}/ownership-transfer",
    response_model=OrganizationResponse,
    summary="Request ownership transfer to an eligible member",
)
def request_ownership_transfer(
    org_id: uuid.UUID,
    data: OwnershipTransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrganizationResponse:
    org, caller = _require_admin(db, org_id, current_user.id)
    if caller.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only an owner can transfer ownership")
    target = db.scalar(
        select(Membership).where(
            Membership.organization_id == org_id,
            Membership.user_id == data.target_user_id,
        )
    )
    if target is None or target.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ownership can only be offered to an eligible non-owner member",
        )
    org.ownership_transfer_target_id = data.target_user_id
    org.ownership_transfer_requested_at = datetime.now(timezone.utc)
    db.add(
        Notification(
            id=uuid.uuid4(),
            organization_id=org_id,
            recipient_id=data.target_user_id,
            actor_id=current_user.id,
            type="issue_status_changed",
            title="Ownership transfer requested",
            message=f"{current_user.full_name} offered you ownership of '{org.name}'. Accept it from the organization workspace.",
        )
    )
    db.commit()
    db.refresh(org)
    return _org_to_response(org, role="owner")


@router.post(
    "/{org_id}/ownership-transfer/accept",
    response_model=OrganizationResponse,
    summary="Accept a pending ownership transfer",
)
def accept_ownership_transfer(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrganizationResponse:
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    target = _require_membership(db, org_id, current_user.id)
    if org.ownership_transfer_target_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No ownership transfer is pending for this account")
    previous_owner = db.scalar(
        select(Membership).where(
            Membership.organization_id == org_id,
            Membership.role == "owner",
        )
    )
    if previous_owner is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Organization has no transferable owner")
    previous_owner.role = "admin"
    target.role = "owner"
    org.ownership_transfer_target_id = None
    org.ownership_transfer_requested_at = None
    db.add(
        Notification(
            id=uuid.uuid4(),
            organization_id=org_id,
            recipient_id=previous_owner.user_id,
            actor_id=current_user.id,
            type="issue_status_changed",
            title="Ownership transferred",
            message=f"{current_user.full_name} accepted ownership of '{org.name}'.",
        )
    )
    db.commit()
    db.refresh(org)
    return _org_to_response(org, role="owner")


@router.post(
    "/{org_id}/deletion-request",
    response_model=OrganizationDeletionResponse,
    summary="Schedule non-destructive organization archival",
)
def request_organization_deletion(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrganizationDeletionResponse:
    org, caller = _require_admin(db, org_id, current_user.id)
    if caller.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organization owner can request archival")
    if org.deletion_scheduled_for is not None:
        return OrganizationDeletionResponse(
            requested_at=org.deletion_requested_at,
            scheduled_for=org.deletion_scheduled_for,
            archived_at=org.archived_at,
        )
    now = datetime.now(timezone.utc)
    org.deletion_requested_at = now
    org.deletion_scheduled_for = now + timedelta(days=7)
    org.deletion_requested_by = current_user.id
    members = db.scalars(select(Membership).where(Membership.organization_id == org_id)).all()
    for member in members:
        if member.user_id == current_user.id:
            continue
        db.add(
            Notification(
                id=uuid.uuid4(),
                organization_id=org_id,
                recipient_id=member.user_id,
                actor_id=current_user.id,
                type="issue_status_changed",
                title="Organization archival scheduled",
                message=f"'{org.name}' is scheduled for archival after a 7-day grace period.",
            )
        )
    db.commit()
    return OrganizationDeletionResponse(requested_at=now, scheduled_for=org.deletion_scheduled_for)


@router.delete(
    "/{org_id}/deletion-request",
    response_model=OrganizationDeletionResponse,
    summary="Cancel scheduled organization archival",
)
def cancel_organization_deletion(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrganizationDeletionResponse:
    org, caller = _require_admin(db, org_id, current_user.id)
    if caller.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organization owner can cancel archival")
    if org.deletion_scheduled_for is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No archival request is pending")
    org.deletion_requested_at = None
    org.deletion_scheduled_for = None
    org.deletion_requested_by = None
    db.commit()
    return OrganizationDeletionResponse()


@router.post(
    "/{org_id}/archive",
    response_model=OrganizationDeletionResponse,
    summary="Archive an organization after its grace period",
)
def archive_organization(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrganizationDeletionResponse:
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    is_platform_admin = current_user.is_platform_admin
    if not is_platform_admin:
        membership = _require_membership(db, org_id, current_user.id)
        if membership.role != "owner":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner or platform administrator can archive")
    if org.deletion_scheduled_for is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No archival request is pending")
    now = datetime.now(timezone.utc)
    scheduled = org.deletion_scheduled_for
    if scheduled.tzinfo is None:
        scheduled = scheduled.replace(tzinfo=timezone.utc)
    if scheduled > now:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The archival grace period has not expired")
    org.is_active = False
    org.verification_status = "suspended"
    org.domain_verification_status = "pending"
    org.join_code_hash = None
    org.join_code_encrypted = None
    org.join_code_created_at = None
    org.archived_at = now
    db.commit()
    return OrganizationDeletionResponse(
        requested_at=org.deletion_requested_at,
        scheduled_for=org.deletion_scheduled_for,
        archived_at=org.archived_at,
    )


# ---------------------------------------------------------------------------
# Member Routes
# ---------------------------------------------------------------------------

@router.get(
    "/{org_id}/members",
    response_model=MemberListResponse,
    summary="List organization members",
)
def list_members(
    org_id: uuid.UUID,
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=50, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MemberListResponse:
    """
    List members of an organization. Caller must be an authorized member of the organization.
    """
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    _require_membership(db, org_id, current_user.id)

    count_stmt = (
        select(func.count(Membership.id))
        .where(Membership.organization_id == org_id)
    )
    total = db.scalar(count_stmt) or 0

    offset = (page - 1) * page_size
    stmt = (
        select(Membership, User)
        .join(User, Membership.user_id == User.id)
        .where(Membership.organization_id == org_id)
        .order_by(
            case(
                (Membership.role == "owner", 1),
                (Membership.role == "admin", 2),
                else_=3,
            ),
            User.full_name,
        )
        .offset(offset)
        .limit(page_size)
    )
    rows = db.execute(stmt).all()

    members = [
        MemberResponse(
            id=m.id,
            organization_id=m.organization_id,
            user_id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=m.role,
            is_active=u.is_active,
        )
        for m, u in rows
    ]

    return MemberListResponse(
        members=members,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/{org_id}/members",
    response_model=MemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a member to an organization",
)
def add_member(
    org_id: uuid.UUID,
    data: MemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MemberResponse:
    """
    Add a registered user to an organization.
    - Caller must be an owner or admin.
    - Admins cannot assign owner or admin roles (privilege escalation prevention).
    - Prevents duplicate memberships.
    """
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    caller_membership = _require_membership(db, org_id, current_user.id)

    if caller_membership.role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization owners and admins can add members",
        )

    if caller_membership.role == "admin" and data.role in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins cannot assign owner or admin roles",
        )

    target_user = db.scalar(
        select(User).where(User.email == data.email.strip().lower())
    )
    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User with this email does not exist",
        )

    existing_membership = db.scalar(
        select(Membership).where(
            Membership.organization_id == org_id,
            Membership.user_id == target_user.id,
        )
    )
    if existing_membership is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this organization",
        )

    membership = Membership(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=target_user.id,
        role=data.role,
    )
    db.add(membership)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this organization",
        )

    return MemberResponse(
        id=membership.id,
        organization_id=membership.organization_id,
        user_id=target_user.id,
        email=target_user.email,
        full_name=target_user.full_name,
        role=membership.role,
        is_active=target_user.is_active,
    )


@router.patch(
    "/{org_id}/members/{member_id}",
    response_model=MemberResponse,
    summary="Update a member's role",
)
def update_member_role(
    org_id: uuid.UUID,
    member_id: uuid.UUID,
    data: MemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MemberResponse:
    """
    Update a member's role.
    - Caller must be an owner or admin.
    - Admins cannot modify owners or promote to owner/admin.
    - Prevents demotion of the last owner.
    """
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    caller_membership = _require_membership(db, org_id, current_user.id)

    if caller_membership.role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization owners and admins can update member roles",
        )

    row = db.execute(
        select(Membership, User)
        .join(User, Membership.user_id == User.id)
        .where(
            Membership.organization_id == org_id,
            (Membership.id == member_id) | (Membership.user_id == member_id),
        )
    ).first()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this organization",
        )
    target_membership, target_user = row

    if caller_membership.role == "admin":
        if target_membership.role in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot modify owner or admin roles",
            )
        if data.role in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot promote a member to owner or admin",
            )

    if target_membership.role == "owner" and data.role != "owner":
        owner_count = db.scalar(
            select(func.count(Membership.id))
            .where(
                Membership.organization_id == org_id,
                Membership.role == "owner",
            )
        ) or 0
        if owner_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the last owner of an organization",
            )

    target_membership.role = data.role
    db.commit()
    db.refresh(target_membership)

    return MemberResponse(
        id=target_membership.id,
        organization_id=target_membership.organization_id,
        user_id=target_user.id,
        email=target_user.email,
        full_name=target_user.full_name,
        role=target_membership.role,
        is_active=target_user.is_active,
    )


@router.delete(
    "/{org_id}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a member from an organization",
)
def remove_member(
    org_id: uuid.UUID,
    member_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """
    Remove a member from an organization, or leave the organization.
    - Members can remove themselves (leave) unless they are the last owner.
    - Admins can remove regular members, but cannot remove owners or admins.
    - Owners can remove anyone except the last remaining owner.
    """
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    caller_membership = _require_membership(db, org_id, current_user.id)

    target_membership = db.scalar(
        select(Membership).where(
            Membership.organization_id == org_id,
            (Membership.id == member_id) | (Membership.user_id == member_id),
        )
    )
    if target_membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this organization",
        )

    is_self = caller_membership.user_id == target_membership.user_id

    if is_self:
        if target_membership.role == "owner":
            owner_count = db.scalar(
                select(func.count(Membership.id))
                .where(
                    Membership.organization_id == org_id,
                    Membership.role == "owner",
                )
            ) or 0
            if owner_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot leave as the last owner of an organization",
                )
    else:
        if caller_membership.role not in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to remove members from this organization",
            )
        if caller_membership.role == "admin" and target_membership.role in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot remove owners or other admins",
            )
        if target_membership.role == "owner":
            owner_count = db.scalar(
                select(func.count(Membership.id))
                .where(
                    Membership.organization_id == org_id,
                    Membership.role == "owner",
                )
            ) or 0
            if owner_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove the last owner of an organization",
                )

    db.delete(target_membership)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Join Code & Membership Request Management (Owner/Admin)
# ---------------------------------------------------------------------------

@router.post(
    "/{org_id}/join-code",
    response_model=JoinCodeResponse,
    summary="Generate or rotate organization join code (Owner/Admin only)",
)
def generate_join_code(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JoinCodeResponse:
    org, _ = _require_admin(db, org_id, current_user.id)
    if org.verification_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization must be approved by platform administration to generate join codes",
        )

    code = "RX-" + secrets.token_hex(4).upper()
    hashed = hashlib.sha256(code.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    org.join_code_hash = hashed
    org.join_code_encrypted = encrypt_join_code(code)
    org.join_code_created_at = now
    db.commit()

    return JoinCodeResponse(join_code=code, created_at=now)


@router.get(
    "/{org_id}/join-code",
    response_model=JoinCodeResponse,
    summary="Read the active organization invitation code (Owner/Admin only)",
)
def read_join_code(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JoinCodeResponse:
    org, _ = _require_admin(db, org_id, current_user.id)
    if org.verification_status != "approved":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization is not approved")

    if not org.organization_code:
        org.organization_code = generate_organization_code(db)

    if org.join_code_encrypted:
        code = decrypt_join_code(org.join_code_encrypted)
    else:
        # Existing hashes are intentionally not reversed. Provision a replacement code.
        code = generate_join_code()
        org.join_code_hash = hashlib.sha256(code.encode()).hexdigest()
        org.join_code_encrypted = encrypt_join_code(code)
        org.join_code_created_at = datetime.now(timezone.utc)

    db.commit()
    return JoinCodeResponse(join_code=code, created_at=org.join_code_created_at or datetime.now(timezone.utc))


@router.delete(
    "/{org_id}/join-code",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke organization join code (Owner/Admin only)",
)
def revoke_join_code(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    org, _ = _require_admin(db, org_id, current_user.id)
    org.join_code_hash = None
    org.join_code_encrypted = None
    org.join_code_created_at = None
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{org_id}/membership-requests",
    response_model=MembershipRequestListResponse,
    summary="List membership requests for organization (Owner/Admin only)",
)
def list_membership_requests(
    org_id: uuid.UUID,
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MembershipRequestListResponse:
    org, _ = _require_admin(db, org_id, current_user.id)

    query = (
        select(MembershipRequest, User.email, User.full_name)
        .join(User, User.id == MembershipRequest.user_id)
        .where(MembershipRequest.organization_id == org_id)
    )

    if status_filter:
        query = query.where(MembershipRequest.status == status_filter.strip().lower())

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    offset = (page - 1) * page_size
    rows = db.execute(
        query.order_by(MembershipRequest.created_at.desc()).offset(offset).limit(page_size)
    ).all()

    results = [
        MembershipRequestResponse(
            id=req.id,
            organization_id=req.organization_id,
            organization_name=org.name,
            user_id=req.user_id,
            user_email=email,
            user_name=full_name,
            status=req.status,
            role=req.role,
            rejection_reason=req.rejection_reason,
            created_at=req.created_at,
        )
        for req, email, full_name in rows
    ]
    return MembershipRequestListResponse(
        requests=results,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/{org_id}/membership-requests/{request_id}/approve",
    response_model=MembershipRequestResponse,
    summary="Approve a membership request (Owner/Admin only)",
)
def approve_membership_request(
    org_id: uuid.UUID,
    request_id: uuid.UUID,
    data: MembershipRequestApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MembershipRequestResponse:
    org, admin_membership = _require_admin(db, org_id, current_user.id)

    # Admins cannot assign owner or admin roles
    if admin_membership.role == "admin" and data.role in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins can only approve members with staff, manager, or client roles",
        )

    req = db.scalar(
        select(MembershipRequest).where(
            MembershipRequest.id == request_id,
            MembershipRequest.organization_id == org_id,
        )
    )
    if req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership request not found",
        )

    if req.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve request with status '{req.status}'",
        )

    # Self-approval guard
    if req.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot approve your own membership request",
        )

    # Check if user is already a member
    existing_membership = db.scalar(
        select(Membership).where(
            Membership.organization_id == org_id,
            Membership.user_id == req.user_id,
        )
    )
    if existing_membership:
        req.status = "approved"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this organization",
        )

    # Create membership
    new_member = Membership(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=req.user_id,
        role=data.role,
    )
    db.add(new_member)

    now = datetime.now(timezone.utc)
    req.status = "approved"
    req.role = data.role
    req.decided_by = current_user.id
    req.decided_at = now

    # Notify requester
    db.add(
        Notification(
            id=uuid.uuid4(),
            organization_id=org_id,
            recipient_id=req.user_id,
            actor_id=current_user.id,
            type="issue_status_changed",
            title="Membership Approved",
            message=f"Your membership request for '{org.name}' has been approved with role '{data.role}'.",
        )
    )

    db.commit()
    db.refresh(req)

    user = db.get(User, req.user_id)
    return MembershipRequestResponse(
        id=req.id,
        organization_id=org_id,
        organization_name=org.name,
        user_id=req.user_id,
        user_email=user.email if user else None,
        user_name=user.full_name if user else None,
        status=req.status,
        role=req.role,
        rejection_reason=req.rejection_reason,
        created_at=req.created_at,
    )


@router.post(
    "/{org_id}/membership-requests/{request_id}/reject",
    response_model=MembershipRequestResponse,
    summary="Reject a membership request (Owner/Admin only)",
)
def reject_membership_request(
    org_id: uuid.UUID,
    request_id: uuid.UUID,
    data: MembershipRequestReject,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MembershipRequestResponse:
    org, _ = _require_admin(db, org_id, current_user.id)

    req = db.scalar(
        select(MembershipRequest).where(
            MembershipRequest.id == request_id,
            MembershipRequest.organization_id == org_id,
        )
    )
    if req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership request not found",
        )

    if req.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject request with status '{req.status}'",
        )

    now = datetime.now(timezone.utc)
    req.status = "rejected"
    req.rejection_reason = data.reason.strip() if data.reason else None
    req.decided_by = current_user.id
    req.decided_at = now

    # Notify requester
    reason_msg = f" Reason: {req.rejection_reason}" if req.rejection_reason else ""
    db.add(
        Notification(
            id=uuid.uuid4(),
            organization_id=org_id,
            recipient_id=req.user_id,
            actor_id=current_user.id,
            type="issue_status_changed",
            title="Membership Request Rejected",
            message=f"Your membership request for '{org.name}' was not accepted.{reason_msg}",
        )
    )

    db.commit()
    db.refresh(req)

    user = db.get(User, req.user_id)
    return MembershipRequestResponse(
        id=req.id,
        organization_id=org_id,
        organization_name=org.name,
        user_id=req.user_id,
        user_email=user.email if user else None,
        user_name=user.full_name if user else None,
        status=req.status,
        role=req.role,
        rejection_reason=req.rejection_reason,
        created_at=req.created_at,
    )
