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
from diplomat_worker.asr.config import AsrModelConfig  # noqa: E402
from diplomat_worker.media.ffmpeg import probe_video  # noqa: E402
from diplomat_worker.models.capabilities import detect_runtime_capabilities  # noqa: E402
from diplomat_worker.models.registry import built_in_model_registry  # noqa: E402
from diplomat_worker.storage.project_store import ProjectStore  # noqa: E402
from diplomat_worker.tasks.analysis import AnalysisJobManager  # noqa: E402
from diplomat_worker.tasks.translation import TranslationJobManager  # noqa: E402
from diplomat_worker.translation.config import TranslationProviderConfig  # noqa: E402

MIN_ACCEPTANCE_DURATION_MS = 3 * 60 * 60 * 1000


def main() -> int:
    args = parse_args()
    source_video = args.source_video.resolve()
    evidence_dir = args.evidence_dir.resolve()
    evidence_dir.mkdir(parents=True, exist_ok=True)
    summary_path = evidence_dir / "acceptance-summary.json"

    started_at = datetime.now(UTC).isoformat()
    summary: dict = {
        "schemaVersion": "diplomat.0-40-acceptance.v1",
        "startedAt": started_at,
        "sourceVideo": str(source_video),
        "evidenceDir": str(evidence_dir),
        "status": "running",
        "checks": [],
    }

    try:
        if not source_video.is_file():
            raise AcceptanceError(f"Source video does not exist: {source_video}")

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

        probe = probe_video(source_video, ffprobe_path=args.ffprobe_path)
        summary["videoProbe"] = {
            "durationMs": probe.duration_ms,
            "hasAudio": probe.has_audio,
            "audioCodec": probe.audio_codec,
            "videoCodec": probe.video_codec,
        }
        if probe.duration_ms < MIN_ACCEPTANCE_DURATION_MS:
            raise AcceptanceError(
                f"Source video is shorter than three hours: {probe.duration_ms} ms."
            )
        if not probe.has_audio:
            raise AcceptanceError("Source video has no audio stream.")

        data_dir = evidence_dir / "worker-data"
        runtime = WorkerRuntime(
            store=ProjectStore(data_dir / "diplomat.db"),
            transcriber=None,
            ffmpeg_path=args.ffmpeg_path,
            ffprobe_path=args.ffprobe_path,
            model_registry=built_in_model_registry(),
            runtime_capabilities=detect_runtime_capabilities(),
            development_model_root=ROOT,
        )
        project = runtime.store.create_project(
            name="0.40 three-hour acceptance",
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

        translation = TranslationJobManager(runtime, auto_start=False)
        translation_task = translation.create_translation_job(
            project.project_id,
            source_language=args.source_language,
            target_language=args.target_language,
            mode="missing_only",
            provider_config=TranslationProviderConfig(
                provider=args.translation_provider,
                model_id=args.translation_model_id,
                device=args.translation_device,
                compute_type=args.translation_compute_type,
                batch_size=args.translation_batch_size,
            ),
        )
        translation.run_pending_once()
        translation_result = runtime.store.get_task(translation_task.task_id)
        summary["translationTask"] = task_summary(translation_result)
        if translation_result.status != "completed":
            raise AcceptanceError(f"Translation task did not complete: {translation_result.status}")

        document = runtime.store.load_subtitle_document(project.project_id)
        translated_count = sum(1 for line in document.lines if line.translated_text.strip())
        summary["subtitle"] = {
            "lineCount": len(document.lines),
            "translatedLineCount": translated_count,
            "path": str(project.project_dir / "subtitle.diplomat.json"),
        }
        if len(document.lines) == 0:
            raise AcceptanceError("ASR produced no subtitle lines.")
        if translated_count == 0:
            raise AcceptanceError("Translation produced no translated lines.")

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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Diplomat 0.40 three-hour acceptance.")
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
    parser.add_argument("--asr-compute-type", default="float16")
    parser.add_argument("--translation-provider", default="local-llm")
    parser.add_argument("--translation-model-id", default="translation.tencent.hunyuan-mt-7b-fp8")
    parser.add_argument("--translation-device", default="cuda")
    parser.add_argument("--translation-compute-type", default="float16")
    parser.add_argument("--translation-batch-size", type=int, default=1)
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
