"""
Dysera — AI-powered dysarthria assessment & therapy platform (FastAPI backend)
Run: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models.database import engine, Base
from routers import auth, audio, sessions, ai_coach, exercise_plans, tts

# Create all tables on startup (fine for SQLite dev; use Alembic for prod)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Dysarthria Therapy API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Allow requests from all origins (including mobile/network devices)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
API_PREFIX = "/api"
app.include_router(auth.router,           prefix=API_PREFIX)
app.include_router(audio.router,          prefix=API_PREFIX)
app.include_router(sessions.router,       prefix=API_PREFIX)
app.include_router(ai_coach.router,       prefix=API_PREFIX)
app.include_router(exercise_plans.router, prefix=API_PREFIX)
app.include_router(tts.router,            prefix=API_PREFIX)


@app.get("/health")
def health():
    return {"status": "ok"}
