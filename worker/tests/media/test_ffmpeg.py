import json
import subprocess
from pathlib import Path

from diplomat_worker.media.ffmpeg import FfmpegCheck, probe_video


def test_probe_video_parses_duration_and_audio_stream(monkeypatch, tmp_path: Path) -> None:
    source = tmp_path / "demo.mp4"
    source.write_bytes(b"fake")

    def fake_run(command, capture_output, text, check):
        assert "ffprobe" in command[0]
        return subprocess.CompletedProcess(
            command,
            0,
            stdout=json.dumps(
                {
                    "format": {"duration": "12.5"},
                    "streams": [
                        {"codec_type": "video", "codec_name": "h264"},
                        {"codec_type": "audio", "codec_name": "aac"},
                    ],
                }
            ),
            stderr="",
        )

    monkeypatch.setattr(subprocess, "run", fake_run)

    probe = probe_video(source, ffprobe_path="ffprobe")

    assert probe.duration_ms == 12_500
    assert probe.has_audio is True


def test_probe_video_detects_audio_stream_without_codec_name(monkeypatch, tmp_path: Path) -> None:
    source = tmp_path / "demo.mp4"
    source.write_bytes(b"fake")

    def fake_run(command, capture_output, text, check):
        assert "ffprobe" in command[0]
        return subprocess.CompletedProcess(
            command,
            0,
            stdout=json.dumps(
                {
                    "format": {"duration": "1"},
                    "streams": [{"codec_type": "audio"}],
                }
            ),
            stderr="",
        )

    monkeypatch.setattr(subprocess, "run", fake_run)

    probe = probe_video(source, ffprobe_path="ffprobe")

    assert probe.has_audio is True
    assert probe.audio_codec is None


def test_probe_video_preserves_first_audio_stream_codec_name(monkeypatch, tmp_path: Path) -> None:
    source = tmp_path / "demo.mp4"
    source.write_bytes(b"fake")

    def fake_run(command, capture_output, text, check):
        assert "ffprobe" in command[0]
        return subprocess.CompletedProcess(
            command,
            0,
            stdout=json.dumps(
                {
                    "format": {"duration": "1"},
                    "streams": [
                        {"codec_type": "audio"},
                        {"codec_type": "audio", "codec_name": "aac"},
                    ],
                }
            ),
            stderr="",
        )

    monkeypatch.setattr(subprocess, "run", fake_run)

    probe = probe_video(source, ffprobe_path="ffprobe")

    assert probe.has_audio is True
    assert probe.audio_codec is None


def test_probe_video_preserves_first_video_stream_codec_name(monkeypatch, tmp_path: Path) -> None:
    source = tmp_path / "demo.mp4"
    source.write_bytes(b"fake")

    def fake_run(command, capture_output, text, check):
        assert "ffprobe" in command[0]
        return subprocess.CompletedProcess(
            command,
            0,
            stdout=json.dumps(
                {
                    "format": {"duration": "1"},
                    "streams": [
                        {"codec_type": "video"},
                        {"codec_type": "video", "codec_name": "h264"},
                    ],
                }
            ),
            stderr="",
        )

    monkeypatch.setattr(subprocess, "run", fake_run)

    probe = probe_video(source, ffprobe_path="ffprobe")

    assert probe.video_codec is None


def test_ffmpeg_check_reports_missing_source(tmp_path: Path) -> None:
    check = FfmpegCheck.for_source(tmp_path / "missing.mp4", ffmpeg_path="ffmpeg", ffprobe_path="ffprobe")

    assert check.ok is False
    assert check.error_code == "SOURCE_NOT_FOUND"
