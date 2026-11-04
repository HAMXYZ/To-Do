from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.db import get_session
from src.deps import get_current_user
from src.models import Category, User
from src.category_schemas import CategoryCreate, CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
async def list_categories(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    categories = await session.scalars(
        select(Category)
        .where(Category.user_id == user.id)
        .order_by(Category.normalized_name, Category.id)
    )
    return [{"id": category.id, "name": category.name} for category in categories.all()]


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    normalized_name = body.name.lower()
    existing = await session.scalar(
        select(Category).where(
            Category.user_id == user.id,
            Category.normalized_name == normalized_name,
        )
    )
    if existing is not None:
        return {"id": existing.id, "name": existing.name}

    category = Category(
        user_id=user.id,
        name=body.name,
        normalized_name=normalized_name,
    )
    session.add(category)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing = await session.scalar(
            select(Category).where(
                Category.user_id == user.id,
                Category.normalized_name == normalized_name,
            )
        )
        if existing is None:
            raise
        return {"id": existing.id, "name": existing.name}
    await session.refresh(category)
    return {"id": category.id, "name": category.name}
