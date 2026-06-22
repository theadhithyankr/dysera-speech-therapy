"""
Train a dysarthria classifier using frozen wav2vec2-base embeddings + LogisticRegression.

Reads:   archive/ wav files  (TORGO dataset — already present in the repo)
Writes:  ml_models/dysarthria_head.npz  (pure numpy — no pkl, no version mismatch ever)
         ml_models/metrics.txt          (CV classification report)
         data/wav2vec2_embeddings.npz   (embedding cache — delete to force re-extraction)

Run once:  python train_model.py
"""

import re
import os
import warnings
import numpy as np
from pathlib import Path

import torch
import librosa

# Tell HuggingFace to use the PyTorch backend only (skips broken TF import)
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("USE_FLAX", "0")

from transformers import Wav2Vec2Processor, Wav2Vec2Model
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import StratifiedGroupKFold, cross_val_predict
from sklearn.metrics import classification_report

warnings.filterwarnings("ignore")

ROOT      = Path(__file__).parent if "__file__" in dir() else Path.cwd()
ARCHIVE   = ROOT.parent / "archive"
MODEL_DIR = ROOT / "ml_models"
DATA_DIR  = ROOT / "data"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

OUT_HEAD    = MODEL_DIR / "dysarthria_head.npz"
OUT_METRICS = MODEL_DIR / "metrics.txt"
CACHE_FILE  = DATA_DIR  / "wav2vec2_embeddings.npz"

HF_MODEL   = "facebook/wav2vec2-base"
TARGET_SR  = 16000
DEVICE     = "cuda" if torch.cuda.is_available() else "cpu"
BATCH_SIZE = 1          # process one file at a time to avoid OOM on CPU
MAX_SAMPLES = TARGET_SR * 5  # truncate to 5 seconds max

SPEAKER_SEVERITY = {
    # Dysarthric
    "F01": "Severe",  "F03": "Severe",  "F04": "Severe",
    "M01": "Severe",  "M03": "Severe",
    "M02": "Moderate","M05": "Moderate",
    "M04": "Mild",
    # Controls
    "FC01": "Healthy","FC02": "Healthy","FC03": "Healthy",
    "MC01": "Healthy","MC02": "Healthy","MC03": "Healthy","MC04": "Healthy",
}


def _get_speaker_id(folder_name: str):
    m = re.search(r'_([A-Z]{1,2}\d+)(?:S\d+)?$', folder_name)
    return m.group(1) if m else None


def _find_wav_files():
    files, labels, speakers = [], [], []
    for wav_path in sorted(ARCHIVE.rglob("*.wav")):
        speaker_id = _get_speaker_id(wav_path.parent.name)
        if speaker_id is None:
            continue
        severity = SPEAKER_SEVERITY.get(speaker_id)
        if severity is None:
            continue
        files.append(wav_path)
        labels.append(severity)
        speakers.append(speaker_id)
    return files, labels, speakers


def _embed_one(path, processor, model):
    """Embed a single audio file → (768,) float32."""
    try:
        y, _ = librosa.load(str(path), sr=TARGET_SR, mono=True)
        if len(y) < TARGET_SR * 0.3:
            y = np.zeros(TARGET_SR, dtype=np.float32)
    except Exception:
        y = np.zeros(TARGET_SR, dtype=np.float32)
    # Truncate to MAX_SAMPLES to keep memory bounded
    y = y[:MAX_SAMPLES]
    inputs = processor(y, sampling_rate=TARGET_SR, return_tensors="pt")
    with torch.no_grad():
        out = model(**{k: v.to(DEVICE) for k, v in inputs.items()})
    return out.last_hidden_state.mean(dim=1).squeeze(0).cpu().numpy().astype(np.float32)


def _extract_embeddings(files, processor, model, start_from=0):
    """Extract embeddings file-by-file; start_from lets us resume a partial run.
    Saves a partial checkpoint every 500 files so a crash doesn't lose progress."""
    PARTIAL_FILE = DATA_DIR / "wav2vec2_embeddings_partial.npz"
    embeddings = []
    total = len(files)
    for i, path in enumerate(files):
        if i < start_from:
            continue
        embeddings.append(_embed_one(path, processor, model))
        done = i + 1
        if done % 200 == 0 or done == total:
            print(f"  Embedded {done}/{total} files")
        # Save partial checkpoint every 500 files
        if done % 500 == 0 and done < total:
            np.savez(PARTIAL_FILE,
                     embeddings=np.array(embeddings, dtype=np.float32),
                     count=np.array(start_from + len(embeddings)))
    return np.array(embeddings, dtype=np.float32)


