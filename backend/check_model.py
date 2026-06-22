from pathlib import Path
import random
import sys


ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.feature_extractor import extract_features_from_bytes
from services.classifier import predict


def main() -> int:
    wav_files = list((REPO_ROOT / "archive").rglob("*.wav"))
    if not wav_files:
        print("No .wav files found under archive/")
        return 1

    sample_count = min(8, len(wav_files))
    samples = random.sample(wav_files, sample_count)
    outputs = []

    for path in samples:
        raw = path.read_bytes()
        features = extract_features_from_bytes(raw)
        result = predict(features)
        record = {
            "file": str(path.relative_to(REPO_ROOT)),
            "severity": result.severity,
            "score": result.score,
            "confidence": result.confidence,
            "probabilities": result.probabilities,
        }
        outputs.append(record)

        print("=" * 80)
        print(f"FILE: {record['file']}")
        print(f"SEVERITY: {record['severity']}")
        print(f"SCORE: {record['score']}")
        print(f"CONFIDENCE: {record['confidence']}")
        print(f"PROBABILITIES: {record['probabilities']}")

    unique_outputs = {
        (
            item["severity"],
            item["score"],
            round(item["confidence"], 4),
            tuple(sorted(item["probabilities"].items())),
        )
        for item in outputs
    }

    print("\n" + "=" * 80)
    print(f"Checked {len(outputs)} files")
    print(f"Unique prediction patterns: {len(unique_outputs)}")

    if len(unique_outputs) == 1:
        print("WARNING: model is behaving like a constant classifier")
        return 2

    print("Model output changes across files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())