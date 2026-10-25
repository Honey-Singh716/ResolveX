
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.scripts.bootstrap_admin import bootstrap_platform_admin



@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        bootstrap_platform_admin()
    except Exception:
        pass
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Configurable issue and service management platform.",
    lifespan=lifespan,
)

# In production, set ALLOWED_ORIGINS as a comma-separated list of frontend URLs.
# e.g. ALLOWED_ORIGINS=https://resolvex.up.railway.app
# Falls back to localhost origins for local development.
_raw_origins = settings.allowed_origins or ""
_production_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
_dev_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
allow_origins = _production_origins if _production_origins else _dev_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["Root"])
def root() -> dict[str, str]:
    return {
        "message": "Welcome to ResolveX",
        "docs": "/docs",
    }
