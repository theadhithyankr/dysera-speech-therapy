"""Feature extraction service — wav2vec2-base encoder + classical acoustic features.

Returns a 775-dim feature vector:
  [0:768]   — mean-pooled wav2vec2-base hidden states  (used for classification)
  [768:775] — 7 classical acoustic features            (used for UI display only)

The wav2vec2 backbone is downloaded automatically from HuggingFace on first use
(~360 MB, cached in ~/.cache/huggingface/).
"""

import io
import os
import warnings
import numpy as np
import torch
import librosa

# Tell HuggingFace to use the PyTorch backend only (skips broken TF import)
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("USE_FLAX", "0")

from transformers import Wav2Vec2Processor, Wav2Vec2Model

warnings.filterwarnings("ignore")

TARGET_SR = 16000
HF_MODEL  = "facebook/wav2vec2-base"

_processor = None
_encoder   = None
_device    = "cuda" if torch.cuda.is_available() else "cpu"


def _load_encoder():
    global _processor, _encoder
    if _processor is None:
        _processor = Wav2Vec2Processor.from_pretrained(HF_MODEL)
        _encoder   = Wav2Vec2Model.from_pretrained(HF_MODEL)
        _encoder.eval()
        _encoder.to(_device)


def extract_features_from_bytes(wav_bytes: bytes) -> np.ndarray:
    """
    Accept raw audio bytes (wav/mp3/ogg) and return a 775-dim feature vector.
    Raises ValueError if the clip is too short.
    """
    y, sr = librosa.load(io.BytesIO(wav_bytes), sr=TARGET_SR, mono=True)
    if len(y) < TARGET_SR * 0.3:
        raise ValueError("Audio clip too short (minimum 300 ms required)")

    # ── wav2vec2 embedding (768-dim) ────────────────────────────────────────
    _load_encoder()
    inputs = _processor(y, sampling_rate=TARGET_SR, return_tensors="pt", padding=True)
    with torch.no_grad():
        outputs = _encoder(**{k: v.to(_device) for k, v in inputs.items()})
    embedding = (
        outputs.last_hidden_state.mean(dim=1).squeeze().cpu().numpy().astype(np.float32)
    )

    # ── Classical acoustic features for UI display (7-dim) ─────────────────
    try:
        f0, voiced_flag, _ = librosa.pyin(y, fmin=50, fmax=400, sr=sr)
        f0_voiced = (
            f0[voiced_flag]
            if voiced_flag is not None and voiced_flag.any()
            else np.array([0.0])
        )
        f0_mean  = float(np.mean(f0_voiced))
        f0_std   = float(np.std(f0_voiced))
        unvoiced = float(1 - voiced_flag.mean()) if voiced_flag is not None else 1.0
    except Exception:
        f0_mean, f0_std, unvoiced = 0.0, 0.0, 1.0

    spec_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    spec_rolloff  = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))
    zcr           = float(np.mean(librosa.feature.zero_crossing_rate(y)))
    intervals     = librosa.effects.split(y, top_db=25)
    speech_frames = sum(int(e) - int(s) for s, e in intervals) if len(intervals) else 0
    pause_ratio   = float(1.0 - (speech_frames / max(len(y), 1)))

    acoustic = np.array(
        [f0_mean, f0_std, unvoiced, spec_centroid, spec_rolloff, zcr, pause_ratio],
        dtype=np.float32,
    )

    return np.concatenate([embedding, acoustic])  # (775,)
