"""Task Controller: business logic for task CRUD operations."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.models import Task, User

async def list_user_tasks(db: AsyncSession, user_id: int):
    result = await db.execute(select(Task).where(Task.user_id == user_id))
    return result.scalars().all()
