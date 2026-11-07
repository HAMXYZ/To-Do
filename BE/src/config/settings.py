import os
from datetime import date, datetime
from zoneinfo import ZoneInfo
from dotenv import load_dotenv

load_dotenv()


def _require(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Thiếu biến môi trường {name}. Hãy đặt nó trong file .env (xem .env.example)."
        )
    return value


SECRET_KEY: str = _require("SECRET_KEY")
if len(SECRET_KEY) < 32:
    raise RuntimeError("SECRET_KEY quá ngắn (cần ít nhất 32 ký tự).")

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))
CORS_ORIGINS: list[str] = [
    o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()
]
APP_TIMEZONE: str = os.getenv("APP_TIMEZONE", "Asia/Ho_Chi_Minh")
APP_TZ = ZoneInfo(APP_TIMEZONE)


def today() -> date:
    """Ngày hôm nay theo APP_TIMEZONE. Mọi phép tính 'hôm nay' phải dùng hàm này."""
    return datetime.now(APP_TZ).date()
