from __future__ import annotations

import base64
import hashlib
import secrets
import string

from datetime import datetime, timezone

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models.organization import Organization


def _cipher() -> Fernet:
    key = base64.urlsafe_b64encode(
        hashlib.sha256(settings.jwt_secret_key.encode("utf-8")).digest()
    )
    return Fernet(key)


def generate_organization_code(db: Session) -> str:
    """
    Format: RXO-<YEAR>-<5-DIGIT-SEQUENCE> (e.g. RXO-2026-00001)
    Clean, human-readable, professional, and guaranteed sequential & unique.
    """
    current_year = datetime.now(timezone.utc).year
    total_count = db.scalar(select(func.count(Organization.id))) or 0

    # Try sequential format first
    candidate = f"RXO-{current_year}-{total_count + 1:05d}"
    if db.scalar(select(Organization.id).where(Organization.organization_code == candidate)) is None:
        return candidate

    # If already taken (due to deletions/custom assignments), find next free sequence
    alphabet = string.ascii_uppercase + string.digits
    for i in range(1, 1000):
        candidate = f"RXO-{current_year}-{total_count + i:05d}"
        if db.scalar(select(Organization.id).where(Organization.organization_code == candidate)) is None:
            return candidate

    # Fallback to high-entropy token
    for _ in range(10):
        code = f"RXO-{current_year}-" + "".join(secrets.choice(alphabet) for _ in range(6))
        if db.scalar(select(Organization.id).where(Organization.organization_code == code)) is None:
            return code

    raise RuntimeError("Unable to allocate a unique organization code")


def generate_join_code() -> str:
    """
    Format: RX-<4-HEX> (e.g. RX-A1B2C3D4)
    User/client friendly, easy to copy and share for joining an organization.
    """
    return "RX-" + secrets.token_hex(4).upper()


def encrypt_join_code(code: str) -> str:
    return _cipher().encrypt(code.encode("utf-8")).decode("ascii")


def decrypt_join_code(value: str) -> str:
    try:
        return _cipher().decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeDecodeError, ValueError) as exc:
        raise RuntimeError("Stored organization invitation code cannot be decrypted") from exc
