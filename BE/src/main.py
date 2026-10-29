from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src import config
from src.routers import ai, analytics, auth, habits, me, reminders, tasks, weeks

app = FastAPI(title="FocusFlow AI API")

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
app.include_router(habits.router)
app.include_router(analytics.router)
app.include_router(weeks.router)
app.include_router(me.router)
app.include_router(reminders.router)
app.include_router(ai.router)


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok"}


@app.get("/today", tags=["meta"])
async def get_today():
    """Ngày hôm nay theo APP_TIMEZONE, để FE không phải đoán múi giờ."""
    d = config.today()
    iso = d.isocalendar()
    return {"date": d.isoformat(), "iso_year": iso.year, "iso_week": iso.week}