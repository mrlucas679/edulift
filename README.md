# EduLift

You enter your matric marks once. EduLift shows where you qualify (Plan A) and what's
still open to you when you don't (Plan B): other programmes, TVET colleges, bursaries,
learnerships and work. Then it sends you to the official site to apply, and helps you
keep track of what you've applied for.

A few things we hold ourselves to:

- Plain Python code decides eligibility. AI only explains a result that code already worked out.
- We never submit an application for you, and we never ask for your password to another site.
- Every requirement, date and fee on screen shows where it came from and when we last checked it.

Built for the FNB App of the Year hackathon.

## Running it locally

You need Docker, [uv](https://docs.astral.sh/uv/) and Node 22+.

```bash
docker compose up -d                       # Postgres on 127.0.0.1:5433

cd api
cp ../.env.example .env                    # then fill it in (see below)
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:create_app --factory --no-access-log --port 8020

cd ../mobile
cp .env.example .env                       # EXPO_PUBLIC_API_URL=http://127.0.0.1:8020
npm ci
npx expo start --web
```

For local work set `EDULIFT_ENV=local` and `IDENTITY_PROVIDER=fake` in `api/.env`. The
fake provider prints sign-in codes to the API log instead of emailing them. It refuses to
run when `EDULIFT_ENV=demo`.

Tests run against a real Postgres (the one from `docker compose`):

```bash
cd api && uv run pytest && uv run ruff check . && uv run mypy app tests alembic
cd mobile && npx tsc --noEmit && npx expo lint
```

## Layout

```
api/        FastAPI service, Alembic migrations, tests
mobile/     Expo app (Android and web)
docs/       product brief, requirements, architecture, decisions (docs/adr)
data/       seed data, one YAML file per institution, every record sourced
infra/      AWS setup
```

## Docs

Start with [the product brief](docs/01-product-brief.md), then
[requirements](docs/02-requirements.md) and [architecture](docs/03-architecture.md).
Decisions and the reasons for them live in [docs/adr](docs/adr/README.md).
