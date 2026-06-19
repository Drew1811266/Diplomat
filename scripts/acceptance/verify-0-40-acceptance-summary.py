from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


MIN_ACCEPTANCE_DURATION_MS = 3 * 60 * 60 * 1000
SCHEMA_VERSION = "diplomat.0-40-acceptance.v1"
ASR_MODEL_ID = "asr.microsoft.vibevoice-asr"
TRANSLATION_MODEL_ID = "translation.tencent.hunyuan-mt-7b-fp8"


def main() -> int:
    args = parse_args()
    errors = verify_summary(args.summary)
    if errors:
        print("0.40 acceptance summary verification failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"0.40 acceptance summary verified: {args.summary}")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify that a Diplomat 0.40 acceptance summary proves the final three-hour gate."
    )
    parser.add_argument("--summary", required=True, type=Path, help="Path to acceptance-summary.json.")
    return parser.parse_args()


def verify_summary(summary_path: Path) -> list[str]:
    errors: list[str] = []
    if not summary_path.is_file():
        return [f"summary file does not exist: {summary_path}"]

    try:
        payload = json.loads(summary_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f"summary file is not valid JSON: {exc}"]

    if not isinstance(payload, dict):
        return ["summary root must be a JSON object."]

    expect_equal(payload.get("schemaVersion"), SCHEMA_VERSION, "schemaVersion", errors)
    expect_equal(payload.get("status"), "passed", "status", errors)
    expect_equal(payload.get("preflightOnly"), False, "preflightOnly", errors)
    expect_existing_file(payload.get("sourceVideo"), "sourceVideo", errors)
    expect_existing_dir(payload.get("evidenceDir"), "evidenceDir", errors)

    video_probe = expect_dict(payload.get("videoProbe"), "videoProbe", errors)
    source_duration_ms = verify_video_probe(video_probe, errors)
    verify_preflight_check(payload.get("checks"), errors)
    verify_development_models(payload.get("developmentModels"), errors)
    verify_glossary(payload.get("glossary"), errors)

    analysis_task = expect_dict(payload.get("analysisTask"), "analysisTask", errors)
    translation_task = expect_dict(payload.get("translationTask"), "translationTask", errors)
    analysis_task_id = verify_task(analysis_task, "analysisTask", expected_type="analysis", errors=errors)
    verify_task(translation_task, "translationTask", expected_type="translation", errors=errors)

    runtime_cleanup = expect_dict(payload.get("runtimeCleanup"), "runtimeCleanup", errors)
    verify_runtime_cleanup(runtime_cleanup.get("analysis"), "runtimeCleanup.analysis", errors)
    verify_runtime_cleanup(runtime_cleanup.get("translation"), "runtimeCleanup.translation", errors)

    verify_asr_chunks(payload.get("asrChunks"), analysis_task_id, source_duration_ms, errors)
    verify_subtitle(payload.get("subtitle"), errors)
    return errors


def verify_video_probe(video_probe: dict[str, Any], errors: list[str]) -> int | None:
    duration_ms = expect_int(video_probe.get("durationMs"), "videoProbe.durationMs", errors)
    minimum_duration_ms = expect_int(video_probe.get("minimumDurationMs"), "videoProbe.minimumDurationMs", errors)

    if duration_ms is not None and duration_ms < MIN_ACCEPTANCE_DURATION_MS:
        errors.append("videoProbe.durationMs must be at least three hours.")
    if minimum_duration_ms is not None and minimum_duration_ms != MIN_ACCEPTANCE_DURATION_MS:
        errors.append("videoProbe.minimumDurationMs must equal the 0.40 three-hour minimum.")
    if video_probe.get("hasAudio") is not True:
        errors.append("videoProbe.hasAudio must be true.")
    if not non_empty_string(video_probe.get("audioCodec")):
        errors.append("videoProbe.audioCodec must be present.")
    if not non_empty_string(video_probe.get("videoCodec")):
        errors.append("videoProbe.videoCodec must be present.")

    return duration_ms


def verify_preflight_check(checks: Any, errors: list[str]) -> None:
    if not isinstance(checks, list):
        errors.append("checks must be a list.")
        return

    preflight = next((item for item in checks if isinstance(item, dict) and item.get("id") == "preflight"), None)
    if preflight is None:
        errors.append("checks must include a preflight check.")
        return
    if preflight.get("status") != "passed":
        errors.append("preflight check status must be passed.")


def verify_development_models(models: Any, errors: list[str]) -> None:
    model_paths = expect_dict(models, "developmentModels", errors)
    for model_id in [ASR_MODEL_ID, TRANSLATION_MODEL_ID]:
        model_path = model_paths.get(model_id)
        expect_existing_dir(model_path, f"developmentModels.{model_id}", errors)


def verify_glossary(glossary: Any, errors: list[str]) -> None:
    payload = expect_dict(glossary, "glossary", errors)
    term_count = expect_int(payload.get("termCount"), "glossary.termCount", errors)
    if term_count is not None and term_count < 0:
        errors.append("glossary.termCount must be non-negative.")
    glossary_path = payload.get("path")
    if glossary_path is not None:
        expect_existing_file(glossary_path, "glossary.path", errors)


