import uuid
from datetime import datetime, timezone

import structlog
import yfinance as yf
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from tenacity import retry, stop_after_attempt, wait_exponential

from app.market_data.models import OHLCV, TrackedSymbol, UserSymbol

logger = structlog.get_logger()


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
async def fetch_and_store_symbol(db: AsyncSession, symbol: str, period: str = "3mo") -> int:
    """Fetch OHLCV data from yfinance and upsert into DB. Returns rows stored."""
    import asyncio

    log = logger.bind(symbol=symbol)

    def _download():
        ticker = yf.Ticker(symbol)
        return ticker.history(period=period, auto_adjust=True)

    df = await asyncio.get_event_loop().run_in_executor(None, _download)

    if df.empty:
        log.warning("yfinance_empty_response")
        return 0

    now = datetime.now(timezone.utc)
    rows = []
    for ts, row in df.iterrows():
        ts_utc = ts.to_pydatetime()
        if ts_utc.tzinfo is None:
            import pytz
            ts_utc = pytz.utc.localize(ts_utc)
        import math
        open_ = float(row["Open"])
        high_ = float(row["High"])
        low_ = float(row["Low"])
        close_ = float(row["Close"])
        vol_ = row["Volume"]
        # Skip rows with NaN price data
        if any(math.isnan(v) for v in [open_, high_, low_, close_]):
            continue
        rows.append({
            "symbol": symbol,
            "timestamp": ts_utc,
            "open": open_,
            "high": high_,
            "low": low_,
            "close": close_,
            "volume": int(vol_) if not math.isnan(float(vol_)) else 0,
            "source": "yfinance",
            "fetched_at": now,
        })

    if rows:
        stmt = insert(OHLCV).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["symbol", "timestamp"],
            set_={
                "open": stmt.excluded.open,
                "high": stmt.excluded.high,
                "low": stmt.excluded.low,
                "close": stmt.excluded.close,
                "volume": stmt.excluded.volume,
                "fetched_at": stmt.excluded.fetched_at,
            },
        )
        await db.execute(stmt)
        await db.commit()

    log.info("ohlcv_stored", rows=len(rows))
    return len(rows)


async def get_ohlcv(db: AsyncSession, symbol: str, period: str = "3mo", limit: int = 100) -> list[OHLCV]:
    result = await db.execute(
        select(OHLCV).where(OHLCV.symbol == symbol).order_by(OHLCV.timestamp.desc()).limit(limit)
    )
    return list(reversed(result.scalars().all()))


async def get_latest_price(db: AsyncSession, symbol: str) -> OHLCV | None:
    result = await db.execute(
        select(OHLCV).where(OHLCV.symbol == symbol).order_by(OHLCV.timestamp.desc()).limit(1)
    )
    return result.scalar_one_or_none()


# ── Per-user symbol tracking ──────────────────────────────────────────────────

async def get_user_symbols(db: AsyncSession, user_id: uuid.UUID) -> list[TrackedSymbol]:
    """Returns TrackedSymbol rows for symbols the user is tracking."""
    result = await db.execute(
        select(TrackedSymbol)
        .join(UserSymbol, UserSymbol.symbol == TrackedSymbol.symbol)
        .where(UserSymbol.user_id == user_id, TrackedSymbol.is_active == True)
        .order_by(UserSymbol.added_at.asc())
    )
    return list(result.scalars().all())


async def add_user_symbol(
    db: AsyncSession,
    user_id: uuid.UUID,
    symbol: str,
    name: str,
    asset_class: str = "stock",
    exchange: str = "",
) -> TrackedSymbol:
    """Ensure symbol exists in tracked_symbols, then add to user's list."""
    symbol = symbol.upper()

    # Upsert into tracked_symbols (shared registry)
    existing = await db.get(TrackedSymbol, symbol)
    if existing:
        existing.is_active = True
    else:
        existing = TrackedSymbol(
            symbol=symbol, name=name, asset_class=asset_class,
            exchange=exchange, is_active=True, added_at=datetime.now(timezone.utc),
        )
        db.add(existing)
        await db.flush()

    # Add to user_symbols if not already there
    check = await db.execute(
        select(UserSymbol).where(UserSymbol.user_id == user_id, UserSymbol.symbol == symbol)
    )
    if not check.scalar_one_or_none():
        db.add(UserSymbol(
            id=uuid.uuid4(), user_id=user_id, symbol=symbol,
            added_at=datetime.now(timezone.utc),
        ))
        await db.flush()

    return existing


async def remove_user_symbol(db: AsyncSession, user_id: uuid.UUID, symbol: str) -> None:
    """Remove symbol from user's list only — does not delete OHLCV data."""
    result = await db.execute(
        select(UserSymbol).where(UserSymbol.user_id == user_id, UserSymbol.symbol == symbol.upper())
    )
    row = result.scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.flush()
