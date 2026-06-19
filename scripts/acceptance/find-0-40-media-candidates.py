from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKER_ROOT = ROOT / "worker"
if str(WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKER_ROOT))

from diplomat_worker.media.ffmpeg import probe_video  # noqa: E402


MIN_ACCEPTANCE_DURATION_MS = 3 * 60 * 60 * 1000
MEDIA_EXTENSIONS = {
    ".avi",
    ".flv",
    ".m4a",
    ".m4v",
    ".mkv",
    ".mov",
    ".mp3",
    ".mp4",
    ".mpeg",
    ".mpg",
    ".wav",
    ".webm",
}


def main() -> int:
    args = parse_args()
    candidates = list(iter_media_paths(args.paths, recursive=args.recursive))
    eligible: list[dict] = []
    rejected: list[dict] = []

    for path in candidates:
        record = {"path": str(path.resolve())}
        try:
            probe = probe_video(path, ffprobe_path=args.ffprobe_path)
        except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as exc:
            rejected.append(record | {"reason": f"probe failed: {exc}"})
            continue

        record |= {
            "durationMs": probe.duration_ms,
            "audioCodec": probe.audio_codec,
            "videoCodec": probe.video_codec,
        }
        reason = rejection_reason(probe, min_duration_ms=args.min_duration_ms)
        if reason is None:
            eligible.append(record)
        else:
            rejected.append(record | {"reason": reason})

    payload = {
        "schemaVersion": "diplomat.0-40-mediaCandidates.v1",
        "minimumDurationMs": args.min_duration_ms,
        "recursive": args.recursive,
        "scannedCount": len(candidates),
        "eligibleCount": len(eligible),
        "eligible": eligible,
        "rejected": rejected,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Find media files that satisfy Diplomat 0.40 acceptance prerequisites.")
    parser.add_argument("paths", nargs="+", type=Path, help="Media files or directories to scan.")
    parser.add_argument("--recursive", action="store_true", help="Scan directories recursively.")
    parser.add_argument("--ffprobe-path", default="ffprobe")
    parser.add_argument("--min-duration-ms", type=int, default=MIN_ACCEPTANCE_DURATION_MS)
    return parser.parse_args()


def iter_media_paths(paths: list[Path], *, recursive: bool) -> list[Path]:
    found: list[Path] = []
    for path in paths:
        if path.is_file():
            if is_media_path(path):
                found.append(path)
            continue
        if not path.is_dir():
            continue
        iterator = path.rglob("*") if recursive else path.iterdir()
        found.extend(item for item in iterator if item.is_file() and is_media_path(item))
    return sorted(dict.fromkeys(found), key=lambda item: str(item).casefold())


def is_media_path(path: Path) -> bool:
    return path.suffix.lower() in MEDIA_EXTENSIONS


def rejection_reason(probe, *, min_duration_ms: int) -> str | None:
    if probe.duration_ms < min_duration_ms:
        return "shorter than three hours"
    if not probe.has_audio:
        return "missing audio stream"
    if probe.video_codec is None:
        return "missing video stream"
    return None


if __name__ == "__main__":
    raise SystemExit(main())
