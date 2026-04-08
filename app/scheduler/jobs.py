import structlog

logger = structlog.get_logger()


async def fetch_daily_data() -> None:
    from app.database import AsyncSessionLocal
    from app.market_data.service import fetch_and_store_symbol, get_tracked_symbols

    async with AsyncSessionLocal() as db:
        symbols = await get_tracked_symbols(db)
        for sym in symbols:
            try:
                rows = await fetch_and_store_symbol(db, sym.symbol)
                logger.info("daily_fetch_done", symbol=sym.symbol, rows=rows)
            except Exception as e:
                logger.error("daily_fetch_failed", symbol=sym.symbol, error=str(e))


async def compute_daily_indicators() -> None:
    from app.database import AsyncSessionLocal
    from app.indicators.service import compute_and_store_indicators
    from app.market_data.service import get_tracked_symbols

    async with AsyncSessionLocal() as db:
        symbols = await get_tracked_symbols(db)
        for sym in symbols:
            try:
                count = await compute_and_store_indicators(db, sym.symbol)
                logger.info("daily_indicators_done", symbol=sym.symbol, count=count)
            except Exception as e:
                logger.error("daily_indicators_failed", symbol=sym.symbol, error=str(e))


async def generate_daily_signals() -> None:
    from app.database import AsyncSessionLocal
    from app.market_data.service import get_tracked_symbols
    from app.signals.service import generate_signal

    async with AsyncSessionLocal() as db:
        symbols = await get_tracked_symbols(db)
        for sym in symbols:
            try:
                signal = await generate_signal(db, sym.symbol)
                logger.info(
                    "daily_signal_done",
                    symbol=sym.symbol,
                    direction=signal.direction,
                    confidence=signal.confidence,
                )
            except Exception as e:
                logger.error("daily_signal_failed", symbol=sym.symbol, error=str(e))
