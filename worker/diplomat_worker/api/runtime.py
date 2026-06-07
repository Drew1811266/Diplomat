import os
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from diplomat_worker.asr.base import Transcriber
from diplomat_worker.asr.config import AsrModelConfig, create_transcriber
from diplomat_worker.asr.fake import FakeTranscriber
from diplomat_worker.media.ffmpeg import FfmpegCheck, VideoProbe, probe_video
from diplomat_worker.storage.project_store import ProjectStore

ProbeVideoFn = Callable[[Path], VideoProbe]
ExtractAudioFn = Callable[[Path, Path], Path]
FfmpegCheckFn = Callable[[Path, str, str], FfmpegCheck]
TranscriberFactory = Callable[[AsrModelConfig, str], Transcriber]


def default_data_dir() -> Path:
    configured = os.environ.get("DIPLOMAT_DATA_DIR")
    if configured and configured.strip():
        return Path(configured)

    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data and local_app_data.strip():
        return Path(local_app_data) / "Diplomat"

    return Path.home() / ".diplomat"


@dataclass(frozen=True)
class WorkerRuntime:
    store: ProjectStore
    transcriber: Transcriber
    probe_video_fn: ProbeVideoFn = probe_video
    extract_audio_fn: ExtractAudioFn | None = None
    ffmpeg_path: str = "ffmpeg"
    ffprobe_path: str = "ffprobe"
    ffmpeg_check_fn: FfmpegCheckFn = FfmpegCheck.for_source
    transcriber_factory: TranscriberFactory = create_transcriber


def create_default_runtime() -> WorkerRuntime:
    return WorkerRuntime(
        store=ProjectStore(default_data_dir() / "diplomat.db"),
        transcriber=FakeTranscriber(language="zh"),
    )
