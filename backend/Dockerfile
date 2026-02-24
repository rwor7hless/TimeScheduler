FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir \
    fastapi>=0.115.0 \
    "uvicorn[standard]>=0.30.0" \
    "sqlalchemy[asyncio]>=2.0.0" \
    asyncpg>=0.30.0 \
    alembic>=1.14.0 \
    pydantic-settings>=2.0.0 \
    PyJWT>=2.9.0 \
    "pwdlib[argon2]>=0.2.0" \
    apscheduler>=3.10.0 \
    python-multipart>=0.0.9 \
    "httpx>=0.27.0"

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
