import uuid
from datetime import datetime, timezone

import pandas as pd
import structlog
import ta
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.indicators.models import IndicatorValue
from app.market_data.models import OHLCV

logger = structlog.get_logger()


async def compute_and_store_indicators(db: AsyncSession, symbol: str) -> int:
    """Compute technical indicators for a symbol and store results. Returns rows stored."""
    result = await db.execute(
        select(OHLCV)
        .where(OHLCV.symbol == symbol)
        .order_by(OHLCV.timestamp.asc())
        .limit(200)
    )
    rows = result.scalars().all()

    if len(rows) < 14:
        logger.warning("insufficient_data_for_indicators", symbol=symbol, rows=len(rows))
        return 0

    df = pd.DataFrame([{
        "timestamp": r.timestamp,
        "open": r.open,
        "high": r.high,
        "low": r.low,
        "close": r.close,
        "volume": r.volume,
    } for r in rows]).set_index("timestamp")

    close = df["close"]
    high = df["high"]
    low = df["low"]

    # RSI
    rsi = ta.momentum.RSIIndicator(close, window=14).rsi()

    # MACD
    macd_indicator = ta.trend.MACD(close)
    macd = macd_indicator.macd()
    macd_signal = macd_indicator.macd_signal()
    macd_hist = macd_indicator.macd_diff()

    # EMA
    ema_20 = ta.trend.EMAIndicator(close, window=20).ema_indicator()
    ema_50 = ta.trend.EMAIndicator(close, window=50).ema_indicator()

    # Bollinger Bands
    bb = ta.volatility.BollingerBands(close, window=20, window_dev=2)
    bb_upper = bb.bollinger_hband()
    bb_middle = bb.bollinger_mavg()
    bb_lower = bb.bollinger_lband()

    indicator_series = {
        "RSI": (rsi, {"window": 14}),
        "MACD": (macd, {"fast": 12, "slow": 26}),
        "MACD_SIGNAL": (macd_signal, {"signal": 9}),
        "MACD_HIST": (macd_hist, {}),
        "EMA_20": (ema_20, {"window": 20}),
        "EMA_50": (ema_50, {"window": 50}),
        "BB_UPPER": (bb_upper, {"window": 20, "dev": 2}),
        "BB_MIDDLE": (bb_middle, {"window": 20}),
        "BB_LOWER": (bb_lower, {"window": 20, "dev": 2}),
    }

    now = datetime.now(timezone.utc)

    # Delete existing indicators for this symbol before reinserting
    await db.execute(delete(IndicatorValue).where(IndicatorValue.symbol == symbol))

    count = 0
    for name, (series, params) in indicator_series.items():
        for ts, val in series.items():
            if pd.isna(val):
                continue
            ts_aware = ts
            if hasattr(ts, 'to_pydatetime'):
                ts_aware = ts.to_pydatetime()
            if ts_aware.tzinfo is None:
                import pytz
                ts_aware = pytz.utc.localize(ts_aware)
            db.add(IndicatorValue(
                id=uuid.uuid4(),
                symbol=symbol,
                timestamp=ts_aware,
                indicator_name=name,
                value=float(val),
                parameters=params,
                computed_at=now,
            ))
            count += 1

    await db.commit()
    logger.info("indicators_computed", symbol=symbol, count=count)
    return count


async def get_latest_indicators(db: AsyncSession, symbol: str) -> dict[str, float | None]:
    """Returns latest value for each indicator for a symbol."""
    # Get the most recent timestamp with data
    result = await db.execute(
        select(IndicatorValue.indicator_name, IndicatorValue.value)
        .where(IndicatorValue.symbol == symbol)
        .order_by(IndicatorValue.timestamp.desc())
        .limit(50)
    )
    rows = result.all()

    # Take first occurrence of each indicator (most recent)
    seen: dict[str, float | None] = {}
    for name, val in rows:
        if name not in seen:
            seen[name] = val
    return seen


async def get_indicators_history(
    db: AsyncSession, symbol: str, indicator_names: list[str] | None = None, limit: int = 30
) -> list[IndicatorValue]:
    query = select(IndicatorValue).where(IndicatorValue.symbol == symbol)
    if indicator_names:
        query = query.where(IndicatorValue.indicator_name.in_(indicator_names))
    query = query.order_by(IndicatorValue.timestamp.desc()).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())
