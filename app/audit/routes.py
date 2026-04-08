import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.models import AuditLog
from app.audit.schemas import AuditLogResponse
from app.auth.dependencies import require_admin
from app.auth.models import User
from app.database import get_db
from app.signals.models import Signal, SignalAudit
from app.signals.schemas import SignalAuditResponse, SignalResponse

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


def _envelope(data, meta: dict | None = None):
    return {
        "status": "success",
        "data": data,
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat(), **(meta or {})},
    }


@router.get("/logs")
async def get_logs(
    page: int = 1,
    per_page: int = 50,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    per_page = min(per_page, 100)
    offset = (page - 1) * per_page

    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).offset(offset).limit(per_page)
    )
    logs = list(result.scalars().all())

    count_result = await db.execute(select(func.count()).select_from(AuditLog))
    total = count_result.scalar_one()

    return _envelope(
        [AuditLogResponse.model_validate(l).model_dump() for l in logs],
        meta={
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": math.ceil(total / per_page) if total else 0,
            }
        },
    )


@router.get("/signals")
async def get_signal_audits(
    page: int = 1,
    per_page: int = 20,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    per_page = min(per_page, 100)
    offset = (page - 1) * per_page

    result = await db.execute(
        select(SignalAudit)
        .options(selectinload(SignalAudit.signal))
        .order_by(SignalAudit.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    audits = list(result.scalars().all())

    count_result = await db.execute(select(func.count()).select_from(SignalAudit))
    total = count_result.scalar_one()

    return _envelope(
        [SignalAuditResponse.model_validate(a).model_dump() for a in audits],
        meta={"pagination": {"page": page, "per_page": per_page, "total": total}},
    )


@router.get("/user-stats")
async def get_user_stats(
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Per-user breakdown: request count, signal count, token usage, cost."""
    from app.auth.models import User as UserModel

    # All users
    users_result = await db.execute(select(UserModel).order_by(UserModel.created_at.asc()))
    all_users = list(users_result.scalars().all())

    stats = []
    for u in all_users:
        uid = str(u.id)

        # Request count + status breakdown
        req_result = await db.execute(
            select(AuditLog.status_code, func.count(AuditLog.id))
            .where(AuditLog.user_id == uid)
            .group_by(AuditLog.status_code)
        )
        status_counts: dict[str, int] = {}
        total_requests = 0
        for status_code, count in req_result.all():
            bucket = f"{status_code // 100}xx"
            status_counts[bucket] = status_counts.get(bucket, 0) + count
            total_requests += count

        # Last seen
        last_result = await db.execute(
            select(func.max(AuditLog.created_at)).where(AuditLog.user_id == uid)
        )
        last_seen = last_result.scalar_one_or_none()

        # Signal count
        sig_result = await db.execute(
            select(func.count(Signal.id)).where(Signal.symbol.isnot(None))
        )
        # Signal audits don't have user_id — count all signals for now
        # (signals are platform-level, not per-user for now)
        sig_count_result = await db.execute(select(func.count(Signal.id)))
        total_signals = sig_count_result.scalar_one() if u.role == "admin" else 0

        # Token usage (only admin generates signals)
        token_result = await db.execute(
            select(
                func.sum(SignalAudit.input_tokens),
                func.sum(SignalAudit.output_tokens),
                func.sum(SignalAudit.cost_usd),
                func.count(SignalAudit.id),
            )
        )
        tok_row = token_result.one()
        tokens_in = int(tok_row[0] or 0)
        tokens_out = int(tok_row[1] or 0)
        total_cost = float(tok_row[2] or 0)
        signal_audit_count = int(tok_row[3] or 0)

        # Top endpoints for this user
        top_ep_result = await db.execute(
            select(AuditLog.endpoint, func.count(AuditLog.id).label("cnt"))
            .where(AuditLog.user_id == uid)
            .group_by(AuditLog.endpoint)
            .order_by(func.count(AuditLog.id).desc())
            .limit(5)
        )
        top_endpoints = [{"endpoint": ep, "count": cnt} for ep, cnt in top_ep_result.all()]

        stats.append({
            "user_id": uid,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_seen": last_seen.isoformat() if last_seen else None,
            "requests": {
                "total": total_requests,
                "by_status": status_counts,
            },
            "signals": signal_audit_count if u.role == "admin" else 0,
            "tokens": {
                "input": tokens_in if u.role == "admin" else 0,
                "output": tokens_out if u.role == "admin" else 0,
                "cost_usd": round(total_cost, 4) if u.role == "admin" else 0,
            },
            "top_endpoints": top_endpoints,
        })

    return _envelope(stats)


@router.get("/signals/{signal_id}")
async def get_signal_audit_detail(
    signal_id: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    import uuid as uuid_mod
    result = await db.execute(
        select(SignalAudit)
        .where(SignalAudit.signal_id == uuid_mod.UUID(signal_id))
        .options(selectinload(SignalAudit.signal))
    )
    audit = result.scalar_one_or_none()
    if not audit:
        from app.exceptions import NotFoundError
        raise NotFoundError("Signal audit not found")

    return _envelope({
        "audit": SignalAuditResponse.model_validate(audit).model_dump(),
        "signal": SignalResponse.model_validate(audit.signal).model_dump() if audit.signal else None,
    })
