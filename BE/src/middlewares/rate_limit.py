"""Rate limiting and AI Quota checking middleware / dependencies."""

from fastapi import HTTPException, status
from src.services.ai_service import get_ai_quota

def check_ai_rate_limit():
    quota = get_ai_quota()
    if quota["is_exceeded"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "AI_QUOTA_EXCEEDED",
                "message": f"Vượt quá giới hạn {quota['limit']} lượt AI trong {quota['window_seconds'] // 60} phút.",
                "retry_after": quota["resets_in_seconds"],
            },
        )
