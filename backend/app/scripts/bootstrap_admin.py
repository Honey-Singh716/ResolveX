"""
Platform Administrator Bootstrap Script.

Usage:
    python -m app.scripts.bootstrap_admin

Reads PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD, and optional
PLATFORM_ADMIN_ALLOWED_DOMAIN from backend environment configuration.
Securely hashes the password with Argon2 and creates or updates
the designated platform administrator account.
"""
from __future__ import annotations

import logging
import sys
import uuid
from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.models.user import User
from app.db.session import SessionLocal

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("bootstrap_admin")


def bootstrap_platform_admin(db=None) -> bool:
    email = settings.platform_admin_email
    password = settings.platform_admin_password
    allowed_domain = settings.platform_admin_allowed_domain

    if not email or not password:
        logger.warning(
            "PLATFORM_ADMIN_EMAIL or PLATFORM_ADMIN_PASSWORD is not configured. "
            "Skipping platform administrator bootstrap."
        )
        return False

    email = email.strip().lower()

    if allowed_domain:
        allowed_domain = allowed_domain.strip().lower()
        if not email.endswith(f"@{allowed_domain}"):
            logger.error(
                f"Platform admin email '{email}' violates configured allowed domain '@{allowed_domain}'."
            )
            return False

    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        user = db.scalar(select(User).where(User.email == email))

        if user:
            user.password_hash = hash_password(password)
            user.is_platform_admin = True
            user.is_active = True
            logger.info(f"Existing user '{email}' promoted to platform administrator.")
        else:
            user = User(
                id=uuid.uuid4(),
                email=email,
                full_name="Platform Administrator",
                password_hash=hash_password(password),
                is_platform_admin=True,
                is_active=True,
            )
            db.add(user)
            logger.info(f"Created new platform administrator '{email}'.")

        db.commit()
        logger.info(f"Platform administrator '{email}' successfully provisioned.")
        return True
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to bootstrap platform administrator: {exc}")
        return False
    finally:
        if own_session:
            db.close()


if __name__ == "__main__":
    success = bootstrap_platform_admin()
    sys.exit(0 if success else 1)
