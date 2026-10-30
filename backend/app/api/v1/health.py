
from fastapi import APIRouter, Response

from app.core.config import settings

router = APIRouter(tags=["Health"])


@router.api_route("/health", methods=["GET", "HEAD"])
def health_check(response: Response) -> dict[str, str]:
    """
    Publicly accessible health check endpoint.

    Supports both GET and HEAD so that monitoring services such as
    UptimeRobot work correctly regardless of which method they use.

    - GET  → HTTP 200, JSON body {"status": "healthy", ...}
    - HEAD → HTTP 200, same response headers, empty body (per HTTP spec)

    No authentication required. Does not query the database or expose
    any sensitive configuration.
    """
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
    }
