# Backward compatibility facade for src.db
from src.config.database import (
    DATABASE_URL,
    SQL_ECHO,
    engine,
    AsyncSessionLocal,
    get_session,
)

__all__ = [
    "DATABASE_URL",
    "SQL_ECHO",
    "engine",
    "AsyncSessionLocal",
    "get_session",
]
