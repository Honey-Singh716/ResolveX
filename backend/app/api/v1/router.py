from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.client_issues import router as client_issues_router
from app.api.v1.health import router as health_router
from app.api.v1.issues import router as issues_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.organizations import router as organizations_router
from app.api.v1.platform import router as platform_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(client_issues_router)
api_router.include_router(organizations_router)
api_router.include_router(issues_router)
api_router.include_router(notifications_router)
api_router.include_router(platform_router)