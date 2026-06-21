from pathlib import Path

from diplomat_worker.api import runtime as runtime_module
from diplomat_worker.media.ffmpeg import VideoProbe


def test_default_runtime_uses_configured_ffmpeg_paths(monkeypatch, tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    ffmpeg_path = "C:/Tools/ffmpeg.exe"
    ffprobe_path = "C:/Tools/ffprobe.exe"
    calls = []
    monkeypatch.setenv("DIPLOMAT_DATA_DIR", str(data_dir))
    monkeypatch.setenv("DIPLOMAT_FFMPEG_PATH", ffmpeg_path)
    monkeypatch.setenv("DIPLOMAT_FFPROBE_PATH", ffprobe_path)

    def fake_probe_video(source: Path, ffprobe_path: str = "ffprobe") -> VideoProbe:
        calls.append((source, ffprobe_path))
        return VideoProbe(
            duration_ms=1000,
            has_audio=True,
            audio_codec="aac",
            video_codec="h264",
        )

    monkeypatch.setattr(runtime_module, "probe_video", fake_probe_video)

    runtime = runtime_module.create_default_runtime()
    source = tmp_path / "source.mp4"
    probe = runtime.probe_video_fn(source)

    assert runtime.ffmpeg_path == ffmpeg_path
    assert runtime.ffprobe_path == ffprobe_path
    assert runtime.store.database_path == data_dir / "diplomat.db"
    assert probe.has_audio is True
    assert calls == [(source, ffprobe_path)]


def test_default_runtime_uses_configured_development_model_root(
    monkeypatch,
    tmp_path: Path,
) -> None:
    model_root = tmp_path / "repo"
    models_dir = model_root / "models"
    monkeypatch.setenv("DIPLOMAT_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("DIPLOMAT_DEVELOPMENT_MODEL_ROOT", str(model_root))
    monkeypatch.setenv("DIPLOMAT_MODELS_DIR", str(models_dir))

    runtime = runtime_module.create_default_runtime()

    assert runtime.development_model_root == model_root
    assert runtime.store.models_root() == models_dir


def test_default_tool_path_ignores_blank_env_values(monkeypatch) -> None:
    monkeypatch.setenv("DIPLOMAT_FFMPEG_PATH", "  ")

    assert runtime_module.default_tool_path("DIPLOMAT_FFMPEG_PATH", "ffmpeg") == "ffmpeg"
