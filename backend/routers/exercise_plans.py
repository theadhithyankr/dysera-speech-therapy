"""
Exercise Plans router.

GET  /api/exercise-plans/today          — get (or create) today's AI plan
POST /api/exercise-plans/today/complete — mark today's plan as done
GET  /api/exercise-plans/streak         — current consecutive-day streak
POST /api/exercise-plans/extra          — generate 3 bonus exercises (not saved)
"""

import os
import json
from pathlib import Path
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession
import httpx
from dotenv import load_dotenv

from models import get_db
from models.models import ExercisePlan, User
from models.models import Session as SessionModel
from routers.auth import get_current_user
from routers.ai_coach import GROQ_API_URL, GROQ_MODEL, EXERCISES_SYSTEM_PROMPT

load_dotenv(Path(__file__).parent.parent / ".env")

router = APIRouter(prefix="/exercise-plans", tags=["exercise-plans"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ExerciseItem(BaseModel):
    title: str
    category: str
    duration: str
    instruction: str
    tips: List[str]
    prompt: Optional[str] = None
    requires_recording: bool = False
    is_extra: bool = False


class TodayPlanResponse(BaseModel):
    plan_date: str
    exercises: List[ExerciseItem]
    completed: bool
    completed_at: Optional[str] = None
    streak: int


class CompleteResponse(BaseModel):
    message: str
    streak: int


class StreakResponse(BaseModel):
    streak: int
    last_completed: Optional[str] = None


class ExtraExercisesResponse(BaseModel):
    exercises: List[ExerciseItem]


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _call_groq(system_prompt: str, user_prompt: str, max_tokens: int = 2048) -> List[dict]:
    """Call Groq and parse a JSON array from the response."""
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise HTTPException(503, "AI Coach not configured (missing GROQ_API_KEY).")

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.6,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            GROQ_API_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )

    if resp.status_code != 200:
        raise HTTPException(502, f"Groq API error: {resp.text}")

    raw = resp.json()["choices"][0]["message"]["content"].strip()
    start, end = raw.find("["), raw.rfind("]")
    if start == -1 or end == -1:
        raise HTTPException(502, "AI returned invalid exercise format.")

    try:
        return json.loads(raw[start:end + 1])
    except json.JSONDecodeError as exc:
        raise HTTPException(502, f"Failed to parse AI response: {exc}")


def _calculate_streak(db: DBSession, patient_id: int) -> int:
    """Return the current consecutive-day completion streak."""
    rows = (
        db.query(ExercisePlan.plan_date)
        .filter(ExercisePlan.patient_id == patient_id, ExercisePlan.completed == True)
        .all()
    )
    if not rows:
        return 0

    completed_dates = sorted({r.plan_date for r in rows}, reverse=True)
    today = date.today()

    # Streak breaks if neither today nor yesterday was completed
    if completed_dates[0] < today - timedelta(days=1):
        return 0

    streak = 0
    expected = completed_dates[0]
    for d in completed_dates:
        if d == expected:
            streak += 1
            expected = expected - timedelta(days=1)
        else:
            break
    return streak


def _latest_session(db: DBSession, patient_id: int):
    return (
        db.query(SessionModel)
        .filter(SessionModel.patient_id == patient_id)
        .order_by(SessionModel.created_at.desc())
        .first()
    )


def _parse_exercises(raw_list: List[dict]) -> List[ExerciseItem]:
    items = []
    for ex in raw_list:
        items.append(ExerciseItem(
            title=ex.get("title", "Exercise"),
            category=ex.get("category", "Articulation"),
            duration=ex.get("duration", "3 min"),
            instruction=ex.get("instruction", ""),
            tips=ex.get("tips", []),
            prompt=ex.get("prompt") or None,
            requires_recording=bool(ex.get("requires_recording", False)),
        ))
    return items


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/today", response_model=TodayPlanResponse)
async def get_or_create_today(
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    plan = (
        db.query(ExercisePlan)
        .filter(ExercisePlan.patient_id == current_user.id, ExercisePlan.plan_date == today)
        .first()
    )

    if not plan:
        # Generate a fresh AI plan for today
        sess = _latest_session(db, current_user.id)
        sev = sess.severity if sess else "Moderate"
        sc  = sess.score    if sess else 50.0

        user_prompt = (
            f"Patient severity: {sev}. Intelligibility score: {sc:.0f}/100.\n"
            "Generate a personalised exercise plan as a JSON array."
        )
        exercises_data = await _call_groq(EXERCISES_SYSTEM_PROMPT, user_prompt)

        plan = ExercisePlan(
            patient_id=current_user.id,
            plan_date=today,
            exercises_json=json.dumps(exercises_data),
            completed=False,
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)

    exercises_raw = json.loads(plan.exercises_json)
    streak = _calculate_streak(db, current_user.id)

    return TodayPlanResponse(
        plan_date=str(plan.plan_date),
        exercises=_parse_exercises(exercises_raw),
        completed=plan.completed,
        completed_at=plan.completed_at.isoformat() if plan.completed_at else None,
        streak=streak,
    )


@router.post("/today/complete", response_model=CompleteResponse)
def complete_today(
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    plan = (
        db.query(ExercisePlan)
        .filter(ExercisePlan.patient_id == current_user.id, ExercisePlan.plan_date == today)
        .first()
    )
    if not plan:
        raise HTTPException(404, "No plan found for today. Visit the exercises page first.")

    if not plan.completed:
        plan.completed    = True
        plan.completed_at = datetime.utcnow()
        db.commit()

    streak = _calculate_streak(db, current_user.id)
    return CompleteResponse(message="Session completed!", streak=streak)


@router.get("/streak", response_model=StreakResponse)
def get_streak(
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    streak = _calculate_streak(db, current_user.id)
    last = (
        db.query(ExercisePlan)
        .filter(ExercisePlan.patient_id == current_user.id, ExercisePlan.completed == True)
        .order_by(ExercisePlan.plan_date.desc())
        .first()
    )
    return StreakResponse(
        streak=streak,
        last_completed=str(last.plan_date) if last else None,
    )


@router.post("/extra", response_model=ExtraExercisesResponse)
async def get_extra_exercises(
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate 3 bonus exercises based on patient's severity — not saved to DB."""
    sess = _latest_session(db, current_user.id)
    sev = sess.severity if sess else "Moderate"
    sc  = sess.score    if sess else 50.0

    extra_system = (
        EXERCISES_SYSTEM_PROMPT
        + "\nGenerate exactly 3 bonus exercises only — no Warm-Up or Cool-Down. "
        "Vary the categories from the standard plan. Return a JSON array of 3 items."
    )
    user_prompt = (
        f"Patient severity: {sev}. Score: {sc:.0f}/100.\n"
        "Generate 3 bonus exercises as a JSON array."
    )
    exercises_data = await _call_groq(extra_system, user_prompt, max_tokens=1024)
    items = _parse_exercises(exercises_data[:3])
    for item in items:
        item.is_extra = True
    return ExtraExercisesResponse(exercises=items)
