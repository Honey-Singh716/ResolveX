from sqlalchemy import create_engine, text

from app.core.config import get_database_url

engine = create_engine(
    get_database_url(),
    pool_pre_ping=True,
)

try:
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT current_database(), current_user")
        )
        database, user = result.one()

        print("Database connection successful")
        print(f"Database: {database}")
        print(f"User: {user}")
finally:
    engine.dispose()