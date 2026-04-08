import json
import time
import uuid
from datetime import datetime, timezone

import anthropic
import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.exceptions import BudgetExceededError, SignalGenerationError
from app.indicators.service import get_latest_indicators
from app.market_data.service import get_ohlcv
from app.signals.models import Signal, SignalAudit
from app.signals.prompts import SYSTEM_PROMPT, build_prompt
from app.signals.schemas import SignalResponse

logger = structlog.get_logger()


# Simple in-memory cache: {symbol: (date_str, signal_id)}
_signal_cache: dict[str, tuple[str, uuid.UUID]] = {}


async def check_daily_budget(db: AsyncSession) -> float:
    today = datetime.now(timezone.utc).date()
    result = await db.execute(
        select(func.sum(SignalAudit.cost_usd)).where(
            func.date(SignalAudit.created_at) == today
        )
    )
    spent = result.scalar_one_or_none() or 0.0
    return float(spent)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
async def _call_claude(prompt: str, model: str) -> tuple[str, int, int]:
    """Returns (response_text, input_tokens, output_tokens)"""
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    message = await client.messages.create(
        model=model,
        max_tokens=1024,
        temperature=0.3,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    text = message.content[0].text
    return text, message.usage.input_tokens, message.usage.output_tokens


def _estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    # Rough pricing per million tokens
    pricing = {
        "claude-haiku-4-5-20251001": (0.80, 4.00),
        "claude-sonnet-4-6": (3.00, 15.00),
    }
    in_price, out_price = pricing.get(model, (3.00, 15.00))
    return (input_tokens * in_price + output_tokens * out_price) / 1_000_000


async def generate_signal(db: AsyncSession, symbol: str, user_id: uuid.UUID | None = None) -> Signal:
    today = datetime.now(timezone.utc).date().isoformat()
    cache_key = f"{symbol}:{today}"

    # Check cache (disabled in dev so re-generation always works)
    if False and cache_key in _signal_cache:
        cached_id = _signal_cache[cache_key][1]
        result = await db.execute(select(Signal).where(Signal.id == cached_id))
        cached = result.scalar_one_or_none()
        if cached:
            logger.info("signal_cache_hit", symbol=symbol)
            return cached

    # Check budget
    spent = await check_daily_budget(db)
    if spent >= settings.DAILY_BUDGET_USD:
        raise BudgetExceededError(
            f"Daily budget of ${settings.DAILY_BUDGET_USD:.2f} exceeded. Spent: ${spent:.2f}"
        )

    # Gather data
    ohlcv_rows = await get_ohlcv(db, symbol, limit=30)
    if not ohlcv_rows:
        raise SignalGenerationError(f"No market data for {symbol}. Fetch data first.")

    indicators = await get_latest_indicators(db, symbol)

    ohlcv_data = [{
        "timestamp": r.timestamp.isoformat(),
        "open": r.open,
        "high": r.high,
        "low": r.low,
        "close": r.close,
        "volume": r.volume,
    } for r in ohlcv_rows]

    prompt = build_prompt(symbol, ohlcv_data, indicators, today)
    model = settings.active_claude_model

    logger.info("generating_signal", symbol=symbol, model=model)
    start = time.perf_counter()

    try:
        response_text, input_tokens, output_tokens = await _call_claude(prompt, model)
    except Exception as e:
        raise SignalGenerationError(f"Claude API error: {str(e)}")

    latency_ms = round((time.perf_counter() - start) * 1000)

    # Parse response
    try:
        # Strip markdown code fences if present
        clean = response_text.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        parsed = json.loads(clean)
    except (json.JSONDecodeError, IndexError) as e:
        raise SignalGenerationError(f"Failed to parse Claude response: {str(e)}")

    direction = parsed.get("direction", "HOLD")
    if direction not in ("BUY", "SELL", "HOLD"):
        direction = "HOLD"

    confidence = float(parsed.get("confidence", 0.5))
    confidence = max(0.0, min(1.0, confidence))

    # Merge all structured data into risk_params JSONB (no schema change needed)
    risk_params = {
        **(parsed.get("risk_parameters") or {}),
        "timeframe_analysis": parsed.get("timeframe_analysis", {}),
        "technical_context": parsed.get("technical_context", {}),
    }
    cost = _estimate_cost(model, input_tokens, output_tokens)

    now = datetime.now(timezone.utc)
    signal = Signal(
        id=uuid.uuid4(),
        symbol=symbol,
        timestamp=now,
        direction=direction,
        confidence=confidence,
        reasoning=parsed.get("reasoning", ""),
        risk_params=risk_params,
        model_used=model,
        user_id=user_id,
        created_at=now,
    )
    db.add(signal)
    await db.flush()

    signal_audit = SignalAudit(
        id=uuid.uuid4(),
        signal_id=signal.id,
        prompt_text=prompt,
        response_text=response_text,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=latency_ms,
        cost_usd=cost,
        created_at=now,
    )
    db.add(signal_audit)
    await db.commit()

    _signal_cache[cache_key] = (today, signal.id)

    logger.info(
        "signal_generated",
        symbol=symbol,
        direction=direction,
        confidence=confidence,
        latency_ms=latency_ms,
        cost_usd=cost,
    )
    return signal


async def get_latest_signal(db: AsyncSession, symbol: str, user_id: uuid.UUID | None = None) -> Signal | None:
    query = select(Signal).where(Signal.symbol == symbol)
    if user_id is not None:
        query = query.where(Signal.user_id == user_id)
    result = await db.execute(
        query
        .order_by(Signal.timestamp.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_signal_history(
    db: AsyncSession, symbol: str, page: int = 1, per_page: int = 20,
    user_id: uuid.UUID | None = None,
) -> tuple[list[Signal], int]:
    offset = (page - 1) * per_page
    base = select(Signal).where(Signal.symbol == symbol)
    count_base = select(func.count()).select_from(Signal).where(Signal.symbol == symbol)
    if user_id is not None:
        base = base.where(Signal.user_id == user_id)
        count_base = count_base.where(Signal.user_id == user_id)

    result = await db.execute(base.order_by(Signal.timestamp.desc()).offset(offset).limit(per_page))
    signals = list(result.scalars().all())
    total = (await db.execute(count_base)).scalar_one()
    return signals, total
