import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from diplomat_worker.asr.base import Transcriber
from diplomat_worker.asr.config import AsrModelConfig, create_transcriber
from diplomat_worker.asr.fake import FakeTranscriber
from diplomat_worker.media.ffmpeg import FfmpegCheck, VideoProbe, probe_video
from diplomat_worker.models.registry import ModelRegistryEntry, built_in_model_registry
from diplomat_worker.storage.project_store import ProjectStore
from diplomat_worker.translation.base import TranslationProvider
from diplomat_worker.translation.config import TranslationProviderConfig, create_translation_provider

ProbeVideoFn = Callable[[Path], VideoProbe]
ExtractAudioFn = Callable[[Path, Path], Path]
FfmpegCheckFn = Callable[[Path, str, str], FfmpegCheck]
TranscriberFactory = Callable[[AsrModelConfig, str], Transcriber]
TranslationProviderFactory = Callable[[TranslationProviderConfig], TranslationProvider]


def default_data_dir() -> Path:
    configured = os.environ.get("DIPLOMAT_DATA_DIR")
    if configured and configured.strip():
        return Path(configured)

    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data and local_app_data.strip():
        return Path(local_app_data) / "Diplomat"

    return Path.home() / ".diplomat"


def default_tool_path(env_name: str, fallback: str) -> str:
    configured = os.environ.get(env_name)
    if configured and configured.strip():
        return configured.strip()
    return fallback


@dataclass(frozen=True)
class WorkerRuntime:
    store: ProjectStore
    transcriber: Transcriber | None
    probe_video_fn: ProbeVideoFn = probe_video
    extract_audio_fn: ExtractAudioFn | None = None
    ffmpeg_path: str = "ffmpeg"
    ffprobe_path: str = "ffprobe"
    ffmpeg_check_fn: FfmpegCheckFn = FfmpegCheck.for_source
    transcriber_factory: TranscriberFactory = create_transcriber
    translation_provider_factory: TranslationProviderFactory = create_translation_provider
    model_registry: list[ModelRegistryEntry] | None = field(default_factory=built_in_model_registry)
    allow_unmanaged_asr_models: bool = False


def create_default_runtime() -> WorkerRuntime:
    ffmpeg_path = default_tool_path("DIPLOMAT_FFMPEG_PATH", "ffmpeg")
    ffprobe_path = default_tool_path("DIPLOMAT_FFPROBE_PATH", "ffprobe")
    return WorkerRuntime(
        store=ProjectStore(default_data_dir() / "diplomat.db"),
        transcriber=FakeTranscriber(language="zh"),
        probe_video_fn=lambda source: probe_video(source, ffprobe_path=ffprobe_path),
        ffmpeg_path=ffmpeg_path,
        ffprobe_path=ffprobe_path,
    )
