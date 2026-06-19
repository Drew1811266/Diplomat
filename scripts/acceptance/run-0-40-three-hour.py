from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKER_ROOT = ROOT / "worker"
if str(WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKER_ROOT))

from diplomat_worker.api.runtime import WorkerRuntime  # noqa: E402
from diplomat_worker.asr.chunk_store import (  # noqa: E402
    MANIFEST_SCHEMA_VERSION,
    chunk_result_path,
    read_manifest,
    valid_chunk_result_exists,
)
from diplomat_worker.asr.config import AsrModelConfig  # noqa: E402
from diplomat_worker.export.text_subtitles import (  # noqa: E402
    validate_subtitle_document_for_export,
    write_subtitle_export,
)
from diplomat_worker.media.ffmpeg import probe_video  # noqa: E402
from diplomat_worker.models.dev_manifests import (  # noqa: E402
    development_readiness,
    get_development_manifest,
)
from diplomat_worker.models.capabilities import detect_runtime_capabilities  # noqa: E402
from diplomat_worker.models.registry import built_in_model_registry  # noqa: E402
from diplomat_worker.storage.project_store import ProjectStore  # noqa: E402
from diplomat_worker.tasks.analysis import AnalysisJobManager  # noqa: E402
from diplomat_worker.tasks.translation import TranslationJobManager  # noqa: E402
from diplomat_worker.schemas.subtitle import TranslationGlossaryEntry  # noqa: E402
from diplomat_worker.translation.config import TranslationProviderConfig  # noqa: E402

RELEASE_MIN_ACCEPTANCE_DURATION_MS = 2 * 60 * 60 * 1000
SMOKE_MIN_ACCEPTANCE_DURATION_MS = 5 * 60 * 1000


