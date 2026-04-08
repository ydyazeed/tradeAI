from fastapi import Request
from fastapi.responses import JSONResponse


class TradeAIError(Exception):
    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"

    def __init__(self, message: str, details: dict | None = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)


class AuthenticationError(TradeAIError):
    status_code = 401
    error_code = "AUTHENTICATION_ERROR"


class InvalidCredentialsError(AuthenticationError):
    error_code = "INVALID_CREDENTIALS"


class TokenExpiredError(AuthenticationError):
    error_code = "TOKEN_EXPIRED"


class InvalidAPIKeyError(AuthenticationError):
    error_code = "INVALID_API_KEY"


class AuthorizationError(TradeAIError):
    status_code = 403
    error_code = "AUTHORIZATION_ERROR"


class InsufficientScopeError(AuthorizationError):
    error_code = "INSUFFICIENT_SCOPE"


class NotFoundError(TradeAIError):
    status_code = 404
    error_code = "NOT_FOUND"


class SymbolNotFoundError(NotFoundError):
    error_code = "SYMBOL_NOT_FOUND"


class SignalNotFoundError(NotFoundError):
    error_code = "SIGNAL_NOT_FOUND"


class ValidationError(TradeAIError):
    status_code = 422
    error_code = "VALIDATION_ERROR"


class InvalidSymbolError(ValidationError):
    error_code = "INVALID_SYMBOL"


class RateLimitError(TradeAIError):
    status_code = 429
    error_code = "RATE_LIMIT_EXCEEDED"


class ExternalServiceError(TradeAIError):
    status_code = 502
    error_code = "EXTERNAL_SERVICE_ERROR"


class DataFetchError(ExternalServiceError):
    error_code = "DATA_FETCH_ERROR"


class SignalGenerationError(ExternalServiceError):
    error_code = "SIGNAL_GENERATION_ERROR"


class BudgetExceededError(TradeAIError):
    status_code = 429
    error_code = "BUDGET_EXCEEDED"


class SystemError(TradeAIError):
    status_code = 500
    error_code = "SYSTEM_ERROR"


def _error_response(request: Request, exc: TradeAIError) -> JSONResponse:
    import uuid
    from datetime import datetime, timezone

    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details,
            },
            "meta": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "request_id": request_id,
            },
        },
    )


def register_exception_handlers(app) -> None:
    @app.exception_handler(TradeAIError)
    async def tradeai_error_handler(request: Request, exc: TradeAIError):
        return _error_response(request, exc)
