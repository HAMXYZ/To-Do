from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src import config
from src.routers import ai, analytics, auth, categories, habits, me, reminders, tasks, weeks
from src.seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Tự động tạo bảng (khi chạy SQLite/standalone) và nạp dữ liệu mẫu."""
    try:
        from src.db import engine
        from src.models import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        print(f"[FocusFlow AI] Thông tin khởi tạo bảng: {e}")

    try:
        await seed_database()
    except Exception as exc:
        print(f"[FocusFlow AI] Cảnh báo nạp seed data khi khởi động: {exc}")
    yield


app = FastAPI(title="FocusFlow AI API", lifespan=lifespan)

# Token gửi qua header Authorization, không dùng cookie nên không bật allow_credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(categories.router)
app.include_router(habits.router)
app.include_router(analytics.router)
app.include_router(weeks.router)
app.include_router(me.router)
app.include_router(reminders.router)
app.include_router(ai.router)


@app.get("/", tags=["meta"])
async def root():
    return {
        "name": "FocusFlow AI API",
        "status": "online",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok"}


@app.get("/today", tags=["meta"])
async def get_today():
    """Ngày hôm nay theo APP_TIMEZONE, để FE không phải đoán múi giờ."""
    d = config.today()
    iso = d.isocalendar()
    return {"date": d.isoformat(), "iso_year": iso.year, "iso_week": iso.week}
