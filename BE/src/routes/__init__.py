from .ai import router as ai_router
from .analytics import router as analytics_router
from .auth import router as auth_router
from .categories import router as categories_router
from .habits import router as habits_router
from .me import router as me_router
from .reminders import router as reminders_router
from .tasks import router as tasks_router
from .weeks import router as weeks_router

__all__ = [
    "ai_router",
    "analytics_router",
    "auth_router",
    "categories_router",
    "habits_router",
    "me_router",
    "reminders_router",
    "tasks_router",
    "weeks_router",
]
