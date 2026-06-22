"""AI Coach router — proxies chat to Groq so the API key stays server-side."""

import os
import re
import json
from pathlib import Path
from datetime import date
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import httpx
from sqlalchemy.orm import Session as DBSession
from dotenv import load_dotenv

from models import get_db
from models.models import ChatMessage, ExercisePlan, User
from routers.auth import get_current_user

load_dotenv(Path(__file__).parent.parent / ".env")

router = APIRouter(prefix="/ai-coach", tags=["ai-coach"])

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are Vibra, a compassionate and knowledgeable AI speech therapy coach built into the Dysera platform, specialising in dysarthria.
Your role is to:
- Introduce yourself as Vibra when greeting the user for the first time
- Explain the patient's assessment results clearly and reassuringly
- Suggest practical, evidence-based speech exercises tailored to their severity level
- Answer questions about dysarthria, therapy progress, and exercises
- Keep responses concise, warm, and encouraging — never medical-diagnosis language
- Always remind users that you are an AI assistant and serious concerns should be discussed with a qualified therapist

Severity levels used by this platform:
- Healthy: No dysarthria detected. Encourage maintenance exercises.
- Moderate: Noticeable speech difficulties. Focus on articulation, breath control, and rate.
- Severe: Significant impairment. Focus on foundational breath support, vowel clarity, and short phrase practice.

Never suggest the user stop therapy or that exercises are unnecessary. Keep responses under 200 words unless the user asks for detail.

When the user explicitly asks to add a specific exercise to their training plan (for example: "add a breathing exercise to my plan", "add this to my training", "create a tongue twister exercise and add it to my plan"), respond helpfully AND append this exact marker at the very end of your message:
[[ADD_EXERCISE:{"title":"Exercise Name","category":"Articulation","duration":"3 min","instruction":"Step-by-step instruction here."}]]
Use one of these categories: Warm-Up, Articulation, Phonation, Respiration, Connected Speech, Cool-Down.
Do NOT include the marker if the user is only asking about or discussing exercises without explicitly requesting to add one."""

EXERCISES_SYSTEM_PROMPT = """You are an expert speech-language pathologist AI creating personalised therapy exercise plans for dysarthria patients.
Generate a set of 6 speech therapy exercises tailored to the patient's severity level.

Rules:
- Return ONLY a valid JSON array. No markdown, no explanation, no commentary — just the raw JSON array.
- Each exercise must have these exact keys:
  "title": short name (string)
  "category": one of "Warm-Up", "Articulation", "Phonation", "Respiration", "Connected Speech", "Cool-Down"
  "duration": e.g. "3 min" (string)
  "instruction": 2-3 sentence practical instruction (string)
  "tips": array of 2-3 short tip strings
  "prompt": null OR a short string the patient should say aloud (only for speech/voice exercises)
  "requires_recording": true if the patient must speak (prompt is not null), false otherwise

