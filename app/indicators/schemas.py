import uuid
from datetime import datetime

from pydantic import BaseModel


class IndicatorValueResponse(BaseModel):
    id: uuid.UUID
    symbol: str
    timestamp: datetime
    indicator_name: str
    value: float | None
    parameters: dict

    model_config = {"from_attributes": True}


SUPPORTED_INDICATORS = ["RSI", "MACD", "MACD_SIGNAL", "MACD_HIST", "EMA_20", "EMA_50", "BB_UPPER", "BB_MIDDLE", "BB_LOWER"]
