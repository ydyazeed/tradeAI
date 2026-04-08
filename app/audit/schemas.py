import uuid
from datetime import datetime

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    user_id: str | None
    action: str
    endpoint: str
    method: str
    ip_address: str
    status_code: int
    response_time_ms: int
    created_at: datetime

    model_config = {"from_attributes": True}
