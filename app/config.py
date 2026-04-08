import json
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://tradeai:tradeai_dev@localhost:5433/tradeai"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_db_driver(cls, v):
        # Railway provides postgresql:// but asyncpg needs postgresql+asyncpg://
        if isinstance(v, str) and v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # JWT
    JWT_SECRET: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Anthropic
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-haiku-4-5-20251001"
    CLAUDE_MODEL_PROD: str = "claude-sonnet-4-6"
    DAILY_BUDGET_USD: float = 1.00

    # App
    APP_ENV: str = "development"
    DEBUG: bool = True
    CORS_ORIGINS: str = '["http://localhost:3000","http://localhost:3001"]'

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS from env as JSON array or comma-separated string."""
        v = self.CORS_ORIGINS.strip()
        if not v:
            return ["http://localhost:3000"]
        if v.startswith("["):
            return json.loads(v)
        return [origin.strip() for origin in v.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def active_claude_model(self) -> str:
        return self.CLAUDE_MODEL_PROD if self.is_production else self.CLAUDE_MODEL


settings = Settings()
