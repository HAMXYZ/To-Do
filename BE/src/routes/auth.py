import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src import limits
from src.db import get_session
from src.deps import get_current_user
from src.models import User
from src.schemas import LoginIn, RegisterIn, TokenOut, UserOut
from src.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# Giới hạn đăng nhập sai, lưu trong bộ nhớ (đủ cho 1 tiến trình; đổi sang Redis nếu chạy nhiều worker)
_fails: dict[tuple[str, str], list[float]] = defaultdict(list)


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _recent_fails(key: tuple[str, str]) -> list[float]:
    cutoff = time.monotonic() - limits.LOGIN_WINDOW_SECONDS
    _fails[key] = [t for t in _fails[key] if t > cutoff]
    return _fails[key]


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterIn, session: AsyncSession = Depends(get_session)):
    exists = await session.scalar(select(User.id).where(User.email == data.email))
    if exists is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email đã được đăng ký")
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:  # hai request đăng ký cùng lúc
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email đã được đăng ký")
    await session.refresh(user)
    return user


@router.post("/login", response_model=TokenOut)
async def login(
    data: LoginIn, request: Request, session: AsyncSession = Depends(get_session)
):
    key = (_client_ip(request), data.email)
    if len(_recent_fails(key)) >= limits.LOGIN_MAX_FAILS:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Đăng nhập sai quá nhiều lần, vui lòng thử lại sau ít phút",
        )
    user = await session.scalar(select(User).where(User.email == data.email))
    ok = verify_password(data.password, user.hashed_password if user else None)
    if not ok or user is None:
        _fails[key].append(time.monotonic())
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Email hoặc mật khẩu không đúng"
        )
    _fails.pop(key, None)
    return TokenOut(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user
