import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.models import APIKey, User
from app.auth.schemas import (
    APIKeyCreateRequest,
    APIKeyCreatedResponse,
    APIKeyResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.auth.service import (
    authenticate_user,
    create_access_token,
    create_api_key,
    create_refresh_token,
    decode_token,
    get_user_by_id,
    register_user,
)
from app.database import get_db
from app.exceptions import AuthenticationError, NotFoundError

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _envelope(data, request_id: str = ""):
    from datetime import datetime, timezone
    return {
        "status": "success",
        "data": data,
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat(), "request_id": request_id},
    }


@router.post("/register")
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    user = await register_user(db, body.email, body.password)
    return _envelope(UserResponse.model_validate(user).model_dump())


@router.post("/login", response_model=None)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, body.email, body.password)
    return _envelope(
        TokenResponse(
            access_token=create_access_token(str(user.id), user.role),
            refresh_token=create_refresh_token(str(user.id)),
        ).model_dump()
    )


@router.post("/refresh")
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise AuthenticationError("Invalid refresh token")
    user = await get_user_by_id(db, payload["sub"])
    if not user or not user.is_active:
        raise AuthenticationError("User not found")
    return _envelope(
        TokenResponse(
            access_token=create_access_token(str(user.id), user.role),
            refresh_token=create_refresh_token(str(user.id)),
        ).model_dump()
    )


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return _envelope(UserResponse.model_validate(user).model_dump())


@router.post("/api-keys")
async def create_key(
    body: APIKeyCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    valid_scopes = {"read", "admin"}
    for s in body.scopes:
        if s not in valid_scopes:
            from app.exceptions import ValidationError
            raise ValidationError(f"Invalid scope: {s}")
    api_key, raw_key = await create_api_key(db, user.id, body.name, body.scopes)
    resp = APIKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        scopes=api_key.scopes,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at,
        key=raw_key,
    )
    return _envelope(resp.model_dump())


@router.get("/api-keys")
async def list_keys(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(APIKey).where(APIKey.user_id == user.id, APIKey.is_active == True)
    )
    keys = result.scalars().all()
    return _envelope([APIKeyResponse.model_validate(k).model_dump() for k in keys])


@router.delete("/api-keys/{key_id}")
async def revoke_key(
    key_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == user.id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise NotFoundError("API key not found")
    key.is_active = False
    return _envelope({"revoked": True})
