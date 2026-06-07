import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from diplomat_worker.asr.base import AsrCanceled, CancelToken, ProgressCallback, Transcriber
from diplomat_worker.media.audio import build_fixed_chunks, extract_audio
from diplomat_worker.schemas.subtitle import AiOrigin, Speaker, SubtitleDocument, SubtitleLine, SubtitleStyle, WordTiming


@dataclass(frozen=True)
class CorePipelineInput:
    project_id: str
    media_id: str
    source_video: Path
    project_dir: Path
    duration_ms: int
    source_language: str
    target_language: str | None


@dataclass(frozen=True)
class CorePipelineResult:
    subtitle_document: SubtitleDocument
    subtitle_path: Path
    audio_path: Path


def default_style() -> SubtitleStyle:
    return SubtitleStyle(
        id="default",
        name="Default",
        font_family="Arial",
        font_size=36,
        primary_color="#FFFFFF",
        secondary_color="#14B8A6",
        stroke_width=3,
        shadow=1,
        position="bottom-center",
        margin_v=48,
        alignment="center",
        bilingual_layout="source-above-target",
        line_spacing=1.15,
    )


def default_speaker() -> Speaker:
    return Speaker(
        id="speaker-unknown",
        display_name="Unknown Speaker",
        color="#0D9488",
        style_id="default",
        merged_into=None,
    )


def run_core_pipeline(
    request: CorePipelineInput,
    transcriber: Transcriber,
    extract_audio_fn: Callable[[Path, Path], Path] | None = None,
    ffmpeg_path: str = "ffmpeg",
    progress_callback: ProgressCallback | None = None,
    cancel_token: CancelToken | None = None,
) -> CorePipelineResult:
    def raise_if_canceled() -> None:
        if cancel_token is not None and cancel_token.is_cancel_requested():
            raise AsrCanceled("Analysis canceled")

    request.project_dir.mkdir(parents=True, exist_ok=True)
    cache_dir = request.project_dir / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    audio_path = cache_dir / "audio-16000-mono.wav"

    raise_if_canceled()
    if progress_callback is not None:
        progress_callback(0.05, "Extracting audio")
    extractor = extract_audio_fn or (lambda source, target: extract_audio(source, target, ffmpeg_path=ffmpeg_path))
    extractor(request.source_video, audio_path)

    raise_if_canceled()
    if progress_callback is not None:
        progress_callback(0.25, "Chunking audio")
    chunks = build_fixed_chunks(request.duration_ms)
    asr_result = transcriber.transcribe(
        audio_path=audio_path,
        chunks=chunks,
        progress_callback=(
            None
            if progress_callback is None
            else lambda progress, message: progress_callback(0.3 + (progress * 0.6), message)
        ),
        cancel_token=cancel_token,
    )
    raise_if_canceled()
    if progress_callback is not None:
        progress_callback(0.92, "Building subtitle document")
    origin = AiOrigin(engine=asr_result.engine, model=asr_result.model)

    lines = [
        SubtitleLine(
            id=f"line-{index + 1}",
            start_ms=segment.start_ms,
            end_ms=segment.end_ms,
            speaker_id="speaker-unknown",
            source_language=asr_result.language,
            target_language=request.target_language,
            source_text=segment.text,
            translated_text="",
            words=[
                WordTiming(
                    text=word.text,
                    start_ms=word.start_ms,
                    end_ms=word.end_ms,
                    confidence=word.confidence,
                )
                for word in segment.words
            ],
            style_overrides={},
            review_status="draft",
            ai_origin=origin,
            notes="",
        )
        for index, segment in enumerate(asr_result.segments)
    ]

    document = SubtitleDocument(
        project_id=request.project_id,
        media_id=request.media_id,
        duration_ms=request.duration_ms,
        speakers=[default_speaker()],
        styles=[default_style()],
        lines=lines,
    )
    subtitle_path = request.project_dir / "subtitle.diplomat.json"
    subtitle_path.write_text(
        json.dumps(document.model_dump(by_alias=True), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return CorePipelineResult(
        subtitle_document=document,
        subtitle_path=subtitle_path,
        audio_path=audio_path,
    )
