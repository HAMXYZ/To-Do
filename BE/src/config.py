# Backward compatibility facade for src.config
from src.config.settings import (
    SECRET_KEY,
    JWT_ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    CORS_ORIGINS,
    APP_TIMEZONE,
    APP_TZ,
    today,
)

__all__ = [
    "SECRET_KEY",
    "JWT_ALGORITHM",
    "ACCESS_TOKEN_EXPIRE_MINUTES",
    "CORS_ORIGINS",
    "APP_TIMEZONE",
    "APP_TZ",
    "today",
]
