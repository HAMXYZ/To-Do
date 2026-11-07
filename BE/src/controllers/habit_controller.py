"""Habit Controller: business logic for habits and logs."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.models import Habit, HabitLog

async def list_user_habits(db: AsyncSession, user_id: int):
    result = await db.execute(select(Habit).where(Habit.user_id == user_id, Habit.active == True))
    return result.scalars().all()
