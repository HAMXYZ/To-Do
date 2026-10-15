from datetime import date

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import HabitLog


async def upsert_log(
    session: AsyncSession, habit_id: int, day: date, is_completed: bool
) -> None:
    """Ghi hoặc cập nhật log hoàn thành của habit cho một ngày (an toàn khi gọi đồng thời)."""
    stmt = insert(HabitLog).values(habit_id=habit_id, date=day, is_completed=is_completed)
    stmt = stmt.on_conflict_do_update(
        index_elements=["habit_id", "date"],
        set_={"is_completed": stmt.excluded.is_completed},
    )
    await session.execute(stmt)
