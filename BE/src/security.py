from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt

from src import config

# Hash giả để so sánh khi email không tồn tại, giúp thời gian phản hồi không lộ email có tồn tại hay không
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt()).decode()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: Optional[str]) -> bool:
    raw = password.encode("utf-8")
    target = (hashed or _DUMMY_HASH).encode()
    if len(raw) > 72:
        return False
    try:
        ok = bcrypt.checkpw(raw, target)
    except ValueError:
        return False
    return ok and hashed is not None


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, config.SECRET_KEY, algorithm=config.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[int]:
    """Trả về user_id, hoặc None nếu token sai hoặc hết hạn."""
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.JWT_ALGORITHM])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
