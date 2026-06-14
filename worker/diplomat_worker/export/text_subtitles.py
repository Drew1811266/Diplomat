from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from diplomat_worker.schemas.subtitle import SubtitleDocument, SubtitleLine, SubtitleStyle

SubtitleExportFormat = Literal["srt", "vtt", "ass"]
SubtitleExportMode = Literal["source", "target", "bilingual"]


@dataclass(frozen=True)
class ExportValidationIssue:
    line_id: str
    code: str
    severity: Literal["warning", "error"]
    message: str


class ExportValidationError(ValueError):
    def __init__(self, issues: list[ExportValidationIssue]) -> None:
        super().__init__("Subtitle timing contains blocking export errors")
        self.issues = issues


def format_srt_timestamp(milliseconds: int) -> str:
    if milliseconds < 0:
        raise ValueError("milliseconds must be greater than or equal to 0")

    total_seconds, millis = divmod(milliseconds, 1000)
    total_minutes, seconds = divmod(total_seconds, 60)
    hours, minutes = divmod(total_minutes, 60)

    return f"{hours:02}:{minutes:02}:{seconds:02},{millis:03}"


def format_vtt_timestamp(milliseconds: int) -> str:
    return format_srt_timestamp(milliseconds).replace(",", ".")


def format_ass_timestamp(milliseconds: int) -> str:
    if milliseconds < 0:
        raise ValueError("milliseconds must be greater than or equal to 0")

    total_centiseconds = milliseconds // 10
    total_seconds, centiseconds = divmod(total_centiseconds, 100)
    total_minutes, seconds = divmod(total_seconds, 60)
    hours, minutes = divmod(total_minutes, 60)

    return f"{hours}:{minutes:02}:{seconds:02}.{centiseconds:02}"


def validate_subtitle_document_for_export(
    document: SubtitleDocument,
    *,
    min_duration_ms: int = 300,
    max_chars_per_second: float = 18,
) -> list[ExportValidationIssue]:
    issues: list[ExportValidationIssue] = []

    for line in document.lines:
        duration_ms = line.end_ms - line.start_ms
        if line.start_ms < 0 or line.end_ms < 0:
            issues.append(
                ExportValidationIssue(
                    line_id=line.id,
                    code="negative_time",
                    severity="error",
                    message="Cue contains negative timing.",
                )
            )
        if line.end_ms <= line.start_ms:
            issues.append(
                ExportValidationIssue(
                    line_id=line.id,
                    code="end_before_start",
                    severity="error",
                    message="Cue end time must be after start time.",
                )
            )
            continue
        if duration_ms < min_duration_ms:
            issues.append(
                ExportValidationIssue(
                    line_id=line.id,
                    code="too_short",
                    severity="warning",
                    message=f"Cue is shorter than {min_duration_ms}ms.",
                )
            )

        text_length = _readable_text_length(line)
        chars_per_second = text_length / max(duration_ms / 1000, 0.001)
        if chars_per_second > max_chars_per_second:
            issues.append(
                ExportValidationIssue(
                    line_id=line.id,
                    code="overlong_text",
                    severity="warning",
                    message="Cue may be too dense to read comfortably.",
                )
            )

    sorted_lines = [line for line in sorted_export_lines(document) if line.end_ms > line.start_ms]
    for index in range(1, len(sorted_lines)):
        previous = sorted_lines[index - 1]
        current = sorted_lines[index]
        if current.start_ms < previous.end_ms:
            issues.append(
                ExportValidationIssue(
                    line_id=previous.id,
                    code="overlap_next",
                    severity="error",
                    message="Cue overlaps the next cue.",
                )
            )
            issues.append(
                ExportValidationIssue(
                    line_id=current.id,
                    code="overlap_previous",
                    severity="error",
                    message="Cue overlaps the previous cue.",
                )
            )

    errors = [issue for issue in issues if issue.severity == "error"]
    if errors:
        raise ExportValidationError(errors)
    return issues


def sorted_export_lines(document: SubtitleDocument) -> list[SubtitleLine]:
    return sorted(document.lines, key=lambda line: (line.start_ms, line.end_ms, line.id))


def subtitle_document_to_srt(
    document: SubtitleDocument,
    mode: SubtitleExportMode = "bilingual",
) -> str:
    _assert_export_mode(mode, "SRT")
    blocks: list[str] = []

    for line in sorted_export_lines(document):
        rendered_text = render_line_text(line, mode)
        if not rendered_text:
            continue

        blocks.append(
            "\n".join(
                [
                    str(len(blocks) + 1),
                    f"{format_srt_timestamp(line.start_ms)} --> {format_srt_timestamp(line.end_ms)}",
                    rendered_text,
                ]
            )
        )

    if not blocks:
        return ""

    return "\n\n".join(blocks) + "\n"


def subtitle_document_to_vtt(
    document: SubtitleDocument,
    mode: SubtitleExportMode = "bilingual",
) -> str:
    _assert_export_mode(mode, "subtitle")
    blocks: list[str] = []

    for line in sorted_export_lines(document):
        rendered_text = render_line_text(line, mode)
        if not rendered_text:
            continue

        blocks.append(
            "\n".join(
                [
                    f"{format_vtt_timestamp(line.start_ms)} --> {format_vtt_timestamp(line.end_ms)}",
                    rendered_text,
                ]
            )
        )

    if not blocks:
        return "WEBVTT\n"

    return "WEBVTT\n\n" + "\n\n".join(blocks) + "\n"


