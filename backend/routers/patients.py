"""
Patients router (therapist-facing).
GET  /api/patients                — list assigned patients
GET  /api/patients/{id}/sessions  — all sessions for a patient
PUT  /api/patients/{id}/notes     — update therapist notes
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession
from typing import List
import datetime

from models import get_db
from models.models import User, Session as SessionModel, TherapistPatient
from routers.auth import get_current_user

router = APIRouter(prefix="/patients", tags=["patients"])


class PatientOut(BaseModel):
    id:        int
    full_name: str
    email:     str
    notes:     str | None

    class Config:
        from_attributes = True


class SessionOut(BaseModel):
    id:         int
    severity:   str
    score:      float
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class NotesUpdate(BaseModel):
    notes: str


def _require_therapist(current_user: User):
    if current_user.role != "therapist":
        raise HTTPException(403, "Therapist access only")


@router.get("", response_model=List[PatientOut])
def list_patients(
    db:           DBSession = Depends(get_db),
    current_user: User      = Depends(get_current_user),
):
    _require_therapist(current_user)
    rows = db.query(TherapistPatient).filter(
        TherapistPatient.therapist_id == current_user.id
    ).all()
    result = []
    for row in rows:
        patient = db.query(User).filter(User.id == row.patient_id).first()
        if patient:
            result.append(PatientOut(
                id=patient.id,
                full_name=patient.full_name,
                email=patient.email,
                notes=row.notes,
            ))
    return result


@router.get("/{patient_id}/sessions", response_model=List[SessionOut])
def patient_sessions(
    patient_id:   int,
    skip:         int      = Query(0, ge=0),
    limit:        int      = Query(50, ge=1, le=200),
    db:           DBSession = Depends(get_db),
    current_user: User      = Depends(get_current_user),
):
    _require_therapist(current_user)
    assigned = db.query(TherapistPatient).filter(
        TherapistPatient.therapist_id == current_user.id,
        TherapistPatient.patient_id   == patient_id,
    ).first()
    if not assigned:
        raise HTTPException(404, "Patient not assigned to you")

    return (
        db.query(SessionModel)
        .filter(SessionModel.patient_id == patient_id)
        .order_by(SessionModel.created_at.desc())
        .offset(skip).limit(limit)
        .all()
    )


@router.put("/{patient_id}/notes")
def update_notes(
    patient_id:   int,
    body:         NotesUpdate,
    db:           DBSession = Depends(get_db),
    current_user: User      = Depends(get_current_user),
):
    _require_therapist(current_user)
    row = db.query(TherapistPatient).filter(
        TherapistPatient.therapist_id == current_user.id,
        TherapistPatient.patient_id   == patient_id,
    ).first()
    if not row:
        raise HTTPException(404, "Patient not assigned to you")
    row.notes = body.notes
    db.commit()
    return {"status": "ok"}
