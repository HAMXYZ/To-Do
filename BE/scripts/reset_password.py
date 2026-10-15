"""Đặt lại mật khẩu thủ công.
Chạy từ thư mục BE:  python -m scripts.reset_password email@example.com
"""
import asyncio
import getpass
import sys

from sqlalchemy import select

from src import limits
from src.db import AsyncSessionLocal, engine
from src.models import User
from src.security import hash_password


async def main(email: str) -> None:
    password = getpass.getpass("Mật khẩu mới: ")
    if len(password) < limits.PASSWORD_MIN or len(password.encode()) > limits.PASSWORD_MAX_BYTES:
        sys.exit(f"Mật khẩu phải từ {limits.PASSWORD_MIN} ký tự và tối đa {limits.PASSWORD_MAX_BYTES} byte.")
    if password != getpass.getpass("Nhập lại: "):
        sys.exit("Hai lần nhập không khớp.")
    async with AsyncSessionLocal() as session:
        user = await session.scalar(select(User).where(User.email == email.strip().lower()))
        if user is None:
            sys.exit("Không tìm thấy email này.")
        user.hashed_password = hash_password(password)
        await session.commit()
    await engine.dispose()
    print("Đã đặt lại mật khẩu.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Cách dùng: python -m scripts.reset_password email@example.com")
    asyncio.run(main(sys.argv[1]))