def main() -> int:
    args = parse_args()
    source_video = args.source_video.resolve()
    evidence_dir = args.evidence_dir.resolve()
    evidence_dir.mkdir(parents=True, exist_ok=True)
    summary_path = evidence_dir / "acceptance-summary.json"

    started_at = datetime.now(UTC).isoformat()
    minimum_duration_ms = minimum_duration_for_profile(args.acceptance_profile)
    summary: dict = {
        "schemaVersion": "diplomat.0-40-acceptance.v1",
        "acceptanceProfile": args.acceptance_profile,
        "startedAt": started_at,
        "sourceVideo": str(source_video),
        "evidenceDir": str(evidence_dir),
        "preflightOnly": args.preflight_only,
        "status": "running",
        "checks": [],
    }

    try:
        if not source_video.is_file():
            raise AcceptanceError(f"Source video does not exist: {source_video}")

        probe = probe_video(source_video, ffprobe_path=args.ffprobe_path)
        summary["videoProbe"] = {
            "durationMs": probe.duration_ms,
            "minimumDurationMs": minimum_duration_ms,
            "hasAudio": probe.has_audio,
            "audioCodec": probe.audio_codec,
            "videoCodec": probe.video_codec,
        }
        if probe.duration_ms < minimum_duration_ms:
            raise AcceptanceError(
                f"Source video is shorter than {profile_duration_label(args.acceptance_profile)}: {probe.duration_ms} ms."
            )
        if not probe.has_audio:
            raise AcceptanceError("Source video has no audio stream.")
        if probe.video_codec is None:
            raise AcceptanceError("Source video has no video stream.")

        preflight = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "acceptance" / "check-0-40-readiness.py")],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        summary["checks"].append(
            {
                "id": "preflight",
                "status": "passed" if preflight.returncode == 0 else "failed",
                "stdout": preflight.stdout,
                "stderr": preflight.stderr,
            }
        )
        if preflight.returncode != 0:
            raise AcceptanceError("0.40 preflight failed. See preflight output in acceptance summary.")

        model_paths = resolve_development_model_paths(
            ROOT,
            [args.asr_model_id, args.translation_model_id],
        )
        summary["developmentModels"] = model_paths
        glossary = load_acceptance_glossary(args.glossary_path)
        summary["glossary"] = {
            "path": str(args.glossary_path.resolve()) if args.glossary_path else None,
            "termCount": len(glossary),
        }
        if args.preflight_only:
            summary["status"] = "preflight-passed"
            summary["completedAt"] = datetime.now(UTC).isoformat()
            write_summary(summary_path, summary)
            print(f"0.40 acceptance preflight passed. Summary: {summary_path}")
            return 0

        data_dir = evidence_dir / "worker-data"
        runtime = WorkerRuntime(
            store=ProjectStore(data_dir / "diplomat.db"),
            transcriber=None,
            ffmpeg_path=args.ffmpeg_path,
            ffprobe_path=args.ffprobe_path,
            model_registry=built_in_model_registry(),
            runtime_capabilities=detect_runtime_capabilities(),
            development_model_root=ROOT,
            allow_unmanaged_asr_models=True,
            allow_unmanaged_translation_models=True,
        )
        project = runtime.store.create_project(
            name=f"0.40 {args.acceptance_profile} acceptance",
            source_video_path=source_video,
            duration_ms=probe.duration_ms,
            source_language=args.source_language,
            target_language=args.target_language,
        )
        summary["project"] = {
            "projectId": project.project_id,
            "projectDir": str(project.project_dir),
        }

        analysis = AnalysisJobManager(runtime, auto_start=False)
        analysis_task = analysis.create_analysis_job(
            project.project_id,
            AsrModelConfig(
                provider=args.asr_provider,
                model_id=args.asr_model_id,
                model_name_or_path=model_paths[args.asr_model_id],
                device=args.asr_device,
                compute_type=args.asr_compute_type,
                source_language=args.source_language,
            ),
        )
        analysis.run_pending_once()
        analysis_result = runtime.store.get_task(analysis_task.task_id)
        summary["analysisTask"] = task_summary(analysis_result)
        if analysis_result.status != "completed":
            raise AcceptanceError(f"Analysis task did not complete: {analysis_result.status}")
        summary.setdefault("runtimeCleanup", {})["analysis"] = collect_runtime_cleanup_evidence(
            summary["analysisTask"],
            label="analysis",
            require_cuda_cache=args.asr_device.lower() == "cuda",
        )
        summary["asrChunks"] = validate_asr_chunk_evidence(
            project.project_dir,
            summary["analysisTask"],
            duration_ms=probe.duration_ms,
        )

        translation = TranslationJobManager(runtime, auto_start=False)
        translation_task = translation.create_translation_job(
            project.project_id,
            source_language=args.source_language,
            target_language=args.target_language,
            mode="missing_only",
            provider_config=TranslationProviderConfig(
                provider=args.translation_provider,
                model_id=args.translation_model_id,
                model_name_or_path=model_paths[args.translation_model_id],
                device=args.translation_device,
                compute_type=args.translation_compute_type,
                batch_size=args.translation_batch_size,
            ),
            glossary=glossary,
        )
        translation.run_pending_once()
        translation_result = runtime.store.get_task(translation_task.task_id)
        summary["translationTask"] = task_summary(translation_result)
        if translation_result.status != "completed":
            raise AcceptanceError(f"Translation task did not complete: {translation_result.status}")
        summary.setdefault("runtimeCleanup", {})["translation"] = collect_runtime_cleanup_evidence(
            summary["translationTask"],
            label="translation",
            require_cuda_cache=args.translation_device.lower() == "cuda",
        )

        document = runtime.store.load_subtitle_document(project.project_id)
        summary["subtitle"] = validate_subtitle_acceptance(
            document,
            subtitle_path=project.project_dir / "subtitle.diplomat.json",
        )
        summary["exports"] = write_acceptance_export_artifacts(
            document,
            project_dir=project.project_dir,
        )

        summary["status"] = "passed"
        summary["completedAt"] = datetime.now(UTC).isoformat()
        write_summary(summary_path, summary)
        print(f"0.40 acceptance passed. Summary: {summary_path}")
        return 0
    except Exception as exc:
        summary["status"] = "failed"
        summary["error"] = str(exc)
        summary["completedAt"] = datetime.now(UTC).isoformat()
        write_summary(summary_path, summary)
        print(f"0.40 acceptance failed: {exc}", file=sys.stderr)
        print(f"Summary: {summary_path}", file=sys.stderr)
        return 1


