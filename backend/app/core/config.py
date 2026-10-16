from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ResolveX API"
    app_version: str = "0.1.0"
    environment: str = "development"
    database_url: str | None = None
    jwt_secret_key: str
    access_token_expire_minutes: int = 30
    platform_admin_email: str | None = None
    platform_admin_password: str | None = None
    platform_admin_allowed_domain: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()


def get_database_url() -> str:
    url = settings.database_url

    if not url:
        raise RuntimeError(
            "DATABASE_URL is not configured. "
            "Set it in backend/.env."
        )

    # Use the explicitly installed psycopg 3 driver.
    if url.startswith("postgres://"):
        url = url.replace(
            "postgres://",
            "postgresql+psycopg://",
            1,
        )
    elif url.startswith("postgresql://"):
        url = url.replace(
            "postgresql://",
            "postgresql+psycopg://",
            1,
        )

    return url