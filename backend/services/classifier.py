"""Classifier service — loads a pure-numpy LogReg head; no pkl, no version issues.

Expects a 775-dim feature vector from feature_extractor.extract_features_from_bytes():
  [0:768]   — wav2vec2-base embedding  (used for classification)
  [768:775] — classical acoustic feats (used for UI display only)

The head is stored as ml_models/dysarthria_head.npz — plain numpy arrays.
Generate it with:  python train_model.py
"""

import numpy as np
from pathlib import Path
from dataclasses import dataclass

_MODEL_DIR    = Path(__file__).parent.parent / "ml_models"
_HEAD_PATH    = _MODEL_DIR / "dysarthria_head.npz"

_coef         = None
_intercept    = None
_classes      = None
_scaler_mean  = None
_scaler_scale = None

_EXTRA_NAMES = [
    "f0_mean", "f0_std", "unvoiced_ratio",
    "spectral_centroid", "spectral_rolloff",
    "zero_crossing_rate", "pause_ratio",
]

_LABEL_MAP = {
    "healthy": "Healthy",
    "mild": "Mild",
    "moderate": "Moderate",
    "severe": "Severe",
    "control": "Control",
    "dysarthric": "Dysarthric",
}


@dataclass
class PredictionResult:
    severity: str            # Model output label exposed to the UI
    confidence: float        # 0..1 — probability of predicted class
    probabilities: dict      # {class: probability}
    score: float             # overall intelligibility score (0-100, higher = better)
    acoustic_features: dict  # subset of named features for the UI


def _load_model():
    global _coef, _intercept, _classes, _scaler_mean, _scaler_scale
    if _coef is not None:
        return
    if not _HEAD_PATH.exists():
        raise FileNotFoundError(
            f"Trained model not found at {_HEAD_PATH}. "
            "Run `python train_model.py` first."
        )
    data          = np.load(_HEAD_PATH, allow_pickle=True)
    _coef         = data["coef"].astype(np.float64)
    _intercept    = data["intercept"].astype(np.float64)
    _classes      = list(data["classes"])
    _scaler_mean  = data["scaler_mean"].astype(np.float64)
    _scaler_scale = data["scaler_scale"].astype(np.float64)


def _canonical_label(label) -> str:
    if label is None:
        return "Unknown"
    text = str(label).strip()
    if not text:
        return "Unknown"
    return _LABEL_MAP.get(text.lower(), text)


def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - x.max())
    return e / e.sum()


def predict(features: np.ndarray) -> PredictionResult:
    """
    features: (775,) float32 array from feature_extractor.extract_features_from_bytes()
    Returns a PredictionResult with severity label, confidence, and UI-ready scores.
    """
    _load_model()

    emb      = features[:768].astype(np.float64)
    emb_norm = (emb - _scaler_mean) / _scaler_scale

    logits = emb_norm @ _coef.T + _intercept  # (n_classes,)
    proba  = _softmax(logits)

    class_idx  = int(np.argmax(proba))
    raw_label  = _classes[class_idx]
    severity   = _canonical_label(raw_label)
    confidence = float(proba[class_idx])

    probs_dict = {
        _canonical_label(cls): round(float(p), 4)
        for cls, p in zip(_classes, proba)
    }

    severity_to_score = {
        "Healthy": 95, "Mild": 72, "Moderate": 48, "Severe": 22,
        "Control": 92, "Dysarthric": 35,
    }
    base_score = severity_to_score.get(severity, 50)
    score = round(base_score + (confidence - 0.5) * 10, 1)
    score = float(np.clip(score, 5, 100))

    # Last 7 dims are the classical acoustic features for the UI
    acoustic = {name: round(float(features[768 + i]), 4)
                for i, name in enumerate(_EXTRA_NAMES)}

    return PredictionResult(
        severity=severity,
        confidence=round(confidence, 4),
        probabilities=probs_dict,
        score=score,
        acoustic_features=acoustic,
    )
