# TradeAI — Project Requirements Document

## 1. Overview

TradeAI is a backend-heavy trading platform that ingests market data, computes technical indicators, and generates AI-powered trade signals using Anthropic Claude. Everything is exposed through a secure, audited REST API with a brutalist-inspired dashboard UI. Backend deployed on Railway (with PostgreSQL addon), frontend on Vercel.

**Target user:** Traders and developers who want AI-assisted trade signals with full transparency and audit trails.

---

## 2. User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **Admin** | Platform operator | Full access: manage users, view audit logs, configure system |
| **User** | Registered trader | View market data, indicators, signals; manage own API keys |
| **API Consumer** | Programmatic client | Access via API key; scoped to specific endpoints |
| **Guest** | Unauthenticated visitor | View landing page, register, login only |

---

## 3. User Flows

### 3.1 Registration & Authentication

```
Guest → /register → email + password → User created → JWT issued
Guest → /login → email + password → JWT issued (access + refresh)
User → /auth/api-keys → generate API key → use in X-API-Key header
```

- Passwords hashed with bcrypt (min 8 chars, complexity enforced)
- JWT access token: 30 min expiry
- JWT refresh token: 7 day expiry
- API keys: scoped (read-only, trade, admin), revocable, expirable

### 3.2 Market Data Flow

```
Scheduler (daily) → yfinance fetch → validate → store in OHLCV table
User → GET /api/v1/market-data/{symbol} → query params: period, interval → OHLCV JSON
User → GET /api/v1/market-data/symbols → list available symbols
User → POST /api/v1/market-data/{symbol}/fetch → trigger manual fetch (admin)
```

### 3.3 Indicator Flow

```
Scheduler (post-fetch) → compute indicators for all tracked symbols → store results
User → GET /api/v1/indicators/{symbol} → query params: indicator, period → indicator values
User → GET /api/v1/indicators/available → list supported indicators
```

### 3.4 Signal Generation Flow

```
Scheduler (post-indicators) → build prompt payload (OHLCV + indicators) → call Claude API
  → parse structured response → cache signal → store in DB + audit table
User → GET /api/v1/signals/{symbol} → latest signal (BUY/SELL/HOLD + confidence + reasoning)
User → GET /api/v1/signals/{symbol}/history → historical signals with pagination
Admin → GET /api/v1/audit/signals → full prompt/response audit trail
```

### 3.5 Dashboard Flow (Frontend)

```
Guest → Landing page (retro terminal aesthetic)
Guest → Login/Register → Dashboard
Dashboard → Market Overview (prices, sparklines, indicators at a glance)
Dashboard → Signal Panel (latest AI signals with reasoning cards)
Dashboard → Audit Log (admin only — searchable prompt/response history)
Dashboard → Settings (API keys, profile, preferences)
```

---

## 4. API Design

### 4.1 Base URL & Versioning

```
Base: /api/v1
Content-Type: application/json
Auth: Bearer <jwt> OR X-API-Key: <key>
```

### 4.2 Endpoints

#### Auth (`/api/v1/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | None | Create account |
| POST | `/login` | None | Get JWT tokens |
| POST | `/refresh` | Refresh token | Refresh access token |
| GET | `/me` | JWT | Get current user profile |
| POST | `/api-keys` | JWT | Generate new API key |
| GET | `/api-keys` | JWT | List user's API keys |
| DELETE | `/api-keys/{id}` | JWT | Revoke an API key |

#### Market Data (`/api/v1/market-data`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/symbols` | JWT/Key | List tracked symbols |
| GET | `/{symbol}` | JWT/Key | Get OHLCV data (query: period, interval) |
| GET | `/{symbol}/latest` | JWT/Key | Get latest price data |
| POST | `/{symbol}/fetch` | Admin | Trigger manual data fetch |
| POST | `/symbols` | Admin | Add symbol to tracking list |

#### Indicators (`/api/v1/indicators`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/available` | JWT/Key | List supported indicators |
| GET | `/{symbol}` | JWT/Key | Get computed indicators (query: indicators, period) |
| POST | `/{symbol}/compute` | Admin | Trigger manual indicator computation |

