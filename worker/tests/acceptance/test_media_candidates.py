import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def write_fake_ffprobe(tmp_path: Path) -> Path:
    ffprobe = tmp_path / "ffprobe.cmd"
    payloads = {
        "eligible.mp4": {
            "format": {"duration": "7200"},
            "streams": [
                {"codec_type": "video", "codec_name": "h264"},
                {"codec_type": "audio", "codec_name": "aac"},
            ],
        },
        "short.mp4": {
            "format": {"duration": "42"},
            "streams": [
                {"codec_type": "video", "codec_name": "h264"},
                {"codec_type": "audio", "codec_name": "aac"},
            ],
        },
        "smoke.mp4": {
            "format": {"duration": "600"},
            "streams": [
                {"codec_type": "video", "codec_name": "h264"},
                {"codec_type": "audio", "codec_name": "aac"},
            ],
        },
        "silent.mp4": {
            "format": {"duration": "7200"},
            "streams": [{"codec_type": "video", "codec_name": "h264"}],
        },
        "audio-only.m4a": {
            "format": {"duration": "7200"},
            "streams": [{"codec_type": "audio", "codec_name": "aac"}],
        },
    }
    lines = ["@echo off"]
    for filename, payload in payloads.items():
        lines.extend(
            [
                f"echo %* | findstr /C:\"{filename}\" >NUL",
                "if %ERRORLEVEL%==0 (",
                f"  echo {json.dumps(payload)}",
                "  exit /B 0",
                ")",
            ]
        )
    lines.extend(["echo {}", "exit /B 1"])
    ffprobe.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return ffprobe


def test_find_0_40_media_candidates_classifies_video_sources(tmp_path: Path) -> None:
    media_dir = tmp_path / "media"
    media_dir.mkdir()
    for filename in ["eligible.mp4", "short.mp4", "silent.mp4", "audio-only.m4a"]:
        (media_dir / filename).write_bytes(b"fixture")

    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "acceptance" / "find-0-40-media-candidates.py"),
            str(media_dir),
            "--recursive",
            "--ffprobe-path",
            str(write_fake_ffprobe(tmp_path)),
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0
    payload = json.loads(result.stdout)
    assert payload["eligibleCount"] == 1
    assert payload["eligible"][0]["path"].endswith("eligible.mp4")
    rejected = {Path(item["path"]).name: item["reason"] for item in payload["rejected"]}
    assert rejected == {
        "short.mp4": "shorter than two hours",
        "silent.mp4": "missing audio stream",
        "audio-only.m4a": "missing video stream",
    }


def test_find_0_40_media_candidates_supports_smoke_profile(tmp_path: Path) -> None:
    media_dir = tmp_path / "media"
    media_dir.mkdir()
    (media_dir / "smoke.mp4").write_bytes(b"fixture")

    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "acceptance" / "find-0-40-media-candidates.py"),
            str(media_dir),
            "--recursive",
            "--acceptance-profile",
            "smoke",
            "--ffprobe-path",
            str(write_fake_ffprobe(tmp_path)),
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0
    payload = json.loads(result.stdout)
    assert payload["acceptanceProfile"] == "smoke"
    assert payload["minimumDurationMs"] == 300_000
    assert payload["eligibleCount"] == 1
    assert payload["eligible"][0]["path"].endswith("smoke.mp4")
