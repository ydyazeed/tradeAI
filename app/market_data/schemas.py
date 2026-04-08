import math
from datetime import datetime

from pydantic import BaseModel, field_validator


class OHLCVPoint(BaseModel):
    symbol: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int

    model_config = {"from_attributes": True}

    @field_validator("open", "high", "low", "close", mode="before")
    @classmethod
    def coerce_nan(cls, v: float) -> float:
        if isinstance(v, float) and math.isnan(v):
            return 0.0
        return v


class SymbolResponse(BaseModel):
    symbol: str
    name: str
    asset_class: str
    exchange: str
    is_active: bool

    model_config = {"from_attributes": True}


class AddSymbolRequest(BaseModel):
    symbol: str
    name: str
    asset_class: str = "stock"
    exchange: str = ""
