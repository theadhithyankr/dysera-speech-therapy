"""
Audio analysis router.
POST /api/analyze   — upload a wav file, get severity + scores back
"""

import io
import time
import tempfile
import os

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession
import librosa

from models import get_db, Session as SessionModel
from routers.auth import get_current_user
from models.models import User
from services.feature_extractor import extract_features_from_bytes
from services.classifier import predict

router = APIRouter(prefix="/analyze", tags=["analyze"])

ALLOWED_CONTENT_TYPES = {"audio/wav", "audio/wave", "audio/x-wav", "audio/mpeg",
                          "audio/mp4", "audio/ogg", "application/octet-stream"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class AnalysisResponse(BaseModel):
    session_id:       int
    severity:         str
    score:            float
    confidence:       float
    probabilities:    dict
    acoustic_features: dict
    audio_duration_s:  float


@router.post("", response_model=AnalysisResponse)
async def analyze_audio(
    file:         UploadFile = File(...),
    db:           DBSession  = Depends(get_db),
    current_user: User       = Depends(get_current_user),
):
    # ── Validate input ───────────────────────────────────────────────────────
    if current_user.role != "patient":
        raise HTTPException(403, "Only patients can submit audio for analysis")

    raw = await file.read()
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large (max 10 MB)")

    # ── Feature extraction ───────────────────────────────────────────────────
    try:
        features = extract_features_from_bytes(raw)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(500, f"Feature extraction failed: {e}")

    # ── Inference ─────────────────────────────────────────────────────────────
    try:
        result = predict(features)
    except FileNotFoundError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, f"Inference failed: {e}")

    # ── Audio duration (for display) ──────────────────────────────────────────
    try:
        y, sr = librosa.load(io.BytesIO(raw), sr=16000, mono=True)
        duration = float(len(y) / sr)
    except Exception:
        duration = 0.0

    # ── Persist session ───────────────────────────────────────────────────────
    af = result.acoustic_features
    session = SessionModel(
        patient_id     = current_user.id,
        severity       = result.severity,
        score          = result.score,
        confidence     = result.confidence,
        f0_mean        = af.get("f0_mean"),
        f0_std         = af.get("f0_std"),
        unvoiced_ratio = af.get("unvoiced_ratio"),
        spec_centroid  = af.get("spectral_centroid"),
        spec_rolloff   = af.get("spectral_rolloff"),
        zcr            = af.get("zero_crossing_rate"),
        pause_ratio    = af.get("pause_ratio"),
        audio_duration = duration,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return AnalysisResponse(
        session_id        = session.id,
        severity          = result.severity,
        score             = result.score,
        confidence        = result.confidence,
        probabilities     = result.probabilities,
        acoustic_features = result.acoustic_features,
        audio_duration_s  = duration,
    )
