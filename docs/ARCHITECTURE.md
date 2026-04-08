# TradeAI — Architecture Document

## 1. System Overview

```
                           ┌──────────────────────────────────────┐
                           │           CLIENTS                     │
                           │  Browser (Next.js)  │  API Consumers  │
                           └──────────┬───────────┬───────────────┘
                                      │           │
                                 HTTPS│      X-API-Key
                                      │           │
┌─────────────────────────────────────▼───────────▼────────────────────────┐
│                          FASTAPI APPLICATION                             │
│                                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐  │
│  │ Correlation  │→ │ Rate Limiter │→ │ Auth Resolver │→ │ Audit       │  │
│  │ ID Middleware│  │ (slowapi)    │  │ (JWT/API Key) │  │ Middleware  │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  └─────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                         DOMAIN MODULES                             │  │
│  │                                                                    │  │
│  │  ┌──────────┐  ┌────────────┐  ┌─────────┐  ┌─────────────────┐  │  │
│  │  │  Auth    │  │ Market     │  │Indicators│  │ Signals         │  │  │
│  │  │         │  │ Data       │  │         │  │ (Claude AI)     │  │  │
│  │  │ routes  │  │ routes     │  │ routes  │  │ routes          │  │  │
│  │  │ service │  │ service    │  │ service │  │ service         │  │  │
│  │  │ models  │  │ models     │  │ models  │  │ prompts         │  │  │
│  │  │ schemas │  │ schemas    │  │ schemas │  │ models/schemas  │  │  │
│  │  └──────────┘  └────────────┘  └─────────┘  └─────────────────┘  │  │
│  │                                                                    │  │
│  │  ┌──────────┐                                                     │  │
│  │  │ Audit    │                                                     │  │
│  │  │          │                                                     │  │
│  │  │ routes   │                                                     │  │
│  │  │ models   │                                                     │  │
│  │  │ schemas  │                                                     │  │
│  │  └──────────┘                                                     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────┐  ┌──────────────────────────────────────────┐  │
│  │ APScheduler          │  │ structlog (JSON logging)                 │  │
│  │ (in-process cron)    │  │ + correlation ID propagation             │  │
│  └──────────────────────┘  └──────────────────────────────────────────┘  │
└───────────────┬──────────────────────────────┬───────────────────────────┘
                │                              │
        ┌───────▼───────┐             ┌────────▼────────┐
        │ PostgreSQL    │             │ Anthropic API   │
        │               │             │ (Claude)        │
        └───────────────┘             └─────────────────┘
```

---

## 2. Architecture Pattern: Modular Monolith

The application is a **single FastAPI process** with strict domain boundaries. Each domain module (`auth/`, `market_data/`, `indicators/`, `signals/`, `audit/`) is a self-contained package with its own models, schemas, services, and routes.

### Why modular monolith (not microservices)

- **Single deployment unit** — one Docker container, one Railway service, one process
- **Shared database** — all modules use the same PostgreSQL instance via SQLAlchemy
- **In-process scheduling** — APScheduler runs inside the FastAPI lifespan
- **Clear boundaries** — modules only interact through service-layer imports, never raw model access across domains
- **Microservice-ready** — if needed later, each module can be extracted into its own service because dependencies are already explicit

### Module dependency rules

```
auth         → (standalone, no domain dependencies)
market_data  → (standalone)
indicators   → market_data (reads OHLCV data)
signals      → market_data, indicators (reads both for prompt building)
audit        → (standalone, receives data from middleware)
scheduler    → market_data, indicators, signals (orchestrates pipeline)
```

No circular dependencies. The `scheduler` module is the only cross-cutting orchestrator.

---

## 3. Data Flow Pipeline

### 3.1 Daily Pipeline (Scheduled)

```
┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────┐
│ APScheduler  │───→│ Market Data      │───→│ Indicators       │───→│ Signals      │
│ (cron: daily │    │ Service          │    │ Service          │    │ Service      │
│  16:30 ET)   │    │                  │    │                  │    │              │
│              │    │ 1. Fetch OHLCV   │    │ 1. Load OHLCV    │    │ 1. Build     │
│              │    │    from yfinance  │    │ 2. Compute via   │    │    prompt    │
│              │    │ 2. Validate data │    │    pandas-ta      │    │ 2. Check     │
│              │    │ 3. Upsert into   │    │ 3. Store results │    │    cache     │
│              │    │    ohlcv table    │    │                  │    │ 3. Call      │
│              │    │ 4. Log result    │    │                  │    │    Claude    │
│              │    │                  │    │                  │    │ 4. Parse     │
│              │    │                  │    │                  │    │    response  │
│              │    │                  │    │                  │    │ 5. Cache +   │
│              │    │                  │    │                  │    │    store     │
│              │    │                  │    │                  │    │ 6. Audit log │
└──────────────┘    └──────────────────┘    └──────────────────┘    └──────────────┘
```

