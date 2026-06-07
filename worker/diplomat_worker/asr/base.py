from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Protocol

from diplomat_worker.media.audio import AudioChunk

ProgressCallback = Callable[[float, str], None]


class AsrCanceled(RuntimeError):
    pass


@dataclass(frozen=True)
class AsrWord:
    text: str
    start_ms: int
    end_ms: int
    confidence: float | None


@dataclass(frozen=True)
class AsrSegment:
    id: str
    start_ms: int
    end_ms: int
    text: str
    words: list[AsrWord]


@dataclass(frozen=True)
class AsrResult:
    engine: str
    model: str
    language: str
    segments: list[AsrSegment]


class CancelToken(Protocol):
    def is_cancel_requested(self) -> bool:
        raise NotImplementedError


class Transcriber(Protocol):
    def transcribe(
        self,
        audio_path: Path,
        chunks: list[AudioChunk],
        progress_callback: ProgressCallback | None = None,
        cancel_token: CancelToken | None = None,
    ) -> AsrResult:
        raise NotImplementedError
