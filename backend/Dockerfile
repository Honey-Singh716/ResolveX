# ============================================================
# ResolveX Backend — Production Dockerfile
# ============================================================
FROM python:3.13-slim

# Set working directory
WORKDIR /app    

# Install system deps needed by psycopg (libpq) and argon2-cffi
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Expose default port (Render / platforms inject $PORT dynamically)
EXPOSE 8000

# Start: run migrations then launch Uvicorn
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