def verify_task(
    task: dict[str, Any],
    label: str,
    *,
    expected_type: str,
    errors: list[str],
) -> str | None:
    task_id = task.get("taskId")
    if not non_empty_string(task_id):
        errors.append(f"{label}.taskId must be present.")
    if task.get("type") != expected_type:
        errors.append(f"{label}.type must be {expected_type}.")
    if task.get("status") != "completed":
        errors.append(f"{label}.status must be completed.")
    progress = expect_number(task.get("progress"), f"{label}.progress", errors)
    if progress is not None and progress < 1:
        errors.append(f"{label}.progress must be complete.")
    if task.get("errorCode") is not None:
        errors.append(f"{label}.errorCode must be null.")
    if task.get("errorMessage") is not None:
        errors.append(f"{label}.errorMessage must be null.")
    expect_existing_file(task.get("diagnosticLogPath"), f"{label}.diagnosticLogPath", errors)
    return task_id if isinstance(task_id, str) else None


def verify_runtime_cleanup(cleanup: Any, label: str, errors: list[str]) -> None:
    payload = expect_dict(cleanup, label, errors)
    if payload.get("closed") is not True:
        errors.append(f"{label}.closed must be true.")
    if payload.get("acceleratorCacheCleared") is not True:
        errors.append(f"{label}.acceleratorCacheCleared must be true.")
    expect_existing_file(payload.get("logPath"), f"{label}.logPath", errors)
    messages = payload.get("messages")
    if not isinstance(messages, list) or "Closed runtime resource." not in messages:
        errors.append(f"{label}.messages must include runtime close evidence.")
    if not isinstance(messages, list) or "Cleared CUDA accelerator cache." not in messages:
        errors.append(f"{label}.messages must include CUDA cache cleanup evidence.")


def verify_asr_chunks(
    chunks: Any,
    analysis_task_id: str | None,
    source_duration_ms: int | None,
    errors: list[str],
) -> None:
    payload = expect_dict(chunks, "asrChunks", errors)
    if analysis_task_id is not None and payload.get("taskId") != analysis_task_id:
        errors.append("asrChunks.taskId must match analysisTask.taskId.")
    expect_existing_file(payload.get("manifestPath"), "asrChunks.manifestPath", errors)

    chunk_count = expect_int(payload.get("chunkCount"), "asrChunks.chunkCount", errors)
    completed_count = expect_int(
        payload.get("completedChunkCount"), "asrChunks.completedChunkCount", errors
    )
    duration_ms = expect_int(payload.get("durationMs"), "asrChunks.durationMs", errors)
    first_start_ms = expect_int(payload.get("firstChunkStartMs"), "asrChunks.firstChunkStartMs", errors)
    last_end_ms = expect_int(payload.get("lastChunkEndMs"), "asrChunks.lastChunkEndMs", errors)

    if chunk_count is not None and chunk_count <= 0:
        errors.append("asrChunks.chunkCount must be greater than 0.")
    if chunk_count is not None and completed_count is not None and completed_count != chunk_count:
        errors.append("asrChunks.completedChunkCount must equal chunkCount.")
    if source_duration_ms is not None and duration_ms is not None and duration_ms != source_duration_ms:
        errors.append("asrChunks.durationMs must match the source duration.")
    if first_start_ms is not None and first_start_ms != 0:
        errors.append("asrChunks.firstChunkStartMs must be 0.")
    if source_duration_ms is not None and last_end_ms is not None and last_end_ms != source_duration_ms:
        errors.append("asrChunks.lastChunkEndMs must cover the source duration.")


def verify_subtitle(subtitle: Any, errors: list[str]) -> None:
    payload = expect_dict(subtitle, "subtitle", errors)
    line_count = expect_int(payload.get("lineCount"), "subtitle.lineCount", errors)
    source_line_count = expect_int(payload.get("sourceLineCount"), "subtitle.sourceLineCount", errors)
    translated_line_count = expect_int(
        payload.get("translatedLineCount"), "subtitle.translatedLineCount", errors
    )

    if line_count is not None and line_count <= 0:
        errors.append("subtitle.lineCount must be greater than 0.")
    if source_line_count is not None and source_line_count <= 0:
        errors.append("subtitle.sourceLineCount must be greater than 0.")
    if (
        source_line_count is not None
        and translated_line_count is not None
        and translated_line_count != source_line_count
    ):
        errors.append("subtitle.translatedLineCount must equal sourceLineCount.")

    for field in [
        "blankSourceLineCount",
        "missingTranslationCount",
        "failedTranslationCount",
        "incompleteTranslationStatusCount",
        "timingIssueCount",
        "translationQualityIssueCount",
    ]:
        value = expect_int(payload.get(field), f"subtitle.{field}", errors)
        if value is not None and value != 0:
            errors.append(f"subtitle.{field} must be 0.")

    expect_existing_file(payload.get("path"), "subtitle.path", errors)


def expect_equal(actual: Any, expected: Any, label: str, errors: list[str]) -> None:
    if actual != expected:
        expected_text = expected if isinstance(expected, str) else json.dumps(expected)
        errors.append(f"{label} must be {expected_text}.")


def expect_dict(value: Any, label: str, errors: list[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        errors.append(f"{label} must be an object.")
        return {}
    return value


def expect_int(value: Any, label: str, errors: list[str]) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int):
        errors.append(f"{label} must be an integer.")
        return None
    return value


def expect_number(value: Any, label: str, errors: list[str]) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        errors.append(f"{label} must be a number.")
        return None
    return float(value)


def expect_existing_file(value: Any, label: str, errors: list[str]) -> None:
    if not non_empty_string(value):
        errors.append(f"{label} must be present.")
        return
    if not Path(value).is_file():
        errors.append(f"{label} must point to an existing file.")


def expect_existing_dir(value: Any, label: str, errors: list[str]) -> None:
    if not non_empty_string(value):
        errors.append(f"{label} must be present.")
        return
    if not Path(value).is_dir():
        errors.append(f"{label} must point to an existing directory.")


def non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


if __name__ == "__main__":
    raise SystemExit(main())
