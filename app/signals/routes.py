import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.database import get_db
from app.exceptions import SignalNotFoundError
from app.signals.schemas import SignalResponse
from app.signals.service import generate_signal, get_latest_signal, get_signal_history

router = APIRouter(prefix="/api/v1/signals", tags=["signals"])


def _envelope(data, meta: dict | None = None):
    return {
        "status": "success",
        "data": data,
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat(), **(meta or {})},
    }


@router.get("/{symbol}")
async def get_latest(
    symbol: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    signal = await get_latest_signal(db, symbol.upper(), user_id=user.id)
    if not signal:
        raise SignalNotFoundError(f"No signal for {symbol}. Generate one first.")
    return _envelope(SignalResponse.model_validate(signal).model_dump())


@router.get("/{symbol}/history")
async def get_history(
    symbol: str,
    page: int = 1,
    per_page: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    per_page = min(per_page, 100)
    signals, total = await get_signal_history(db, symbol.upper(), page, per_page, user_id=user.id)
    return _envelope(
        [SignalResponse.model_validate(s).model_dump() for s in signals],
        meta={
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": math.ceil(total / per_page) if total else 0,
            }
        },
    )


@router.post("/{symbol}/generate")
async def trigger_generate(
    symbol: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    signal = await generate_signal(db, symbol.upper(), user_id=user.id)
    return _envelope(SignalResponse.model_validate(signal).model_dump())
