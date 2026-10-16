from __future__ import annotations

import base64
import hashlib
import secrets
import string

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models.organization import Organization


def _cipher() -> Fernet:
    key = base64.urlsafe_b64encode(
        hashlib.sha256(settings.jwt_secret_key.encode("utf-8")).digest()
    )
    return Fernet(key)


def generate_organization_code(db: Session) -> str:
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(10):
        code = "RXO-" + "".join(secrets.choice(alphabet) for _ in range(10))
        if db.scalar(select(Organization.id).where(Organization.organization_code == code)) is None:
            return code
    raise RuntimeError("Unable to allocate a unique organization code")


def generate_join_code() -> str:
    return "RX-" + secrets.token_hex(4).upper()


def encrypt_join_code(code: str) -> str:
    return _cipher().encrypt(code.encode("utf-8")).decode("ascii")


def decrypt_join_code(value: str) -> str:
    try:
        return _cipher().decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeDecodeError, ValueError) as exc:
        raise RuntimeError("Stored organization invitation code cannot be decrypted") from exc
