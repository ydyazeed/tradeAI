# TradeAI

AI-powered trading platform: market data ingestion, technical indicators, Claude-generated trade signals, secure audited REST API.

## Documentation

- [docs/PRD.md](docs/PRD.md) — Requirements: API endpoints, user flows, security, data models, folder structure
- [docs/DESIGN.md](docs/DESIGN.md) — UI/UX: brutalist terminal aesthetic, shadcn/ui theme, color system, component specs, page layouts
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Architecture: system diagram, data flow pipeline, DB schema, auth model, AI pipeline, deployment

## Stack

**Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), PostgreSQL, Alembic, APScheduler
**AI:** Anthropic SDK (Haiku for dev, Sonnet for demo), structured JSON prompt pipeline, signal caching
**Frontend:** Next.js, shadcn/ui, Tailwind CSS — brutalist monospace terminal aesthetic
**Tooling:** Poetry, Ruff + mypy + pre-commit, Docker Compose, pytest

## Project Structure

```
app/                  # FastAPI backend (modular monolith)
  auth/               # JWT + API keys + bcrypt
  market_data/        # yfinance ingestion, OHLCV storage
  indicators/         # pandas-ta computation
  signals/            # Claude AI prompt pipeline + caching + audit
  audit/              # Append-only audit log
  scheduler/          # APScheduler cron jobs
  middleware/         # Correlation ID, audit logging
frontend/             # Next.js + shadcn/ui dashboard
tests/                # pytest: unit, integration, e2e
```

## Key Patterns

- **Modular monolith**: each domain is a self-contained package (models, schemas, service, routes)
- **Async everywhere**: asyncpg, async SQLAlchemy sessions, async route handlers
- **Dual auth**: JWT for web users, API keys for programmatic access
- **Audit trail**: every API request logged; AI signals store full prompt/response
- **Retry with backoff**: tenacity on all external calls (yfinance, Claude)
- **Structured logging**: structlog JSON with correlation IDs
- **API versioning**: all routes under `/api/v1/`

## Deployment

- **Backend:** Railway (FastAPI + PostgreSQL addon)
- **Frontend:** Vercel (Next.js)

## Commands

```bash
# Backend (local dev)
docker compose up db -d        # Start PostgreSQL on port 5433
poetry install                 # Install dependencies
alembic upgrade head           # Run migrations
uvicorn app.main:app --reload  # Start API at http://localhost:8000

# Frontend
cd frontend && npm install && npm run dev  # Start at http://localhost:3000

# Utility
pytest                         # Run tests
ruff check app/ tests/         # Lint
mypy app/                      # Type check
```
