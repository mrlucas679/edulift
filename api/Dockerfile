FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.11.26 /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
COPY api/pyproject.toml api/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY api/ .
RUN uv sync --locked --no-dev

FROM python:3.12-slim
RUN useradd --create-home --uid 10001 edulift
WORKDIR /app
COPY --from=build --chown=edulift:edulift /app /app
# Reference data, loaded with: python -m app.seed /data
COPY --chown=edulift:edulift data /data
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1
USER edulift
EXPOSE 8000
# Migrate, then serve. env.py holds a Postgres lock so parallel tasks take turns.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000 --no-access-log --proxy-headers --forwarded-allow-ips='*'"]