### 3.2 Request Flow (API)

```
HTTP Request
  │
  ▼
Correlation ID Middleware  →  generates UUID, sets X-Request-ID header
  │
  ▼
Rate Limiter (slowapi)     →  checks per-user/per-IP limits, returns 429 if exceeded
  │
  ▼
Auth Resolver              →  extracts JWT or API key, resolves user, sets request.state.user
  │
  ▼
Route Handler              →  calls service layer, returns Pydantic schema
  │
  ▼
Audit Middleware            →  logs request metadata (user, endpoint, status, latency) to AuditLog
  │
  ▼
HTTP Response (JSON envelope)
```

---

## 4. Database Architecture

### 4.1 Engine: PostgreSQL 16

- **Async driver**: `asyncpg` via SQLAlchemy 2.0 async engine
- **Session management**: `async_sessionmaker` with `expire_on_commit=False`
- **Connection pooling**: SQLAlchemy pool (pool_size=5, max_overflow=10 for free tier)
- **Production**: Railway PostgreSQL addon (managed, free tier)

### 4.2 Schema Layout

```sql
-- Schema: public (default)

-- Auth tables
users                   -- UUID PK, email unique, hashed_password, role enum, timestamps
api_keys                -- UUID PK, user_id FK, key_hash, name, scopes JSONB, timestamps

-- Market data
ohlcv                   -- (symbol, timestamp) composite PK, OHLCV columns, source

tracked_symbols         -- symbol PK, name, asset_class, exchange, is_active

-- Indicators
indicator_values        -- UUID PK, symbol, timestamp, indicator_name, value, params JSONB

-- Signals
signals                 -- UUID PK, symbol, timestamp, direction enum, confidence, reasoning
signal_audits           -- UUID PK, signal_id FK, prompt_text, response_text, token counts, cost

-- Audit
audit_logs              -- UUID PK, user_id FK nullable, action, endpoint, method, ip, status, latency
  → Append-only (no UPDATE/DELETE allowed via application layer)
```

### 4.3 Indexing Strategy

```sql
-- OHLCV: symbol + time lookups
CREATE INDEX idx_ohlcv_symbol ON ohlcv (symbol, timestamp DESC);

-- Indicators: query by symbol + indicator name
CREATE INDEX idx_indicator_symbol_name ON indicator_values (symbol, indicator_name, timestamp DESC);

-- Signals: latest signal per symbol
CREATE INDEX idx_signal_symbol_time ON signals (symbol, timestamp DESC);

-- Audit: query by user, time range
CREATE INDEX idx_audit_user_time ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_endpoint ON audit_logs (endpoint, created_at DESC);

-- API keys: lookup by hash
CREATE UNIQUE INDEX idx_apikey_hash ON api_keys (key_hash);
```

### 4.4 Migrations

Alembic with auto-generation from SQLAlchemy models:

```
alembic/
├── env.py          # Async engine config, target_metadata from Base
└── versions/
    ├── 001_initial_auth.py
    ├── 002_market_data.py
    ├── 003_indicators.py
    └── 004_signals_and_audit.py
```

Each migration is atomic and reversible.

---

## 5. Authentication & Authorization Architecture

### 5.1 Dual Auth Strategy

```
                    ┌──────────────┐
                    │ HTTP Request │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Auth Resolver │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼──┐  ┌─────▼─────┐  ┌──▼──────────┐
     │ Bearer JWT│  │ X-API-Key │  │ No Auth     │
     │           │  │           │  │ (public)    │
     └─────┬─────┘  └─────┬─────┘  └──┬──────────┘
           │              │            │
     ┌─────▼─────┐  ┌─────▼─────┐     │
     │ Decode &  │  │ Hash key, │     │
     │ Verify    │  │ lookup in │     │
     │ JWT       │  │ api_keys  │     │
     └─────┬─────┘  └─────┬─────┘     │
           │              │            │
           └──────┬───────┘            │
                  │                    │
           ┌──────▼───────┐            │
           │ User object  │            │
           │ + permissions │           │
           └──────┬───────┘            │
                  │                    │
           ┌──────▼───────────────▼────┐
           │ request.state.user        │
           │ (User | None)             │
           └───────────────────────────┘
```

### 5.2 Permission Model

