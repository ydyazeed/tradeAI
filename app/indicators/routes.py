from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_current_user
from app.auth.models import User
from app.database import get_db
from app.indicators.schemas import SUPPORTED_INDICATORS, IndicatorValueResponse
from app.indicators.service import (
    compute_and_store_indicators,
    get_indicators_history,
    get_latest_indicators,
)

router = APIRouter(prefix="/api/v1/indicators", tags=["indicators"])


def _envelope(data, meta: dict | None = None):
    return {
        "status": "success",
        "data": data,
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat(), **(meta or {})},
    }


@router.get("/available")
async def list_available(_: User = Depends(get_current_user)):
    return _envelope(SUPPORTED_INDICATORS)


@router.get("/{symbol}")
async def get_indicators(
    symbol: str,
    indicators: str | None = None,
    limit: int = 30,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    names = indicators.split(",") if indicators else None
    rows = await get_indicators_history(db, symbol.upper(), names, min(limit, 200))
    latest = await get_latest_indicators(db, symbol.upper())
    return _envelope({
        "symbol": symbol.upper(),
        "latest": latest,
        "history": [IndicatorValueResponse.model_validate(r).model_dump() for r in rows],
    })


@router.post("/{symbol}/compute")
async def compute_indicators(
    symbol: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await compute_and_store_indicators(db, symbol.upper())
    return _envelope({"symbol": symbol.upper(), "values_stored": count})
