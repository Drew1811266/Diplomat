import subprocess
import traceback
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Lock
from typing import TYPE_CHECKING, Callable

from diplomat_worker.export.burn_in import (
    BurnInExportCanceled,
    BurnInExportSettings,
    resolve_burn_in_output_path,
    run_burn_in_export,
    validate_burn_in_output,
    write_burn_in_ass,
)
from diplomat_worker.export.text_subtitles import (
    ExportValidationError,
    SubtitleExportMode,
    validate_subtitle_document_for_export,
)
from diplomat_worker.schemas.subtitle import SubtitleStyle
from diplomat_worker.storage.project_store import TaskRecord
from diplomat_worker.tasks.analysis import ThreadCancelToken

if TYPE_CHECKING:
    from diplomat_worker.api.runtime import WorkerRuntime


BurnInExportRunner = Callable[..., Path]

SUPPORTED_MODES = {"source", "target", "bilingual"}
SUPPORTED_PRESETS = {"ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow"}


class BurnInExportJobManager:
    def __init__(
        self,
        runtime: "WorkerRuntime",
        auto_start: bool = True,
        max_workers: int = 1,
        runner: BurnInExportRunner = run_burn_in_export,
    ) -> None:
        self.runtime = runtime
        self.auto_start = auto_start
        self.runner = runner
        self._executor = ThreadPoolExecutor(max_workers=max_workers) if auto_start else None
        self._pending: list[str] = []
        self._cancel_tokens: dict[str, ThreadCancelToken] = {}
        self._lock = Lock()

    def create_export_job(self, project_id: str, request_payload: dict) -> TaskRecord:
        self.runtime.store.get_project(project_id)
        self.runtime.store.load_subtitle_document(project_id)
        normalized_payload = self._normalize_request_payload(request_payload)
        task = self.runtime.store.create_task(
            project_id=project_id,
            task_type="export",
            message="Queued burn-in export",
            request_payload=normalized_payload,
        )
        token = ThreadCancelToken()
        with self._lock:
            self._cancel_tokens[task.task_id] = token
            if self.auto_start:
                assert self._executor is not None
                self._executor.submit(self._run_task, task.task_id)
            else:
                self._pending.append(task.task_id)
        return task

    def get_task(self, task_id: str) -> TaskRecord:
        return self.runtime.store.get_task(task_id)

    def cancel_task(self, task_id: str) -> TaskRecord:
        task = self.runtime.store.get_task(task_id)
        with self._lock:
            token = self._cancel_tokens.setdefault(task_id, ThreadCancelToken())
            token.request_cancel()

        if task.status == "queued":
            return self.runtime.store.update_task(
                task_id,
                status="canceled",
                progress=task.progress,
                message="Burn-in export canceled",
                completed=True,
            )
        if task.status == "running":
            return self.runtime.store.update_task(
                task_id,
                status="canceling",
                message="Canceling burn-in export",
            )
        return task

    def retry_task(self, task_id: str) -> TaskRecord:
        task = self.runtime.store.get_task(task_id)
        if task.status not in {"failed", "canceled"}:
            raise ValueError("Only failed or canceled tasks can be retried")
        return self.create_export_job(task.project_id, task.request_payload)

    def run_pending_once(self) -> None:
        with self._lock:
            task_id = self._pending.pop(0) if self._pending else None
        if task_id is not None:
            self._run_task(task_id)

    def _run_task(self, task_id: str) -> None:
        task = self.runtime.store.get_task(task_id)
        if task.status != "queued":
            return

        project = self.runtime.store.get_project(task.project_id)
        diagnostic_path = project.project_dir / "logs" / f"{task.task_id}.log"
        diagnostic_path.parent.mkdir(parents=True, exist_ok=True)
        token = self._cancel_tokens.setdefault(task_id, ThreadCancelToken())

        def log(message: str) -> None:
            with diagnostic_path.open("a", encoding="utf-8") as handle:
                handle.write(f"{message}\n")

        def update_progress(progress: float, message: str) -> None:
            self.runtime.store.update_task(
                task_id,
                status="running",
                progress=max(0, min(progress, 0.99)),
                message=message,
                diagnostic_log_path=str(diagnostic_path),
            )

        try:
            self.runtime.store.update_task(
                task_id,
                status="running",
                progress=0.01,
                message="Starting burn-in export",
                started=True,
                diagnostic_log_path=str(diagnostic_path),
            )
            if token.is_cancel_requested():
                raise BurnInExportCanceled("Burn-in export canceled")

            check = self.runtime.ffmpeg_check_fn(
                project.source_video_path,
                self.runtime.ffmpeg_path,
                self.runtime.ffprobe_path,
            )
            log(check.message)
            if not check.ok:
                self.runtime.store.update_task(
                    task_id,
                    status="failed",
                    progress=0.02,
                    message=check.message,
                    completed=True,
                    error_code=check.error_code,
                    error_message=check.message,
                    diagnostic_log_path=str(diagnostic_path),
                )
                return

            document = self.runtime.store.load_subtitle_document(project.project_id)
            validate_subtitle_document_for_export(document)
            payload = self._normalize_request_payload(task.request_payload)
            style = self._style_from_payload(project.project_id, payload)
            self.runtime.store.create_subtitle_snapshot(
                project.project_id,
                reason="burn_in_export_preparation",
                label="Before burn-in export",
                document=document,
            )

            output_path = resolve_burn_in_output_path(
                project.project_dir,
                project.source_video_path,
                payload["outputPath"],
                payload["mode"],
                task_id,
            )
            ass_path = project.project_dir / "cache" / f"burn-in-{task_id}.ass"
            write_burn_in_ass(document, ass_path, payload["mode"], style)
            self.runtime.store.update_task(
                task_id,
                status="running",
                progress=0.15,
                message="Prepared subtitle render script",
                diagnostic_log_path=str(diagnostic_path),
            )

            self.runner(
                ffmpeg_path=self.runtime.ffmpeg_path,
                source_video=project.source_video_path,
                ass_path=ass_path,
                output_path=output_path,
                duration_ms=project.duration_ms,
                settings=BurnInExportSettings(
                    video_codec=payload["videoCodec"],
                    crf=payload["crf"],
                    preset=payload["preset"],
                ),
                cancel_token=token,
                progress_callback=update_progress,
            )
            validate_burn_in_output(output_path)
            self.runtime.store.touch_project(project.project_id)
            self.runtime.store.update_task(
                task_id,
                status="completed",
                progress=1,
                message=f"Burn-in export completed: {output_path}",
                completed=True,
                diagnostic_log_path=str(diagnostic_path),
            )
        except BurnInExportCanceled:
            self._mark_canceled(task_id, diagnostic_path)
        except ExportValidationError as exc:
            error_message = "; ".join(issue.message for issue in exc.issues)
            log(error_message)
            self.runtime.store.update_task(
                task_id,
                status="failed",
                message="Subtitle export validation failed",
                completed=True,
                error_code="SUBTITLE_EXPORT_VALIDATION_FAILED",
                error_message=error_message,
                diagnostic_log_path=str(diagnostic_path),
            )
        except subprocess.CalledProcessError as exc:
            log(f"FFmpeg command failed: {exc}")
            if exc.stderr:
                log(str(exc.stderr))
            self.runtime.store.update_task(
                task_id,
                status="failed",
                message="FFmpeg command failed",
                completed=True,
                error_code="FFMPEG_COMMAND_FAILED",
                error_message=str(exc.stderr or exc),
                diagnostic_log_path=str(diagnostic_path),
            )
        except FileNotFoundError as exc:
            log(str(exc))
            self.runtime.store.update_task(
                task_id,
                status="failed",
                message="Burn-in export input not found",
                completed=True,
                error_code="BURN_IN_EXPORT_INPUT_NOT_FOUND",
                error_message=str(exc),
                diagnostic_log_path=str(diagnostic_path),
            )
        except ValueError as exc:
            error_code = _value_error_code(str(exc))
            log(str(exc))
            self.runtime.store.update_task(
                task_id,
                status="failed",
                message=str(exc),
                completed=True,
                error_code=error_code,
                error_message=str(exc),
                diagnostic_log_path=str(diagnostic_path),
            )
        except Exception as exc:
            log(traceback.format_exc())
            self.runtime.store.update_task(
                task_id,
                status="failed",
                message="Burn-in export failed",
                completed=True,
                error_code="BURN_IN_EXPORT_FAILED",
                error_message=str(exc),
                diagnostic_log_path=str(diagnostic_path),
            )
        finally:
            with self._lock:
                self._cancel_tokens.pop(task_id, None)

    def _mark_canceled(self, task_id: str, diagnostic_path: Path) -> None:
        with diagnostic_path.open("a", encoding="utf-8") as handle:
            handle.write("Burn-in export canceled\n")
        self.runtime.store.update_task(
            task_id,
            status="canceled",
            message="Burn-in export canceled",
            completed=True,
            diagnostic_log_path=str(diagnostic_path),
        )

    def _normalize_request_payload(self, request_payload: dict) -> dict:
        mode = request_payload.get("mode", "bilingual")
        if mode not in SUPPORTED_MODES:
            raise ValueError(f"Unsupported burn-in export mode: {mode}")
        video_codec = request_payload.get("videoCodec", "libx264")
        if video_codec != "libx264":
            raise ValueError(f"Unsupported video codec: {video_codec}")
        crf = int(request_payload.get("crf", 18))
        if not 0 <= crf <= 51:
            raise ValueError("crf must be between 0 and 51")
        preset = request_payload.get("preset", "medium")
        if preset not in SUPPORTED_PRESETS:
            raise ValueError(f"Unsupported FFmpeg preset: {preset}")

        style = request_payload.get("style")
        style_payload = (
            SubtitleStyle.model_validate(style).model_dump(by_alias=True)
            if style is not None
            else None
        )
        output_path = request_payload.get("outputPath")
        style_preset_id = request_payload.get("stylePresetId")
        return {
            "mode": mode,
            "stylePresetId": style_preset_id if style_preset_id else None,
            "style": style_payload,
            "outputPath": str(output_path) if output_path else None,
            "videoCodec": video_codec,
            "crf": crf,
            "preset": preset,
        }

    def _style_from_payload(self, project_id: str, payload: dict) -> SubtitleStyle | None:
        if payload["style"] is not None:
            return SubtitleStyle.model_validate(payload["style"])
        if payload["stylePresetId"] is not None:
            return self.runtime.store.get_style_preset(project_id, payload["stylePresetId"]).style
        return None


def _value_error_code(message: str) -> str:
    normalized = message.lower()
    if "exports directory" in normalized or "source video" in normalized:
        return "OUTPUT_PATH_UNSAFE"
    if "output" in normalized:
        return "OUTPUT_VALIDATION_FAILED"
    return "BURN_IN_EXPORT_FAILED"
