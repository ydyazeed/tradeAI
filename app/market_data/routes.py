from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.database import get_db
from app.exceptions import NotFoundError, SymbolNotFoundError
from app.market_data.schemas import AddSymbolRequest, OHLCVPoint, SymbolResponse
from app.market_data.service import (
    add_user_symbol,
    fetch_and_store_symbol,
    get_latest_price,
    get_ohlcv,
    get_user_symbols,
    remove_user_symbol,
)

router = APIRouter(prefix="/api/v1/market-data", tags=["market-data"])


def _envelope(data, meta: dict | None = None):
    return {
        "status": "success",
        "data": data,
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat(), **(meta or {})},
    }


@router.get("/symbols")
async def list_symbols(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    symbols = await get_user_symbols(db, user.id)
    return _envelope([SymbolResponse.model_validate(s).model_dump() for s in symbols])


@router.post("/symbols")
async def add_symbol(
    body: AddSymbolRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sym = await add_user_symbol(db, user.id, body.symbol, body.name, body.asset_class, body.exchange)
    return _envelope(SymbolResponse.model_validate(sym).model_dump())


@router.delete("/symbols/{symbol}")
async def remove_symbol(
    symbol: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await remove_user_symbol(db, user.id, symbol.upper())
    return _envelope({"removed": symbol.upper()})


@router.get("/{symbol}")
async def get_market_data(
    symbol: str,
    period: str = "3mo",
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await get_ohlcv(db, symbol.upper(), period, min(limit, 500))
    if not rows:
        raise SymbolNotFoundError(f"No data for {symbol}. Try fetching first.")
    points = [OHLCVPoint.model_validate(r).model_dump() for r in rows if r.close and r.close > 0]
    return _envelope(points, meta={"count": len(points)})


@router.get("/{symbol}/latest")
async def get_latest(
    symbol: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await get_latest_price(db, symbol.upper())
    if not row:
        raise SymbolNotFoundError(f"No data for {symbol}")
    return _envelope(OHLCVPoint.model_validate(row).model_dump())


@router.post("/{symbol}/fetch")
async def fetch_data(
    symbol: str,
    period: str = "3mo",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await fetch_and_store_symbol(db, symbol.upper(), period)
    return _envelope({"symbol": symbol.upper(), "rows_stored": count})
