from pathlib import Path
from typing import Literal

from diplomat_worker.schemas.subtitle import SubtitleDocument, SubtitleLine

SrtMode = Literal["source", "target", "bilingual"]


def format_srt_timestamp(milliseconds: int) -> str:
    if milliseconds < 0:
        raise ValueError("milliseconds must be greater than or equal to 0")

    total_seconds, millis = divmod(milliseconds, 1000)
    total_minutes, seconds = divmod(total_seconds, 60)
    hours, minutes = divmod(total_minutes, 60)

    return f"{hours:02}:{minutes:02}:{seconds:02},{millis:03}"


def subtitle_document_to_srt(document: SubtitleDocument, mode: SrtMode = "bilingual") -> str:
    blocks: list[str] = []
    sorted_lines = sorted(document.lines, key=lambda line: (line.start_ms, line.end_ms, line.id))

    for line in sorted_lines:
        rendered_text = _render_line_text(line, mode)
        if not rendered_text:
            continue

        block_number = len(blocks) + 1
        blocks.append(
            "\n".join(
                [
                    str(block_number),
                    f"{format_srt_timestamp(line.start_ms)} --> {format_srt_timestamp(line.end_ms)}",
                    rendered_text,
                ]
            )
        )

    if not blocks:
        return ""

    return "\n\n".join(blocks) + "\n"


def write_srt_export(
    document: SubtitleDocument,
    output_path: Path,
    mode: SrtMode = "bilingual",
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(subtitle_document_to_srt(document, mode), encoding="utf-8")
    return output_path


def _render_line_text(line: SubtitleLine, mode: SrtMode) -> str:
    source_text = line.source_text.strip()
    target_text = line.translated_text.strip()

    if mode == "source":
        return source_text

    if mode == "target":
        return target_text or source_text

    if target_text and target_text != source_text:
        return "\n".join([source_text, target_text]) if source_text else target_text

    return source_text