class AcceptanceError(RuntimeError):
    pass


def minimum_duration_for_profile(profile: str) -> int:
    if profile == "smoke":
        return SMOKE_MIN_ACCEPTANCE_DURATION_MS
    return RELEASE_MIN_ACCEPTANCE_DURATION_MS


def profile_duration_label(profile: str) -> str:
    if profile == "smoke":
        return "five minutes"
    return "two hours"


def resolve_development_model_paths(root: Path, model_ids: list[str]) -> dict[str, str]:
    paths: dict[str, str] = {}
    for model_id in model_ids:
        manifest = get_development_manifest(model_id, root=root)
        readiness = development_readiness(manifest, root)
        if not readiness.usable:
            raise AcceptanceError(f"{model_id}: {readiness.reason}")
        paths[model_id] = str((root / manifest.development_path).resolve())
    return paths


def collect_runtime_cleanup_evidence(
    task: dict,
    *,
    label: str,
    require_cuda_cache: bool,
) -> dict:
    log_path_value = task.get("diagnosticLogPath")
    if not log_path_value:
        raise AcceptanceError(f"{label} task did not record a diagnostic log path.")

    log_path = Path(log_path_value)
    if not log_path.is_file():
        raise AcceptanceError(f"{label} diagnostic log does not exist: {log_path}")

    messages = []
    for line in log_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("Runtime cleanup: "):
            messages.append(line.removeprefix("Runtime cleanup: "))

    closed = "Closed runtime resource." in messages
    accelerator_cache_cleared = "Cleared CUDA accelerator cache." in messages

    if not closed:
        raise AcceptanceError(f"{label} did not close runtime resource.")
    if require_cuda_cache and not accelerator_cache_cleared:
        raise AcceptanceError(f"{label} did not clear CUDA accelerator cache.")

    return {
        "label": label,
        "logPath": str(log_path),
        "closed": closed,
        "acceleratorCacheCleared": accelerator_cache_cleared,
        "messages": messages,
    }


def load_acceptance_glossary(path: Path | None) -> list[dict]:
    if path is None:
        return []
    if not path.is_file():
        raise AcceptanceError(f"Glossary file does not exist: {path}")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise AcceptanceError(f"Glossary file is not valid JSON: {exc}") from exc
    if not isinstance(payload, list):
        raise AcceptanceError("Glossary file must contain a JSON array.")
    try:
        return [
            TranslationGlossaryEntry.model_validate(entry).model_dump(by_alias=True)
            for entry in payload
        ]
    except Exception as exc:
        raise AcceptanceError(f"Glossary file contains an invalid term: {exc}") from exc


