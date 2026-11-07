"""AI Controller: coordinates AI features with AI service and quota limits."""

from src.services.ai_service import get_ai_quota, generate_json, AIServiceError
from src.validators.ai_schemas import (
    BreakdownRequest,
    BreakdownResponse,
    PriorityConfirmRequest,
    PriorityConfirmResponse,
    QuotaStatusResponse,
)

async def handle_get_quota_status() -> QuotaStatusResponse:
    quota = get_ai_quota()
    return QuotaStatusResponse(
        limit=quota["limit"],
        used=quota["used"],
        remaining=quota["remaining"],
        resets_in_seconds=quota["resets_in_seconds"],
        window_seconds=quota["window_seconds"],
        is_exceeded=quota["is_exceeded"],
    )
