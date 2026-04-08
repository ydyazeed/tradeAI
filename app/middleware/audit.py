import time
import uuid
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

import structlog

logger = structlog.get_logger()


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        latency_ms = round((time.perf_counter() - start) * 1000)

        # Capture user_id BEFORE session potentially closes (as string, not ORM object)
        user = getattr(request.state, "user", None)
        user_id_str: str | None = None
        if user is not None:
            try:
                user_id_str = str(user.id)
            except Exception:
                pass
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))

        logger.info(
            "request",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            latency_ms=latency_ms,
            user_id=user_id_str,
            ip=request.client.host if request.client else None,
        )

        # Async DB write happens in background to avoid slowing the response
        if request.url.path not in ("/health", "/metrics", "/docs", "/openapi.json"):
            import asyncio
            asyncio.create_task(
                _write_audit_log(
                    user_id=user_id_str,
                    action="API_REQUEST",
                    endpoint=request.url.path,
                    method=request.method,
                    ip_address=request.client.host if request.client else "unknown",
                    user_agent=request.headers.get("user-agent", ""),
                    status_code=response.status_code,
                    response_time_ms=latency_ms,
                    request=request,
                )
            )

        return response


async def _write_audit_log(**kwargs) -> None:
    try:
        from app.database import AsyncSessionLocal
        from app.audit.models import AuditLog

        request = kwargs.pop("request")
        async with AsyncSessionLocal() as session:
            log = AuditLog(
                id=uuid.uuid4(),
                user_id=kwargs.get("user_id"),
                action=kwargs["action"],
                endpoint=kwargs["endpoint"],
                method=kwargs["method"],
                ip_address=kwargs["ip_address"],
                user_agent=kwargs["user_agent"],
                status_code=kwargs["status_code"],
                response_time_ms=kwargs["response_time_ms"],
                created_at=datetime.now(timezone.utc),
            )
            session.add(log)
            await session.commit()
    except Exception as e:
        logger.warning("audit_log_write_failed", error=str(e))
