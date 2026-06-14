from pathlib import Path

import pytest

from diplomat_worker.export.burn_in import (
    BurnInExportSettings,
    build_burn_in_command,
    escape_subtitles_filter_path,
    parse_ffmpeg_progress_line,
    resolve_burn_in_output_path,
    validate_burn_in_output,
    write_burn_in_ass,
)
from worker.tests.export.test_text_subtitles import make_document


def test_resolve_burn_in_output_path_defaults_inside_exports(tmp_path: Path) -> None:
    project_dir = tmp_path / "project"
    source = tmp_path / "source.mp4"

    output = resolve_burn_in_output_path(project_dir, source, None, "bilingual", "task-1")

    assert output == project_dir / "exports" / "burn-in-bilingual-task-1.mp4"


def test_resolve_burn_in_output_path_rejects_source_overwrite(tmp_path: Path) -> None:
    project_dir = tmp_path / "project"
    source = tmp_path / "source.mp4"

    with pytest.raises(ValueError, match="source video"):
        resolve_burn_in_output_path(project_dir, source, source, "bilingual", "task-1")


def test_resolve_burn_in_output_path_rejects_external_path(tmp_path: Path) -> None:
    project_dir = tmp_path / "project"
    source = tmp_path / "source.mp4"
    external = tmp_path / "outside.mp4"

    with pytest.raises(ValueError, match="exports directory"):
        resolve_burn_in_output_path(project_dir, source, external, "bilingual", "task-1")


def test_escape_subtitles_filter_path_handles_windows_path() -> None:
    escaped = escape_subtitles_filter_path(Path("D:/Diplomat Project/cache/burn'in.ass"))

    assert "D\\:" in escaped
    assert "\\'" in escaped
    assert "Diplomat Project" in escaped


def test_build_burn_in_command_uses_list_args_and_progress(tmp_path: Path) -> None:
    command = build_burn_in_command(
        ffmpeg_path="ffmpeg",
        source_video=tmp_path / "source.mp4",
        ass_path=tmp_path / "cache" / "burn-in.ass",
        output_path=tmp_path / "project" / "exports" / "out.mp4",
        settings=BurnInExportSettings(),
    )

    assert command[0] == "ffmpeg"
    assert "-progress" in command
    assert "pipe:1" in command
    assert any(arg.startswith("subtitles='") for arg in command)
    assert command[-1].endswith("out.mp4")


def test_parse_ffmpeg_progress_line_bounds_output_time() -> None:
    assert parse_ffmpeg_progress_line("out_time_ms=500000", 1000) == 0.5
    assert parse_ffmpeg_progress_line("out_time_ms=1500000", 1000) == 1
    assert parse_ffmpeg_progress_line("progress=continue", 1000) is None


def test_write_burn_in_ass_uses_subtitle_export_engine(tmp_path: Path) -> None:
    ass_path = tmp_path / "cache" / "burn-in.ass"

    write_burn_in_ass(make_document(), ass_path, "bilingual", None)

    content = ass_path.read_text(encoding="utf-8")
    assert "[V4+ Styles]" in content
    assert "你好\\NHello" in content


def test_validate_burn_in_output_rejects_empty_file(tmp_path: Path) -> None:
    output = tmp_path / "empty.mp4"
    output.write_bytes(b"")

    with pytest.raises(ValueError, match="empty"):
        validate_burn_in_output(output)


def test_validate_burn_in_output_accepts_non_empty_file(tmp_path: Path) -> None:
    output = tmp_path / "video.mp4"
    output.write_bytes(b"video")

    validate_burn_in_output(output)
