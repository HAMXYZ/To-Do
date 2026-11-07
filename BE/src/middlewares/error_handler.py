"""Global error handlers for FastAPI."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from src.services.ai_service import AIServiceError

def setup_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AIServiceError)
    async def ai_service_error_handler(request: Request, exc: AIServiceError):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "code": exc.code,
                "message": exc.message,
                "retry_after": exc.retry_after,
                "details": exc.details,
            },
        )
