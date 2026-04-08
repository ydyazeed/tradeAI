from contextlib import asynccontextmanager
from datetime import datetime, timezone

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.exceptions import register_exception_handlers
from app.middleware.audit import AuditMiddleware
from app.middleware.correlation import CorrelationIDMiddleware

logger = structlog.get_logger()

scheduler = AsyncIOScheduler(timezone="US/Eastern")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("starting_up", env=settings.APP_ENV)

    # Register scheduler jobs
    from app.scheduler.jobs import (
        compute_daily_indicators,
        fetch_daily_data,
        generate_daily_signals,
    )
    scheduler.add_job(fetch_daily_data, trigger="cron", hour=16, minute=30, id="fetch_data")
    scheduler.add_job(compute_daily_indicators, trigger="cron", hour=16, minute=45, id="compute_indicators")
    scheduler.add_job(generate_daily_signals, trigger="cron", hour=17, minute=0, id="generate_signals")
    scheduler.start()

    yield

    scheduler.shutdown()
    from app.database import engine
    await engine.dispose()
    logger.info("shutdown_complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title="TradeAI",
        description="AI-powered trade signal platform",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Middleware (order matters — outermost first)
    app.add_middleware(AuditMiddleware)
    app.add_middleware(CorrelationIDMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception handlers
    register_exception_handlers(app)

    # Routers
    from app.auth.routes import router as auth_router
    from app.market_data.routes import router as market_data_router
    from app.indicators.routes import router as indicators_router
    from app.signals.routes import router as signals_router
    from app.audit.routes import router as audit_router

    app.include_router(auth_router)
    app.include_router(market_data_router)
    app.include_router(indicators_router)
    app.include_router(signals_router)
    app.include_router(audit_router)

    @app.get("/health", tags=["system"])
    async def health():
        from app.database import engine
        db_status = "up"
        db_latency = 0
        try:
            import time
            start = time.perf_counter()
            async with engine.connect() as conn:
                from sqlalchemy import text
                await conn.execute(text("SELECT 1"))
            db_latency = round((time.perf_counter() - start) * 1000)
        except Exception as e:
            db_status = f"down: {e}"

        next_job = None
        jobs = scheduler.get_jobs()
        if jobs:
            upcoming = [j for j in jobs if j.next_run_time]
            if upcoming:
                soonest = min(upcoming, key=lambda j: j.next_run_time)
                next_job = f"{soonest.id} at {soonest.next_run_time}"

        return {
            "status": "healthy" if db_status == "up" else "degraded",
            "checks": {
                "database": {"status": db_status, "latency_ms": db_latency},
                "scheduler": {"status": "running" if scheduler.running else "stopped", "next_job": next_job},
            },
            "version": "1.0.0",
        }

    @app.get("/metrics", tags=["system"])
    async def metrics():
        from app.database import AsyncSessionLocal
        from app.signals.models import SignalAudit
        from sqlalchemy import func, select

        today = datetime.now(timezone.utc).date()
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(func.sum(SignalAudit.cost_usd), func.count(SignalAudit.id)).where(
                    func.date(SignalAudit.created_at) == today
                )
            )
            row = result.one()
            spent_today = float(row[0] or 0)
            signals_today = int(row[1] or 0)

        return {
            "signals": {
                "generated_today": signals_today,
                "budget_spent_today_usd": round(spent_today, 4),
                "budget_limit_usd": settings.DAILY_BUDGET_USD,
            },
            "version": "1.0.0",
        }

    return app


app = create_app()