```python
# Scopes for API keys
SCOPES = {
    "read": ["market-data:read", "indicators:read", "signals:read"],
    "admin": ["read", "audit:read", "system:admin", "users:manage"],
}
```

FastAPI dependencies enforce access:

```python
# Usage in routes
@router.get("/signals/{symbol}")
async def get_signal(symbol: str, user: User = Depends(require_scope("signals:read"))):
    ...

@router.get("/audit/logs")
async def get_audit(user: User = Depends(require_admin)):
    ...
```

---

## 6. AI Signal Generation Architecture

### 6.1 Prompt Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    PROMPT BUILDER                            │
│                                                             │
│  Input:                                                     │
│  ├── OHLCV data (last 30 bars)                             │
│  ├── Computed indicators (RSI, MACD, EMA, BB)              │
│  ├── Symbol metadata (asset class, exchange)               │
│  └── Current date/time                                      │
│                                                             │
│  Output: Structured JSON prompt                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    CACHE CHECK                              │
│                                                             │
│  Key: hash(symbol + date + indicator_snapshot)              │
│  Hit → return cached Signal                                 │
│  Miss → proceed to Claude API                               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLAUDE API CALL                           │
│                                                             │
│  Client: anthropic.AsyncAnthropic                           │
│  Model:  env.CLAUDE_MODEL (haiku-4-5 | sonnet-4-6)         │
│  System: Trading analyst persona + output schema            │
│  User:   JSON payload with market data + indicators         │
│  Max tokens: 1024                                           │
│  Temperature: 0.3 (low for consistency)                     │
│                                                             │
│  Retry: tenacity, 3 attempts, exponential backoff           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    RESPONSE PARSER                           │
│                                                             │
│  Expected JSON structure:                                   │
│  {                                                          │
│    "direction": "BUY" | "SELL" | "HOLD",                   │
│    "confidence": 0.0 - 1.0,                                │
│    "reasoning": "string",                                   │
│    "risk_parameters": {                                     │
│      "stop_loss_pct": float,                               │
│      "take_profit_pct": float,                             │
│      "risk_reward_ratio": float                            │
│    }                                                        │
│  }                                                          │
│                                                             │
│  Validation: Pydantic schema parse, fallback on error       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    STORAGE                                   │
│                                                             │
│  1. Insert Signal record                                    │
│  2. Insert SignalAudit (prompt, response, tokens, cost)     │
│  3. Update cache                                            │
│  4. Log via structlog                                       │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Cost Control

```python
# Config
CLAUDE_MODEL = "claude-haiku-4-5-20251001"      # dev default
CLAUDE_MODEL_PROD = "claude-sonnet-4-6"  # demo/prod
DAILY_BUDGET_USD = 1.00                          # hard cap
MAX_SIGNALS_PER_DAY = 50                         # per symbol limit
```

Budget tracked via `signal_audits` table: `SUM(cost_usd) WHERE created_at >= today`. Exceeding budget returns a structured error, no silent failures.

---

## 7. Scheduling Architecture

### APScheduler Configuration

```python
# Runs inside FastAPI lifespan
scheduler = AsyncIOScheduler(timezone="US/Eastern")

# Job definitions
scheduler.add_job(fetch_daily_data,    trigger="cron", hour=16, minute=30)  # After US market close
scheduler.add_job(compute_indicators,  trigger="cron", hour=16, minute=45)  # After data fetch
scheduler.add_job(generate_signals,    trigger="cron", hour=17, minute=0)   # After indicators
```

Jobs are sequential by design: data → indicators → signals. Each job validates that the previous step completed successfully before proceeding.

---

## 8. Error Handling Architecture

### 8.1 Exception Hierarchy

```
TradeAIError (base)
├── AuthenticationError          → 401
│   ├── InvalidCredentialsError
│   ├── TokenExpiredError
│   └── InvalidAPIKeyError
├── AuthorizationError           → 403
│   └── InsufficientScopeError
├── NotFoundError                → 404
│   ├── SymbolNotFoundError
│   └── SignalNotFoundError
├── ValidationError              → 422
│   └── InvalidSymbolError
├── RateLimitError               → 429
├── ExternalServiceError         → 502
│   ├── DataFetchError           (yfinance failures)
│   └── SignalGenerationError    (Claude API failures)
├── BudgetExceededError          → 429
└── SystemError                  → 500
```

### 8.2 Retry Strategy (tenacity)

```python
# External API calls
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type((httpx.HTTPError, anthropic.APIError)),
    before_sleep=before_sleep_log(logger, log_level=logging.WARNING),
)
async def call_claude(prompt: str) -> dict:
    ...
```

