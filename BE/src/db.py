from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
import os
from dotenv import load_dotenv
from src.models import Base

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL") or "postgresql+asyncpg://todo_user:todo_pass@localhost:5432/todo_db"

# Async engine and session factory
engine: AsyncEngine = create_async_engine(DATABASE_URL, echo=True, future=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def init_db() -> None:
    """Create database tables (useful for quick dev setups). Alembic should be used for migrations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Dependency for FastAPI endpoints
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
