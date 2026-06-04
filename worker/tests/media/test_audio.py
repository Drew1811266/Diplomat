import subprocess
from pathlib import Path

import pytest

from diplomat_worker.media.audio import AudioChunk, build_fixed_chunks, extract_audio


def test_build_fixed_chunks_covers_duration_with_overlap() -> None:
    chunks = build_fixed_chunks(duration_ms=65_000, chunk_ms=30_000, overlap_ms=500)

    assert chunks == [
        AudioChunk(index=0, start_ms=0, end_ms=30_000),
        AudioChunk(index=1, start_ms=29_500, end_ms=59_500),
        AudioChunk(index=2, start_ms=59_000, end_ms=65_000),
    ]


def test_build_fixed_chunks_rejects_invalid_overlap() -> None:
    with pytest.raises(ValueError):
        build_fixed_chunks(duration_ms=0, chunk_ms=500, overlap_ms=500)


def test_extract_audio_builds_expected_ffmpeg_command(monkeypatch, tmp_path: Path) -> None:
    source = tmp_path / "source.mp4"
    target = tmp_path / "audio.wav"
    source.write_bytes(b"fake")
    commands = []

    def fake_run(command, capture_output, text, check):
        commands.append(command)
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    monkeypatch.setattr(subprocess, "run", fake_run)

    extract_audio(source, target, ffmpeg_path="ffmpeg")

    assert commands[0] == [
        "ffmpeg",
        "-y",
        "-i",
        str(source),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        str(target),
    ]