---

## 9. Observability Architecture

### 9.1 Structured Logging (structlog)

Every log entry is JSON with consistent fields:

```json
{
  "timestamp": "2026-04-07T16:30:00.123Z",
  "level": "info",
  "event": "signal_generated",
  "request_id": "corr-uuid",
  "user_id": "user-uuid",
  "symbol": "AAPL",
  "direction": "BUY",
  "confidence": 0.87,
  "latency_ms": 2340,
  "model": "claude-sonnet-4-6"
}
```

### 9.2 Health Check (`GET /health`)

```json
{
  "status": "healthy",
  "checks": {
    "database": { "status": "up", "latency_ms": 3 },
    "data_freshness": { "status": "ok", "last_fetch": "2026-04-07T16:30:00Z", "age_minutes": 2 },
    "scheduler": { "status": "running", "next_job": "compute_indicators at 16:45" }
  },
  "version": "1.0.0",
  "uptime_seconds": 86400
}
```

### 9.3 Metrics (`GET /metrics`)

```json
{
  "requests": { "total": 12450, "by_status": { "2xx": 12100, "4xx": 320, "5xx": 30 } },
  "signals": { "generated_today": 15, "cache_hit_rate": 0.73, "avg_latency_ms": 2100 },
  "data": { "symbols_tracked": 10, "last_fetch": "2026-04-07T16:30:00Z" },
  "budget": { "spent_today_usd": 0.42, "limit_usd": 1.00, "remaining_pct": 0.58 }
}
```

---

## 10. Deployment Architecture

### 10.1 Local Development (Docker Compose)

```yaml
services:
  app:
    build: .
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [db]
    volumes: ["./app:/app/app"]     # hot reload

  db:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: tradeai
      POSTGRES_USER: tradeai
      POSTGRES_PASSWORD: tradeai_dev
    volumes: ["pgdata:/var/lib/postgresql/data"]

volumes:
  pgdata:
```

### 10.2 Production

```
Backend: Railway
├── Web Service (Dockerfile)
│   ├── FastAPI + Uvicorn
│   ├── APScheduler (in-process)
│   └── Env vars: DATABASE_URL, ANTHROPIC_API_KEY, JWT_SECRET, etc.
└── PostgreSQL Addon (managed, free tier)
    └── Connection string via DATABASE_URL

Frontend: Vercel
├── Next.js (auto-detected, zero-config deploy)
├── Env vars: NEXT_PUBLIC_API_URL (points to Railway backend)
└── Preview deploys on every PR
```

### 10.3 Dockerfile (Multi-stage)

```dockerfile
# Stage 1: Build
FROM python:3.12-slim AS builder
WORKDIR /build
COPY pyproject.toml poetry.lock ./
RUN pip install poetry && poetry export -f requirements.txt -o requirements.txt

# Stage 2: Runtime
FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /build/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

---

## 11. Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Python | 3.12 | Primary language |
| Framework | FastAPI | 0.115+ | Async web framework |
| Server | Uvicorn | 0.34+ | ASGI server |
| ORM | SQLAlchemy | 2.0+ | Async ORM with asyncpg |
| Migrations | Alembic | 1.14+ | Schema versioning |
| Database | PostgreSQL | 16 | Primary datastore (Railway addon) |
| AI | Anthropic SDK | 0.43+ | Claude API client |
| Market Data | yfinance | 0.2+ | Free OHLCV data |
| Indicators | pandas-ta | 0.3+ | Technical analysis library |
| Scheduling | APScheduler | 3.10+ | In-process cron jobs |
| Auth | python-jose | 3.3+ | JWT encoding/decoding |
| Hashing | passlib[bcrypt] | 1.7+ | Password hashing |
| Rate Limit | slowapi | 0.1+ | Per-user rate limiting |
| Logging | structlog | 24.4+ | Structured JSON logging |
| Retry | tenacity | 9.0+ | Retry with backoff |
| HTTP Client | httpx | 0.28+ | Async HTTP (TestClient) |
| Config | pydantic-settings | 2.7+ | Typed env-based config |
| Linting | Ruff | 0.8+ | Lint + format |
| Types | mypy | 1.13+ | Static type checking |
| Testing | pytest | 8.3+ | Test framework |
| Containers | Docker | latest | Containerization |
| Frontend | Next.js + shadcn/ui | 14+ | Dashboard UI |
| Backend Deploy | Railway | — | Backend + PostgreSQL hosting |
| Frontend Deploy | Vercel | — | Next.js hosting |
