"""
Feature extraction from the TORGO dataset.
Produces: data/torgo_features.csv

Fast mode: uses librosa.yin (deterministic, ~5x faster than pyin)
           + multiprocessing for parallel file processing.
"""

import re
import sys
import warnings
import multiprocessing as mp
import numpy as np
import pandas as pd
import librosa
from pathlib import Path

warnings.filterwarnings("ignore")

ROOT = Path(__file__).parent if "__file__" in dir() else Path.cwd()
TORGO_ROOT = ROOT.parent / "archive"
OUT_CSV = ROOT / "data" / "torgo_features.csv"
N_WORKERS = max(1, mp.cpu_count() - 1)   # leave one core free

SPEAKER_SEVERITY = {
    # Dysarthric
    "F01": "Severe",
    "F03": "Severe",
    "F04": "Severe",  # ALS speaker
    "M01": "Severe",
    "M03": "Severe",
    "M02": "Moderate",
    "M05": "Moderate",
    "M04": "Mild",
    # Controls
    "FC01": "Healthy",
    "FC02": "Healthy",
    "FC03": "Healthy",
    "MC01": "Healthy",
    "MC02": "Healthy",
    "MC03": "Healthy",
    "MC04": "Healthy",
}


def get_speaker_id(folder_name: str) -> str | None:
    """Extract speaker ID from folders like wav_headMic_F01, wav_headMic_F03S01, wav_arrayMic_MC01."""
    match = re.search(r'_([A-Z]{1,2}\d+)(?:S\d+)?$', folder_name)
    return match.group(1) if match else None


def extract_features(wav_path: str, target_sr: int = 16000) -> np.ndarray | None:
    """
    Return an 87-dimensional feature vector:
      40 MFCC means + 40 MFCC stds + 7 prosodic/spectral features.
    Uses librosa.yin (fast deterministic pitch) instead of pyin.
    Returns None if the clip is too short or unreadable.
    """
    try:
        y, sr = librosa.load(wav_path, sr=target_sr, mono=True)
        if len(y) < target_sr * 0.3:   # skip clips shorter than 300 ms
            return None

        # MFCCs (40 coefficients)
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=40)
        mfcc_mean = np.mean(mfcc, axis=1)   # (40,)
        mfcc_std  = np.std(mfcc,  axis=1)   # (40,)

        # Pitch via YIN (fast deterministic — ~5x faster than pyin)
        try:
            f0 = librosa.yin(y, fmin=50, fmax=400, sr=sr, frame_length=1024)
            voiced_mask = f0 > 80   # frames above 80 Hz = voiced
            f0_voiced   = f0[voiced_mask] if voiced_mask.any() else np.array([0.0])
            f0_mean     = float(np.mean(f0_voiced))
            f0_std      = float(np.std(f0_voiced))
            unvoiced    = float(1.0 - voiced_mask.mean())
        except Exception:
            f0_mean, f0_std, unvoiced = 0.0, 0.0, 1.0

        # Spectral features
        spec_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        spec_rolloff  = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))
        zcr           = float(np.mean(librosa.feature.zero_crossing_rate(y)))

        # Pause ratio
        intervals     = librosa.effects.split(y, top_db=25)
        speech_frames = sum(int(e) - int(s) for s, e in intervals) if len(intervals) else 0
        pause_ratio   = float(1.0 - (speech_frames / max(len(y), 1)))

        extra = np.array([f0_mean, f0_std, unvoiced,
                          spec_centroid, spec_rolloff, zcr, pause_ratio],
                         dtype=np.float32)

        return np.concatenate([mfcc_mean.astype(np.float32),
                               mfcc_std.astype(np.float32),
                               extra])  # shape: (87,)

    except Exception as e:
        print(f"    [skip] {Path(wav_path).name}: {e}", flush=True)
        return None


def _worker(args):
    """Worker function for multiprocessing: (wav_path, speaker_id, severity) -> record dict or None."""
    wav_path, speaker_id, severity = args
    feats = extract_features(wav_path)
    if feats is None:
        return None
    record = {"file": wav_path, "speaker": speaker_id, "severity": severity}
    record.update({f"f{i}": float(v) for i, v in enumerate(feats)})
    return record


def build_dataset(torgo_root: Path, headmic_only: bool = True) -> pd.DataFrame:
    # Collect all (wav_path, speaker_id, severity) tasks
    tasks = []
    for top_dir in ["F_Con", "F_Dys", "M_Con", "M_Dys"]:
        top_path = torgo_root / top_dir
        if not top_path.exists():
            print(f"  [warn] Folder not found: {top_path}", flush=True)
            continue
        for session_dir in sorted(top_path.iterdir()):
            if not session_dir.is_dir():
                continue
            if headmic_only and "headMic" not in session_dir.name:
                continue
            speaker_id = get_speaker_id(session_dir.name)
            if not speaker_id or speaker_id not in SPEAKER_SEVERITY:
                print(f"  [warn] Unknown speaker in: {session_dir.name}", flush=True)
                continue
            severity  = SPEAKER_SEVERITY[speaker_id]
            wav_files = list(session_dir.glob("*.wav"))
            print(f"  Queued {session_dir.name} -> {speaker_id} ({severity}) : {len(wav_files)} files",
                  flush=True)
            for wf in wav_files:
                tasks.append((str(wf), speaker_id, severity))

    print(f"\nTotal tasks: {len(tasks)}, workers: {N_WORKERS}", flush=True)

    # Parallel extraction
    records = []
    skipped = 0
    with mp.Pool(N_WORKERS) as pool:
        for i, result in enumerate(pool.imap_unordered(_worker, tasks, chunksize=16)):
            if result is not None:
                records.append(result)
            else:
                skipped += 1
            if (i + 1) % 500 == 0:
                print(f"  ... processed {i+1}/{len(tasks)} files, {len(records)} kept", flush=True)

    df = pd.DataFrame(records)
    print(f"\nExtracted {len(df)} samples, skipped {skipped}", flush=True)
    if not df.empty:
        print(df["severity"].value_counts().to_string(), flush=True)
    return df


if __name__ == "__main__":
    print(f"TORGO root  : {TORGO_ROOT}")
    print(f"Workers     : {N_WORKERS}")
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)

    df = build_dataset(TORGO_ROOT, headmic_only=True)

    if df.empty:
        print("\nERROR: No samples found. Check that the dataset is at the correct path.")
        sys.exit(1)

    df.to_csv(OUT_CSV, index=False)
    print(f"\nSaved -> {OUT_CSV}  ({len(df)} rows)")