def main():
    print("Scanning archive/ for wav files...")
    files, labels, speakers = _find_wav_files()
    if not files:
        raise RuntimeError(
            "No labelled wav files found under archive/. "
            "Ensure the TORGO dataset is present."
        )
    print(f"Found {len(files)} files across {len(set(speakers))} speakers.")
    import pandas as pd
    print(pd.Series(labels).value_counts().to_string(), "\n")

    # ── Embeddings (cached, with resume support) ─────────────────────────────
    PARTIAL_FILE = DATA_DIR / "wav2vec2_embeddings_partial.npz"
    start_from   = 0
    X_partial     = None

    if CACHE_FILE.exists():
        print(f"Loading cached embeddings from {CACHE_FILE}")
        cache           = np.load(CACHE_FILE, allow_pickle=True)
        X               = cache["embeddings"]
        cached_labels   = list(cache["labels"])
        if len(X) == len(files) and cached_labels == labels:
            print(f"Cache valid: {X.shape}")
        else:
            print("Cache mismatch — re-extracting...")
            CACHE_FILE.unlink()

    if not CACHE_FILE.exists():
        # Resume from a partial run if available
        if PARTIAL_FILE.exists():
            p = np.load(PARTIAL_FILE, allow_pickle=True)
            X_partial  = p["embeddings"]
            start_from = int(p["count"])
            print(f"Resuming from file {start_from}/{len(files)} (partial cache found)")

        print(f"\nLoading {HF_MODEL} from HuggingFace "
              f"(downloads ~360 MB on first run, then cached)...")
        processor = Wav2Vec2Processor.from_pretrained(HF_MODEL)
        encoder   = Wav2Vec2Model.from_pretrained(HF_MODEL)
        encoder.eval()
        encoder.to(DEVICE)
        print(f"Extracting embeddings on {DEVICE} (one file at a time, max 5 s)...")

        new_embs = _extract_embeddings(files, processor, encoder, start_from=start_from)
        del encoder  # free memory

        X = np.concatenate([X_partial, new_embs], axis=0) if X_partial is not None else new_embs

        np.savez(
            CACHE_FILE,
            embeddings=X,
            labels=np.array(labels),
            speakers=np.array(speakers),
        )
        if PARTIAL_FILE.exists():
            PARTIAL_FILE.unlink()
        print(f"Embeddings cached → {CACHE_FILE}")

    # ── Encode labels ─────────────────────────────────────────────────────────
    y_arr  = np.array(labels)
    groups = np.array(speakers)
    le     = LabelEncoder()
    y_enc  = le.fit_transform(y_arr)
    print(f"Classes: {list(le.classes_)}")

    # ── Standardise ───────────────────────────────────────────────────────────
    scaler   = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # ── Speaker-independent cross-validation ─────────────────────────────────
    print("\nRunning 5-fold speaker-independent cross-validation...")
    cv      = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
    clf_cv  = LogisticRegression(
        max_iter=1000, C=1.0, class_weight="balanced", random_state=42,
    )
    y_pred  = cross_val_predict(clf_cv, X_scaled, y_enc, groups=groups, cv=cv)
    report  = classification_report(y_enc, y_pred, target_names=le.classes_)
    print("Cross-validation results:")
    print(report)

    # ── Train final model on all data ─────────────────────────────────────────
    print("Training final model on full dataset...")
    clf = LogisticRegression(
        max_iter=1000, C=1.0, class_weight="balanced", random_state=42,
    )
    clf.fit(X_scaled, y_enc)

    # ── Save as pure numpy (no pkl, no version issues) ────────────────────────
    np.savez(
        OUT_HEAD,
        coef         = clf.coef_,
        intercept    = clf.intercept_,
        classes      = le.classes_,
        scaler_mean  = scaler.mean_,
        scaler_scale = scaler.scale_,
    )
    print(f"Model saved  → {OUT_HEAD}")

    OUT_METRICS.write_text(
        f"wav2vec2-base + LogisticRegression\n"
        f"{'='*50}\n"
        f"{report}\n"
    )
    print(f"Metrics saved → {OUT_METRICS}")


if __name__ == "__main__":
    main()
