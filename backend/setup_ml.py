"""
Set up the ML pipeline: wav2vec2-base encoder + LogisticRegression head.
Run this once: python setup_ml.py

The wav2vec2 backbone (~360 MB) is downloaded automatically from HuggingFace
on first use and cached in ~/.cache/huggingface/.
No Kaggle account or API key required — uses the archive/ wav files directly.
"""

import os
import sys
import subprocess
from pathlib import Path

ROOT        = Path(__file__).parent if "__file__" in dir() else Path.cwd()
ARCHIVE_DIR = ROOT.parent / "archive"
MODELS_DIR  = ROOT / "ml_models"
HEAD_PATH   = MODELS_DIR / "dysarthria_head.npz"


def step(msg: str):
    print(f"\n{'='*60}\n  {msg}\n{'='*60}")

def run(cmd: list[str]):
    subprocess.run(cmd, check=True, shell=(os.name == "nt"))


# ── 1. Check dataset ──────────────────────────────────────────────────────────
step("Step 1/2 — Checking archive/ directory")
wav_files = list(ARCHIVE_DIR.rglob("*.wav"))
if not wav_files:
    print("  ERROR: No .wav files found in archive/.")
    print("  Please ensure the TORGO dataset is present under archive/.")
    sys.exit(1)
print(f"  Found {len(wav_files)} wav files in archive/")

# ── 2. Train model ────────────────────────────────────────────────────────────
step("Step 2/2 — Training wav2vec2-base + LogReg classifier")
if HEAD_PATH.exists():
    print("  Model already trained, skipping.")
    print("  Delete ml_models/dysarthria_head.npz to force a retrain.")
else:
    run([sys.executable, str(ROOT / "train_model.py")])

step("All done! Backend is ready. Start the API with:  uvicorn main:app --reload")

