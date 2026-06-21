import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from diplomat_worker.asr.base import AsrCanceled, CancelToken, ProgressCallback, Transcriber
from diplomat_worker.asr.chunk_store import (
    build_chunk_manifest,
    chunk_result_path,
    read_chunk_result,
    valid_chunk_result_exists,
    write_chunk_result,
    write_manifest,
)
from diplomat_worker.asr.merge import merge_chunk_results
from diplomat_worker.media.audio import AudioChunk, build_fixed_chunks, extract_audio
from diplomat_worker.pipeline.subtitle_cues import segment_asr_segments_to_cues
from diplomat_worker.schemas.subtitle import AiOrigin, Speaker, SubtitleDocument, SubtitleLine, SubtitleStyle, WordTiming

SegmentationPlanner = Callable[[int], list[AudioChunk]]


@dataclass(frozen=True)
class CorePipelineInput:
    project_id: str
    media_id: str
    source_video: Path
    project_dir: Path
    duration_ms: int
    source_language: str
    target_language: str | None
    task_id: str = "manual"
    resume_from_task_id: str | None = None


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


def asr_task_cache_dir(project_dir: Path, task_id: str) -> Path:
    return project_dir / "cache" / "asr" / task_id


def run_core_pipeline(
    request: CorePipelineInput,
    transcriber: Transcriber,
    extract_audio_fn: Callable[[Path, Path], Path] | None = None,
    ffmpeg_path: str = "ffmpeg",
    progress_callback: ProgressCallback | None = None,
    cancel_token: CancelToken | None = None,
    segmentation_planner: SegmentationPlanner | None = None,
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
        progress_callback(0.25, "Planning ASR chunks")
    chunk_ms = 30_000
    overlap_ms = 500
    chunks = (
        segmentation_planner(request.duration_ms)
        if segmentation_planner is not None
        else build_fixed_chunks(request.duration_ms, chunk_ms=chunk_ms, overlap_ms=overlap_ms)
    )
    task_cache_dir = asr_task_cache_dir(request.project_dir, request.task_id)
    manifest = build_chunk_manifest(
        task_id=request.task_id,
        audio_path=audio_path,
        source_video_path=request.source_video,
        duration_ms=request.duration_ms,
        chunk_ms=chunk_ms,
        overlap_ms=overlap_ms,
        chunks=chunks,
    )
    write_manifest(task_cache_dir / "manifest.json", manifest)

    chunk_documents = []
    resume_cache_dir = (
        asr_task_cache_dir(request.project_dir, request.resume_from_task_id)
        if request.resume_from_task_id is not None
        else None
    )
    total_chunks = len(chunks)
    for position, chunk in enumerate(chunks, start=1):
        record = manifest.chunks[position - 1]
        output_path = chunk_result_path(task_cache_dir, record.chunk_id)
        resume_path = chunk_result_path(resume_cache_dir, record.chunk_id) if resume_cache_dir is not None else None

        if valid_chunk_result_exists(output_path, chunk_id=record.chunk_id):
            chunk_documents.append(read_chunk_result(output_path))
        elif resume_path is not None and valid_chunk_result_exists(resume_path, chunk_id=record.chunk_id):
            output_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(resume_path, output_path)
            chunk_documents.append(read_chunk_result(output_path))
        else:
            raise_if_canceled()
            if progress_callback is not None:
                progress_callback(
                    0.3 + ((position - 1) / max(total_chunks, 1)) * 0.55,
                    f"Transcribing chunk {position} of {total_chunks}",
                )
            chunk_result = transcriber.transcribe(
                audio_path=audio_path,
                chunks=[chunk],
                progress_callback=None,
                cancel_token=cancel_token,
            )
            write_chunk_result(output_path, chunk_id=record.chunk_id, result=chunk_result)
            chunk_documents.append(read_chunk_result(output_path))

        if progress_callback is not None:
            progress_callback(
                0.3 + (position / max(total_chunks, 1)) * 0.55,
                f"Completed chunk {position} of {total_chunks}",
            )

    asr_result = merge_chunk_results(chunk_documents)
    raise_if_canceled()
    if progress_callback is not None:
        progress_callback(0.92, "Building subtitle document")
    origin = AiOrigin(engine=asr_result.engine, model=asr_result.model)

    cues = segment_asr_segments_to_cues(asr_result.segments)
    lines = [
        SubtitleLine(
            id=f"line-{index + 1}",
            start_ms=cue.start_ms,
            end_ms=cue.end_ms,
            speaker_id="speaker-unknown",
            source_language=asr_result.language,
            target_language=request.target_language,
            source_text=cue.text,
            translated_text="",
            words=[
                WordTiming(
                    text=word.text,
                    start_ms=word.start_ms,
                    end_ms=word.end_ms,
                    confidence=word.confidence,
                )
                for word in cue.words
            ],
            style_overrides={},
            review_status="draft",
            ai_origin=origin,
            notes="",
        )
        for index, cue in enumerate(cues)
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