def validate_asr_chunk_evidence(project_dir: Path, task: dict, *, duration_ms: int) -> dict:
    task_id = task.get("taskId")
    if not task_id:
        raise AcceptanceError("Analysis task summary did not include a task id.")

    task_cache_dir = project_dir / "cache" / "asr" / task_id
    manifest_path = task_cache_dir / "manifest.json"
    if not manifest_path.is_file():
        raise AcceptanceError(f"ASR chunk manifest does not exist: {manifest_path}")

    try:
        manifest = read_manifest(manifest_path)
    except Exception as exc:
        raise AcceptanceError(f"ASR chunk manifest is unreadable: {exc}") from exc

    if manifest.schema_version != MANIFEST_SCHEMA_VERSION:
        raise AcceptanceError(f"Unsupported ASR chunk manifest schema: {manifest.schema_version}")
    if manifest.task_id != task_id:
        raise AcceptanceError("ASR chunk manifest task id does not match analysis task.")
    if manifest.duration_ms != duration_ms:
        raise AcceptanceError(
            f"ASR chunk manifest duration {manifest.duration_ms} ms does not match source duration {duration_ms} ms."
        )
    if not manifest.chunks:
        raise AcceptanceError("ASR chunk manifest contains no chunks.")

    timing_errors = 0
    previous_end_ms = 0
    missing_results: list[str] = []
    for position, chunk in enumerate(manifest.chunks):
        if chunk.index != position:
            timing_errors += 1
        if chunk.start_ms < 0 or chunk.end_ms <= chunk.start_ms or chunk.end_ms > duration_ms:
            timing_errors += 1
        if position == 0 and chunk.start_ms != 0:
            timing_errors += 1
        if position > 0 and chunk.start_ms > previous_end_ms:
            timing_errors += 1
        previous_end_ms = max(previous_end_ms, chunk.end_ms)

        if not valid_chunk_result_exists(
            chunk_result_path(task_cache_dir, chunk.chunk_id),
            chunk_id=chunk.chunk_id,
        ):
            missing_results.append(chunk.chunk_id)

    last_chunk_end_ms = manifest.chunks[-1].end_ms
    if last_chunk_end_ms != duration_ms:
        timing_errors += 1
    if timing_errors:
        raise AcceptanceError(f"ASR chunk manifest has {timing_errors} timing issue.")
    if missing_results:
        raise AcceptanceError(
            "ASR chunk evidence is missing ASR chunk result files: "
            + ", ".join(missing_results)
            + "."
        )

    return {
        "taskId": task_id,
        "manifestPath": str(manifest_path),
        "chunkCount": len(manifest.chunks),
        "completedChunkCount": len(manifest.chunks),
        "durationMs": manifest.duration_ms,
        "chunkMs": manifest.chunk_ms,
        "overlapMs": manifest.overlap_ms,
        "firstChunkStartMs": manifest.chunks[0].start_ms,
        "lastChunkEndMs": last_chunk_end_ms,
    }


def validate_subtitle_acceptance(document, *, subtitle_path: Path) -> dict:
    lines = document.lines
    source_lines = [line for line in lines if line.source_text.strip()]
    blank_source_line_count = len(lines) - len(source_lines)
    missing_translation_count = sum(1 for line in source_lines if not line.translated_text.strip())
    failed_translation_count = sum(
        1
        for line in source_lines
        if line.translation_status == "failed" or bool(line.translation_error)
    )
    incomplete_translation_status_count = sum(
        1
        for line in source_lines
        if line.translation_status not in {"translated", "edited"}
    )
    timing_issue_count = count_subtitle_timing_issues(lines, document.duration_ms)
    translation_quality_issue_count = sum(len(line.translation_quality_issues) for line in lines)

    summary = {
        "lineCount": len(lines),
        "sourceLineCount": len(source_lines),
        "translatedLineCount": sum(1 for line in source_lines if line.translated_text.strip()),
        "blankSourceLineCount": blank_source_line_count,
        "missingTranslationCount": missing_translation_count,
        "failedTranslationCount": failed_translation_count,
        "incompleteTranslationStatusCount": incomplete_translation_status_count,
        "timingIssueCount": timing_issue_count,
        "translationQualityIssueCount": translation_quality_issue_count,
        "path": str(subtitle_path),
    }

    failures: list[str] = []
    if summary["lineCount"] == 0:
        failures.append("ASR produced no subtitle lines")
    if blank_source_line_count:
        failures.append(f"{blank_source_line_count} blank source line")
    if missing_translation_count:
        failures.append(f"{missing_translation_count} missing translation")
    if failed_translation_count:
        failures.append(f"{failed_translation_count} failed translation")
    if incomplete_translation_status_count:
        failures.append(f"{incomplete_translation_status_count} incomplete translation status")
    if timing_issue_count:
        failures.append(f"{timing_issue_count} timing issue")
    if translation_quality_issue_count:
        failures.append(f"{translation_quality_issue_count} translation quality issue")

    if failures:
        raise AcceptanceError(f"Subtitle acceptance failed: {', '.join(failures)}.")

    return summary


