"""
Sessions router.
GET  /api/sessions          — current patient's sessions (paginated)
GET  /api/sessions/{id}     — single session
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession
from typing import List
import datetime

from models import get_db
from models.models import Session as SessionModel, User
from routers.auth import get_current_user

router = APIRouter(prefix="/sessions", tags=["sessions"])


class SessionOut(BaseModel):
    id:             int
    severity:       str
    score:          float
    confidence:     float
    audio_duration: float | None
    created_at:     datetime.datetime

    class Config:
        from_attributes = True


@router.get("", response_model=List[SessionOut])
def list_sessions(
    skip:         int      = Query(0, ge=0),
    limit:        int      = Query(20, ge=1, le=100),
    db:           DBSession = Depends(get_db),
    current_user: User      = Depends(get_current_user),
):
    q = db.query(SessionModel).filter(SessionModel.patient_id == current_user.id)
    return q.order_by(SessionModel.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{session_id}", response_model=SessionOut)
def get_session(
    session_id:   int,
    db:           DBSession = Depends(get_db),
    current_user: User      = Depends(get_current_user),
):
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.patient_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")
    return session
