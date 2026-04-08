import uuid
from datetime import datetime

from pydantic import BaseModel


class RiskParams(BaseModel):
    stop_loss_pct: float = 0.0
    take_profit_pct: float = 0.0
    risk_reward_ratio: float = 0.0


class SignalResponse(BaseModel):
    id: uuid.UUID
    symbol: str
    timestamp: datetime
    direction: str
    confidence: float
    reasoning: str
    risk_params: dict
    model_used: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SignalAuditResponse(BaseModel):
    id: uuid.UUID
    signal_id: uuid.UUID
    prompt_text: str
    response_text: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
    cost_usd: float
    created_at: datetime

    model_config = {"from_attributes": True}