def write_acceptance_export_artifacts(document, *, project_dir: Path) -> dict:
    export_warnings = validate_subtitle_document_for_export(document)
    exports_dir = project_dir / "exports" / "0-40-acceptance"
    artifacts: list[dict] = []
    for export_format in ["srt", "vtt", "ass"]:
        output_path = exports_dir / f"subtitle-bilingual.{export_format}"
        write_subtitle_export(document, output_path, export_format, "bilingual")
        size_bytes = output_path.stat().st_size if output_path.is_file() else 0
        if size_bytes <= 0:
            raise AcceptanceError(f"{export_format.upper()} export artifact is empty: {output_path}")
        artifacts.append(
            {
                "format": export_format,
                "mode": "bilingual",
                "path": str(output_path),
                "bytes": size_bytes,
            }
        )

    return {
        "mode": "bilingual",
        "artifactCount": len(artifacts),
        "artifacts": artifacts,
        "validationWarningCount": len(export_warnings),
        "validationWarnings": [
            {
                "lineId": warning.line_id,
                "code": warning.code,
                "severity": warning.severity,
                "message": warning.message,
            }
            for warning in export_warnings
        ],
    }


def count_subtitle_timing_issues(lines, duration_ms: int) -> int:
    issues = 0
    previous_start_ms = -1
    for line in lines:
        if line.start_ms < previous_start_ms:
            issues += 1
        if line.start_ms < 0 or line.end_ms <= line.start_ms:
            issues += 1
        if line.start_ms > duration_ms or line.end_ms > duration_ms:
            issues += 1
        previous_start_ms = line.start_ms
    return issues


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Diplomat 0.40 two-to-three-hour acceptance.")
    parser.add_argument("--source-video", required=True, type=Path)
    parser.add_argument(
        "--evidence-dir",
        type=Path,
        default=ROOT / ".dev" / "acceptance" / "0-40" / datetime.now(UTC).strftime("%Y%m%d-%H%M%S"),
    )
    parser.add_argument("--source-language", default="zh")
    parser.add_argument("--target-language", default="en")
    parser.add_argument("--ffmpeg-path", default="ffmpeg")
    parser.add_argument("--ffprobe-path", default="ffprobe")
    parser.add_argument("--asr-provider", default="vibevoice-asr")
    parser.add_argument("--asr-model-id", default="asr.microsoft.vibevoice-asr")
    parser.add_argument("--asr-device", default="cuda")
    parser.add_argument("--asr-compute-type", default="bfloat16")
    parser.add_argument("--translation-provider", default="local-llm")
    parser.add_argument("--translation-model-id", default="translation.tencent.hunyuan-mt-7b-fp8")
    parser.add_argument("--translation-device", default="cuda")
    parser.add_argument("--translation-compute-type", default="bfloat16")
    parser.add_argument("--translation-batch-size", type=int, default=1)
    parser.add_argument("--glossary-path", type=Path)
    parser.add_argument(
        "--acceptance-profile",
        choices=["release", "smoke"],
        default="release",
        help="Use release for the final 2-3 hour gate or smoke for an initial short-video full workflow run.",
    )
    parser.add_argument(
        "--preflight-only",
        action="store_true",
        help="Validate source media, model readiness, model paths, and glossary without starting ASR or translation.",
    )
    return parser.parse_args()


def task_summary(task) -> dict:
    return {
        "taskId": task.task_id,
        "type": task.type,
        "status": task.status,
        "progress": task.progress,
        "message": task.message,
        "errorCode": task.error_code,
        "errorMessage": task.error_message,
        "diagnosticLogPath": task.diagnostic_log_path,
    }


def write_summary(path: Path, summary: dict) -> None:
    path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