#### Signals (`/api/v1/signals`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/{symbol}` | JWT/Key | Get latest AI signal |
| GET | `/{symbol}/history` | JWT/Key | Historical signals (paginated) |
| POST | `/{symbol}/generate` | Admin | Trigger manual signal generation |

#### Audit (`/api/v1/audit`) — Admin Only

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/logs` | Admin | Query audit logs (paginated, filterable) |
| GET | `/signals` | Admin | Signal generation audit trail |
| GET | `/signals/{id}` | Admin | Full prompt/response for a signal |

#### System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | System health check |
| GET | `/metrics` | Admin/Key | System metrics |

### 4.3 Standard Response Envelope

```json
{
  "status": "success",
  "data": { ... },
  "meta": {
    "timestamp": "2026-04-07T12:00:00Z",
    "request_id": "corr-uuid-here",
    "pagination": {
      "page": 1,
      "per_page": 50,
      "total": 230,
      "total_pages": 5
    }
  }
}
```

### 4.4 Error Response

```json
{
  "status": "error",
  "error": {
    "code": "SIGNAL_GENERATION_FAILED",
    "message": "Claude API returned an unexpected response format",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2026-04-07T12:00:00Z",
    "request_id": "corr-uuid-here"
  }
}
```

---

## 5. Security Requirements

### 5.1 Authentication & Authorization

- JWT with RS256 or HS256 signing
- Refresh token rotation (old refresh token invalidated on use)
- API keys: hashed in DB (only shown once at creation), scoped to permissions (read, admin)
- Role-based access control (RBAC): admin, user, read-only
- Rate limiting: 100 req/min per user, 20 req/min for auth endpoints (slowapi)

### 5.2 Data Protection

- All passwords bcrypt-hashed with salt rounds >= 12
- API keys hashed with SHA-256 before storage
- Sensitive fields (password, key) never returned in API responses
- `.env` for secrets, never committed (`.gitignore`)
- CORS restricted to known origins
- HTTPS enforced in production (Railway handles backend TLS, Vercel handles frontend TLS)

### 5.3 Audit & Compliance

- Every authenticated API request logged: user_id, endpoint, method, IP, status_code, timestamp
- AI signal generation: full prompt text, full response text, token count, latency, cost logged
- Audit logs immutable (append-only table, no UPDATE/DELETE)
- Correlation ID on every request (X-Request-ID header)
- Structured JSON logs via structlog for machine parsing

### 5.4 Input Validation

- All inputs validated via Pydantic v2 schemas
- SQL injection prevented by SQLAlchemy parameterized queries
- No raw string interpolation in queries or prompts
- Symbol names validated against allowlist
- Pagination limits enforced (max 100 per page)

---

## 6. Data Models Summary

### Users & Auth
- **User**: id (UUID), email, hashed_password, role, is_active, created_at, updated_at
- **APIKey**: id (UUID), user_id (FK), key_hash, name, scopes (JSONB), is_active, created_at, expires_at

### Market Data
- **OHLCV**: symbol, timestamp (PK composite), open, high, low, close, volume, source, fetched_at
- **TrackedSymbol**: symbol (PK), name, asset_class, exchange, is_active, added_at

### Indicators
- **IndicatorValue**: id, symbol, timestamp, indicator_name, value (float), parameters (JSONB), computed_at

### Signals
- **Signal**: id (UUID), symbol, timestamp, direction (enum: BUY/SELL/HOLD), confidence (float 0-1), reasoning (text), risk_params (JSONB), model_used, created_at
- **SignalAudit**: id (UUID), signal_id (FK), prompt_text, response_text, input_tokens, output_tokens, latency_ms, cost_usd, created_at

### Audit
- **AuditLog**: id (UUID), user_id (FK nullable), action, endpoint, method, ip_address, user_agent, request_hash, status_code, response_time_ms, created_at

---

## 7. Folder Structure

```
tradeAI/
├── CLAUDE.md                        # Project context for AI assistants
├── docs/
│   ├── PRD.md                       # This file
│   ├── DESIGN.md                    # UI/UX design system
│   └── ARCHITECTURE.md              # Technical architecture
├── pyproject.toml                   # Poetry dependencies & tool config
├── poetry.lock
├── Dockerfile                       # Multi-stage production build
├── docker-compose.yml               # Local dev: app + PostgreSQL
├── .env.example                     # Template for environment variables
├── .pre-commit-config.yaml          # Ruff, mypy hooks
├── alembic.ini                      # Alembic config
├── alembic/
│   ├── env.py
│   └── versions/                    # Migration files
├── app/
│   ├── __init__.py
│   ├── main.py                      # FastAPI app factory, lifespan, middleware registration
│   ├── config.py                    # Pydantic Settings (env-based config)
│   ├── database.py                  # Async SQLAlchemy engine, session factory, Base
│   ├── exceptions.py                # Custom exception hierarchy + handlers
│   ├── middleware/
│   │   ├── __init__.py
│   │   ├── audit.py                 # Request/response audit logging
│   │   └── correlation.py           # X-Request-ID injection
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── models.py               # User, APIKey SQLAlchemy models
│   │   ├── schemas.py              # Pydantic request/response schemas
│   │   ├── service.py              # JWT, bcrypt, API key logic
│   │   ├── dependencies.py         # get_current_user, require_admin, etc.
│   │   └── routes.py               # /api/v1/auth/* endpoints
│   ├── market_data/
│   │   ├── __init__.py
│   │   ├── models.py               # OHLCV, TrackedSymbol models
│   │   ├── schemas.py
│   │   ├── service.py              # yfinance fetch, store, query
│   │   └── routes.py               # /api/v1/market-data/* endpoints
│   ├── indicators/
│   │   ├── __init__.py
│   │   ├── models.py               # IndicatorValue model
│   │   ├── schemas.py
│   │   ├── service.py              # pandas-ta computation engine
│   │   └── routes.py               # /api/v1/indicators/* endpoints
│   ├── signals/
│   │   ├── __init__.py
│   │   ├── models.py               # Signal, SignalAudit models
│   │   ├── schemas.py
│   │   ├── service.py              # Claude prompt pipeline + caching
│   │   ├── prompts.py              # Prompt templates and builders
│   │   └── routes.py               # /api/v1/signals/* endpoints
│   ├── audit/
│   │   ├── __init__.py
│   │   ├── models.py               # AuditLog model
│   │   ├── schemas.py
│   │   └── routes.py               # /api/v1/audit/* endpoints
│   └── scheduler/
│       ├── __init__.py
│       └── jobs.py                  # APScheduler job definitions
├── frontend/                        # Next.js + shadcn/ui dashboard
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── components.json              # shadcn config
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # Landing page
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   └── (dashboard)/
│   │       ├── layout.tsx
│   │       ├── overview/page.tsx
│   │       ├── signals/page.tsx
│   │       ├── audit/page.tsx
│   │       └── settings/page.tsx
│   ├── components/
│   │   ├── ui/                      # shadcn components
│   │   ├── charts/                  # Price charts, sparklines
│   │   ├── signals/                 # Signal cards, history table
│   │   └── layout/                  # Nav, sidebar, terminal header
│   └── lib/
│       ├── api.ts                   # API client
│       └── auth.ts                  # JWT management
└── tests/
    ├── conftest.py                  # Fixtures, test DB, TestClient factory
    ├── unit/
    │   ├── test_indicators.py
    │   ├── test_signals.py
    │   └── test_auth.py
    ├── integration/
    │   ├── test_market_data_api.py
    │   ├── test_signals_api.py
    │   └── test_auth_api.py
    └── e2e/
        └── test_pipeline.py
```

---

## 8. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| API response time (p95) | < 500ms for data queries |
| Signal generation latency | < 10s (includes Claude API call) |
| Data freshness | Daily OHLCV updated within 1 hour of market close |
| Uptime target | 99% (Railway + Vercel free tier constraints) |
| Max concurrent users | 50 (free tier scope) |
| Audit log retention | Indefinite (append-only) |
| Test coverage | > 80% on critical paths (auth, signals, audit) |
