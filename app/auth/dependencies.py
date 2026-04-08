from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import decode_token, get_user_by_api_key, get_user_by_id
from app.database import get_db
from app.exceptions import AuthenticationError, AuthorizationError

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    # Try JWT Bearer token
    if credentials:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise AuthenticationError("Invalid token type")
        user = await get_user_by_id(db, payload["sub"])
        if not user or not user.is_active:
            raise AuthenticationError("User not found or inactive")
        request.state.user = user
        return user

    # Try X-API-Key header
    api_key = request.headers.get("X-API-Key")
    if api_key:
        user = await get_user_by_api_key(db, api_key)
        if not user or not user.is_active:
            raise AuthenticationError("Invalid API key")
        request.state.user = user
        return user

    raise AuthenticationError("Authentication required")


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise AuthorizationError("Admin access required")
    return user


async def optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    try:
        return await get_current_user(request, credentials, db)
    except Exception:
        return None