- For Healthy severity: balance articulation, rate control, and maintenance exercises; include 3-4 recording exercises.
- For Moderate severity: focus on articulation drills, breath support, and connected speech; include 3-4 recording exercises.
- For Severe severity: focus on breath support, vowel clarity, and single words/short phrases; include 2-3 recording exercises.
- Always start with a Warm-Up and end with a Cool-Down. Recording exercises must have a non-null prompt.
"""


class ChatRequest(BaseModel):
    message: str
    severity: str = "Unknown"
    score: float = 50.0
    history: List[dict] = []


class ChatResponse(BaseModel):
    reply: str
    added_exercise: Optional[dict] = None


class HistoryMessage(BaseModel):
    role: str
    content: str
    created_at: str


class ExercisePlanRequest(BaseModel):
    severity: str = "Moderate"
    score: float = 50.0


class GeneratedExercise(BaseModel):
    title: str
    category: str
    duration: str
    instruction: str
    tips: List[str]
    prompt: Optional[str] = None
    requires_recording: bool = False


class ExercisePlanResponse(BaseModel):
    exercises: List[GeneratedExercise]


@router.get("/chat/history", response_model=List[HistoryMessage])
async def get_chat_history(
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.patient_id == current_user.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(100)
        .all()
    )
    return [
        HistoryMessage(role=m.role, content=m.content, created_at=m.created_at.isoformat())
        for m in messages
    ]


@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI Coach is not configured (missing API key).")

    # Build message list: system prompt + conversation history + current message
    groq_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for h in req.history[-20:]:
        role = h.get("role", "")
        content = h.get("content", "")
        if role in ("user", "assistant") and content:
            groq_messages.append({"role": role, "content": content})

    user_context = (
        f"[Patient context — Current severity: {req.severity}, "
        f"Intelligibility score: {req.score:.0f}/100]\n\n"
        f"{req.message}"
    )
    groq_messages.append({"role": "user", "content": user_context})

    payload = {
        "model": GROQ_MODEL,
        "messages": groq_messages,
        "max_tokens": 512,
        "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            GROQ_API_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Groq API error: {resp.text}")

    raw_reply = resp.json()["choices"][0]["message"]["content"].strip()

    # Parse and strip [[ADD_EXERCISE:{...}]] marker if present
    added_exercise = None
    visible_reply = raw_reply
    match = re.search(r'\[\[ADD_EXERCISE:(\{.*?\})\]\]', raw_reply, re.DOTALL)
    if match:
        try:
            ex_data = json.loads(match.group(1))
            visible_reply = raw_reply[:match.start()].strip()
            added_exercise = {
                "title": ex_data.get("title", "Custom Exercise"),
                "category": ex_data.get("category", "Articulation"),
                "duration": ex_data.get("duration", "3 min"),
                "instruction": ex_data.get("instruction", ""),
                "tips": [],
                "requires_recording": False,
                "is_extra": True,
            }
            # Append to today's exercise plan if one exists
            today = date.today()
            plan = db.query(ExercisePlan).filter(
                ExercisePlan.patient_id == current_user.id,
                ExercisePlan.plan_date == today,
            ).first()
            if plan:
                exercises = json.loads(plan.exercises_json)
                exercises.append(added_exercise)
                plan.exercises_json = json.dumps(exercises)
                db.commit()
        except Exception:
            added_exercise = None
            visible_reply = raw_reply

    # Persist messages to DB
    db.add(ChatMessage(patient_id=current_user.id, role="user",      content=req.message))
    db.add(ChatMessage(patient_id=current_user.id, role="assistant", content=visible_reply))
    db.commit()

    return ChatResponse(reply=visible_reply, added_exercise=added_exercise)


@router.post("/exercises", response_model=ExercisePlanResponse)
async def generate_exercises(req: ExercisePlanRequest):
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI Coach is not configured (missing API key).")

    user_prompt = (
        f"Patient severity: {req.severity}. Intelligibility score: {req.score:.0f}/100.\n"
        "Generate a personalised exercise plan as a JSON array."
    )

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": EXERCISES_SYSTEM_PROMPT},
            {"role": "user",   "content": user_prompt},
        ],
        "max_tokens": 2048,
        "temperature": 0.6,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            GROQ_API_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Groq API error: {resp.text}")

    raw_content = resp.json()["choices"][0]["message"]["content"].strip()

    # Extract JSON array robustly — strip any markdown fencing
    start = raw_content.find("[")
    end   = raw_content.rfind("]")
    if start == -1 or end == -1:
        raise HTTPException(status_code=502, detail="AI returned invalid exercise plan format.")

    try:
        exercises_data = json.loads(raw_content[start:end + 1])
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to parse AI exercise plan: {exc}")

    exercises = []
    for ex in exercises_data:
        exercises.append(GeneratedExercise(
            title=ex.get("title", "Exercise"),
            category=ex.get("category", "Articulation"),
            duration=ex.get("duration", "3 min"),
            instruction=ex.get("instruction", ""),
            tips=ex.get("tips", []),
            prompt=ex.get("prompt") or None,
            requires_recording=bool(ex.get("requires_recording", False)),
        ))

    return ExercisePlanResponse(exercises=exercises)
