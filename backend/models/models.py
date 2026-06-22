"""SQLAlchemy ORM models."""

import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Date,
    ForeignKey, Text, Boolean, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String(255), unique=True, index=True, nullable=False)
    hashed_pw     = Column(String(255), nullable=False)
    full_name     = Column(String(255), nullable=False)
    role          = Column(String(20),  nullable=False, default="patient")  # patient | therapist
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, default=datetime.datetime.utcnow)

    sessions      = relationship("Session", back_populates="patient",
                                  foreign_keys="Session.patient_id")
    therapist_for = relationship("TherapistPatient", back_populates="therapist",
                                  foreign_keys="TherapistPatient.therapist_id")


class Session(Base):
    __tablename__ = "sessions"

    id             = Column(Integer, primary_key=True, index=True)
    patient_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    severity       = Column(String(20),  nullable=False)
    score          = Column(Float,       nullable=False)
    confidence     = Column(Float,       nullable=False)
    f0_mean        = Column(Float)
    f0_std         = Column(Float)
    unvoiced_ratio = Column(Float)
    spec_centroid  = Column(Float)
    spec_rolloff   = Column(Float)
    zcr            = Column(Float)
    pause_ratio    = Column(Float)
    audio_duration = Column(Float)
    created_at     = Column(DateTime, default=datetime.datetime.utcnow)

    patient        = relationship("User", back_populates="sessions",
                                   foreign_keys=[patient_id])


class TherapistPatient(Base):
    __tablename__ = "therapist_patients"

    id           = Column(Integer, primary_key=True, index=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    patient_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    notes        = Column(Text, nullable=True)
    assigned_at  = Column(DateTime, default=datetime.datetime.utcnow)

    therapist    = relationship("User", back_populates="therapist_for",
                                 foreign_keys=[therapist_id])


class ExercisePlan(Base):
    """One AI-generated exercise plan per patient per calendar day."""
    __tablename__ = "exercise_plans"
    __table_args__ = (UniqueConstraint("patient_id", "plan_date", name="uq_patient_plan_date"),)

    id             = Column(Integer, primary_key=True, index=True)
    patient_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    plan_date      = Column(Date,    nullable=False, index=True)
    exercises_json = Column(Text,    nullable=False)          # JSON array of exercise dicts
    completed      = Column(Boolean, default=False, nullable=False)
    completed_at   = Column(DateTime, nullable=True)
    created_at     = Column(DateTime, default=datetime.datetime.utcnow)


class ChatMessage(Base):
    """Persisted chat messages between a patient and Vibra."""
    __tablename__ = "chat_messages"

    id         = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role       = Column(String(20), nullable=False)   # "user" | "assistant"
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