def subtitle_document_to_ass(
    document: SubtitleDocument,
    mode: SubtitleExportMode = "bilingual",
    style: SubtitleStyle | None = None,
) -> str:
    _assert_export_mode(mode, "subtitle")
    active_style = style or _default_style(document)
    style_name = _ass_name(active_style.name)
    events: list[str] = []

    for line in sorted_export_lines(document):
        rendered_text = render_line_text(
            line,
            mode,
            bilingual_layout=active_style.bilingual_layout,
            separator="\\N",
        )
        if not rendered_text:
            continue
        events.append(
            ",".join(
                [
                    "Dialogue: 0",
                    format_ass_timestamp(line.start_ms),
                    format_ass_timestamp(line.end_ms),
                    style_name,
                    "",
                    "0000",
                    "0000",
                    f"{active_style.margin_v:04}",
                    "",
                    escape_ass_text(rendered_text),
                ]
            )
        )

    return "\n".join(
        [
            "[Script Info]",
            "ScriptType: v4.00+",
            "WrapStyle: 0",
            "ScaledBorderAndShadow: yes",
            "YCbCr Matrix: TV.709",
            "",
            "[V4+ Styles]",
            (
                "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
                "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, "
                "ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, "
                "MarginL, MarginR, MarginV, Encoding"
            ),
            _ass_style_line(active_style, style_name),
            "",
            "[Events]",
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
            *events,
            "",
        ]
    )


def write_subtitle_export(
    document: SubtitleDocument,
    output_path: Path,
    export_format: SubtitleExportFormat,
    mode: SubtitleExportMode = "bilingual",
    style: SubtitleStyle | None = None,
) -> Path:
    validate_subtitle_document_for_export(document)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if export_format == "srt":
        content = subtitle_document_to_srt(document, mode)
    elif export_format == "vtt":
        content = subtitle_document_to_vtt(document, mode)
    elif export_format == "ass":
        content = subtitle_document_to_ass(document, mode, style=style)
    else:
        raise ValueError(f"Unsupported subtitle export format: {export_format}")

    output_path.write_text(content, encoding="utf-8")
    return output_path


def write_srt_export(
    document: SubtitleDocument,
    output_path: Path,
    mode: SubtitleExportMode = "bilingual",
) -> Path:
    return write_subtitle_export(document, output_path, "srt", mode)


def render_line_text(
    line: SubtitleLine,
    mode: SubtitleExportMode,
    *,
    bilingual_layout: str = "source_top",
    separator: str = "\n",
) -> str:
    source_text = line.source_text.strip()
    target_text = line.translated_text.strip()

    if mode == "source":
        return source_text

    if mode == "target":
        return target_text or source_text

    if mode == "bilingual":
        if not target_text or target_text == source_text:
            return source_text
        if not source_text:
            return target_text
        return separator.join(_ordered_bilingual_text(source_text, target_text, bilingual_layout))

    raise ValueError(f"Unsupported subtitle export mode: {mode}")


def ass_color(css_color: str) -> str:
    normalized = css_color.strip()
    if normalized.startswith("#"):
        normalized = normalized[1:]
    if len(normalized) not in {6, 8}:
        return "&H00000000"
    red = normalized[0:2]
    green = normalized[2:4]
    blue = normalized[4:6]
    return f"&H00{blue.upper()}{green.upper()}{red.upper()}"


def escape_ass_text(text: str) -> str:
    return text.replace("{", "\\{").replace("}", "\\}").replace("\n", "\\N")


def _ordered_bilingual_text(source_text: str, target_text: str, bilingual_layout: str) -> list[str]:
    normalized = bilingual_layout.strip().lower().replace("-", "_")
    if normalized in {"target_top", "target_above_source"}:
        return [target_text, source_text]
    return [source_text, target_text]


def _assert_export_mode(mode: str, label: str) -> None:
    if mode not in {"source", "target", "bilingual"}:
        raise ValueError(f"Unsupported {label} export mode: {mode}")


def _default_style(document: SubtitleDocument) -> SubtitleStyle:
    if document.styles:
        return document.styles[0]
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


def _ass_style_line(style: SubtitleStyle, style_name: str) -> str:
    return ",".join(
        [
            f"Style: {style_name}",
            style.font_family,
            _format_ass_number(style.font_size),
            ass_color(style.primary_color),
            ass_color(style.secondary_color),
            "&H00000000",
            ass_color(style.background_color),
            "0",
            "0",
            "0",
            "0",
            "100",
            "100",
            _format_ass_number((style.line_spacing - 1) * style.font_size),
            "0",
            "4" if style.background_bar else "1",
            _format_ass_number(style.stroke_width),
            _format_ass_number(style.shadow),
            str(_ass_alignment(style)),
            "0020",
            "0020",
            f"{style.margin_v:04}",
            "1",
        ]
    )


def _ass_alignment(style: SubtitleStyle) -> int:
    combined = f"{style.position} {style.alignment}".lower()
    if "left" in combined:
        horizontal = 1
    elif "right" in combined:
        horizontal = 3
    else:
        horizontal = 2

    if "top" in combined:
        return horizontal + 6
    if "middle" in combined or "center" in style.position.lower():
        return horizontal + 3
    return horizontal


def _ass_name(value: str) -> str:
    normalized = value.replace(",", " ").strip()
    return normalized or "Default"


def _format_ass_number(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else f"{value:.2f}".rstrip("0").rstrip(".")


def _readable_text_length(line: SubtitleLine) -> int:
    return f"{line.source_text} {line.translated_text}".strip().__len__()
