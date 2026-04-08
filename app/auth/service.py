import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
import bcrypt as _bcrypt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import APIKey, User
from app.config import settings
from app.exceptions import (
    AuthenticationError,
    InvalidAPIKeyError,
    InvalidCredentialsError,
    TokenExpiredError,
)

def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise TokenExpiredError("Token has expired")
    except JWTError:
        raise AuthenticationError("Invalid token")


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def generate_api_key() -> tuple[str, str]:
    """Returns (raw_key, hashed_key)"""
    raw = "sk-" + secrets.token_urlsafe(32)
    return raw, hash_api_key(raw)


async def register_user(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise AuthenticationError("Email already registered")

    # First user to register is automatically admin
    count_result = await db.execute(select(func.count()).select_from(User))
    user_count = count_result.scalar_one()
    role = "admin" if user_count == 0 else "user"

    now = datetime.now(timezone.utc)
    user = User(
        id=uuid.uuid4(),
        email=email,
        hashed_password=hash_password(password),
        role=role,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    await db.flush()
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.hashed_password):
        raise InvalidCredentialsError("Invalid email or password")
    if not user.is_active:
        raise InvalidCredentialsError("Account is disabled")

    return user


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_api_key(
    db: AsyncSession, user_id: uuid.UUID, name: str, scopes: list[str]
) -> tuple[APIKey, str]:
    raw_key, key_hash = generate_api_key()
    now = datetime.now(timezone.utc)
    api_key = APIKey(
        id=uuid.uuid4(),
        user_id=user_id,
        key_hash=key_hash,
        name=name,
        scopes=scopes,
        is_active=True,
        created_at=now,
    )
    db.add(api_key)
    await db.flush()
    return api_key, raw_key


async def get_user_by_api_key(db: AsyncSession, raw_key: str) -> User | None:
    key_hash = hash_api_key(raw_key)
    result = await db.execute(
        select(APIKey).where(APIKey.key_hash == key_hash, APIKey.is_active == True)
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise InvalidAPIKeyError("Invalid API key")

    now = datetime.now(timezone.utc)
    if api_key.expires_at and api_key.expires_at < now:
        raise InvalidAPIKeyError("API key has expired")

    return await get_user_by_id(db, api_key.user_id)
