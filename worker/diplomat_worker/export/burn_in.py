import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from diplomat_worker.export.text_subtitles import (
    SubtitleExportMode,
    subtitle_document_to_ass,
)
from diplomat_worker.schemas.subtitle import SubtitleDocument, SubtitleStyle
from diplomat_worker.tasks.analysis import ThreadCancelToken


class BurnInExportCanceled(RuntimeError):
    pass


@dataclass(frozen=True)
class BurnInExportSettings:
    video_codec: str = "libx264"
    crf: int = 18
    preset: str = "medium"


ProgressCallback = Callable[[float, str], None]


def resolve_burn_in_output_path(
    project_dir: Path,
    source_video: Path,
    requested_output_path: Path | str | None,
    mode: SubtitleExportMode,
    task_id: str,
) -> Path:
    exports_dir = project_dir / "exports"
    output_path = (
        Path(requested_output_path)
        if requested_output_path is not None
        else exports_dir / f"burn-in-{mode}-{task_id}.mp4"
    )

    resolved_source = source_video.resolve()
    resolved_project_dir = project_dir.resolve()
    resolved_exports_dir = exports_dir.resolve()
    resolved_output = output_path.resolve()

    if resolved_output == resolved_source:
        raise ValueError("Refusing to overwrite the source video")
    if resolved_output in {resolved_project_dir, resolved_exports_dir}:
        raise ValueError("Burn-in output path must be a file inside the exports directory")
    if not _is_relative_to(resolved_output, resolved_exports_dir):
        raise ValueError("Burn-in output path must stay inside the project exports directory")

    return output_path


def escape_subtitles_filter_path(path: Path) -> str:
    normalized = str(path).replace("\\", "/")
    return (
        normalized.replace("\\", "\\\\")
        .replace(":", "\\:")
        .replace("'", "\\'")
        .replace("[", "\\[")
        .replace("]", "\\]")
        .replace(",", "\\,")
    )


def build_burn_in_command(
    *,
    ffmpeg_path: str,
    source_video: Path,
    ass_path: Path,
    output_path: Path,
    settings: BurnInExportSettings,
) -> list[str]:
    return [
        ffmpeg_path,
        "-y",
        "-hide_banner",
        "-v",
        "error",
        "-i",
        str(source_video),
        "-vf",
        f"subtitles='{escape_subtitles_filter_path(ass_path)}'",
        "-c:v",
        settings.video_codec,
        "-crf",
        str(settings.crf),
        "-preset",
        settings.preset,
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        "-progress",
        "pipe:1",
        "-nostats",
        str(output_path),
    ]


def parse_ffmpeg_progress_line(line: str, duration_ms: int) -> float | None:
    key, separator, value = line.strip().partition("=")
    if separator != "=" or key != "out_time_ms":
        return None
    if duration_ms <= 0:
        return None
    try:
        elapsed_microseconds = int(value)
    except ValueError:
        return None
    elapsed_ms = elapsed_microseconds / 1000
    return max(0, min(elapsed_ms / duration_ms, 1))


def write_burn_in_ass(
    document: SubtitleDocument,
    ass_path: Path,
    mode: SubtitleExportMode,
    style: SubtitleStyle | None,
) -> Path:
    ass_path.parent.mkdir(parents=True, exist_ok=True)
    ass_path.write_text(
        subtitle_document_to_ass(document, mode=mode, style=style),
        encoding="utf-8",
    )
    return ass_path


def validate_burn_in_output(output_path: Path) -> Path:
    if not output_path.is_file():
        raise ValueError(f"Burn-in output was not created: {output_path}")
    if output_path.stat().st_size <= 0:
        raise ValueError(f"Burn-in output is empty: {output_path}")
    return output_path


def run_burn_in_export(
    *,
    ffmpeg_path: str,
    source_video: Path,
    ass_path: Path,
    output_path: Path,
    duration_ms: int,
    settings: BurnInExportSettings,
    cancel_token: ThreadCancelToken,
    progress_callback: ProgressCallback | None = None,
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    command = build_burn_in_command(
        ffmpeg_path=ffmpeg_path,
        source_video=source_video,
        ass_path=ass_path,
        output_path=output_path,
        settings=settings,
    )
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    try:
        assert process.stdout is not None
        for line in process.stdout:
            if cancel_token.is_cancel_requested():
                _terminate_process(process)
                raise BurnInExportCanceled("Burn-in export canceled")
            parsed_progress = parse_ffmpeg_progress_line(line, duration_ms)
            if parsed_progress is not None and progress_callback is not None:
                progress_callback(0.2 + parsed_progress * 0.75, "Rendering video")

        return_code = process.wait()
        if cancel_token.is_cancel_requested():
            _terminate_process(process)
            raise BurnInExportCanceled("Burn-in export canceled")
        if return_code != 0:
            stderr = process.stderr.read() if process.stderr is not None else ""
            raise subprocess.CalledProcessError(return_code, command, stderr=stderr)
    finally:
        if process.stdout is not None:
            process.stdout.close()
        if process.stderr is not None:
            process.stderr.close()

    return validate_burn_in_output(output_path)


def _terminate_process(process: subprocess.Popen[str]) -> None:
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def _is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False
