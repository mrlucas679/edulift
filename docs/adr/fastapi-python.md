# FastAPI on Python 3.12

**Context.** We need typed request validation, a generated OpenAPI contract for the
front end, and a rules engine the whole team can read.

**Decision.** FastAPI + uvicorn, Pydantic v2 + pydantic-settings, SQLAlchemy 2 +
psycopg 3, Alembic, PyJWT[crypto], boto3, httpx, slowapi, pyyaml. Dev: pytest, ruff,
mypy, pip-audit. All versions pinned.

**Consequences.** OpenAPI is served at `/docs` in development only. Front-end types are
generated from it with `openapi-typescript`. The container runs as a non-root user.
