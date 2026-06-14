import subprocess
import traceback
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event, Lock
from typing import TYPE_CHECKING

from diplomat_worker.asr.base import AsrCanceled
from diplomat_worker.asr.config import AsrModelConfig
from diplomat_worker.asr.resolver import AsrConfigurationError, resolve_asr_model_config
from diplomat_worker.pipeline.core import CorePipelineInput, run_core_pipeline
from diplomat_worker.storage.project_store import TaskRecord

if TYPE_CHECKING:
    from diplomat_worker.api.runtime import WorkerRuntime


class ThreadCancelToken:
    def __init__(self) -> None:
        self._event = Event()

    def request_cancel(self) -> None:
        self._event.set()

    def is_cancel_requested(self) -> bool:
        return self._event.is_set()


class AnalysisJobManager:
    def __init__(self, runtime: "WorkerRuntime", auto_start: bool = True, max_workers: int = 1) -> None:
        self.runtime = runtime
        self.auto_start = auto_start
        self._executor = ThreadPoolExecutor(max_workers=max_workers) if auto_start else None
        self._pending: list[str] = []
        self._cancel_tokens: dict[str, ThreadCancelToken] = {}
        self._lock = Lock()

    def create_analysis_job(self, project_id: str, config: AsrModelConfig) -> TaskRecord:
        project = self.runtime.store.get_project(project_id)
        self._resolve_config(config, project.source_language)
        task = self.runtime.store.create_task(
            project_id=project_id,
            task_type="analysis",
            message="Queued analysis",
            request_payload=config.to_request_payload(),
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
                message="Analysis canceled",
                completed=True,
            )
        if task.status == "running":
            return self.runtime.store.update_task(
                task_id,
                status="canceling",
                message="Canceling analysis",
            )
        return task

    def retry_task(self, task_id: str, config: AsrModelConfig | None = None) -> TaskRecord:
        task = self.runtime.store.get_task(task_id)
        if task.status not in {"failed", "canceled"}:
            raise ValueError("Only failed or canceled tasks can be retried")
        return self.create_analysis_job(
            task.project_id,
            config or AsrModelConfig.from_request_payload(task.request_payload),
        )

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
                progress=progress,
                message=message,
                diagnostic_log_path=str(diagnostic_path),
            )

        try:
            self.runtime.store.update_task(
                task_id,
                status="running",
                progress=0.01,
                message="Starting analysis",
                started=True,
                diagnostic_log_path=str(diagnostic_path),
            )
            if token.is_cancel_requested():
                raise AsrCanceled("Analysis canceled")

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

            config = AsrModelConfig.from_request_payload(task.request_payload)
            resolved_config = self._resolve_config(config, project.source_language)
            transcriber = self.runtime.transcriber_factory(resolved_config, project.source_language)
            result = run_core_pipeline(
                CorePipelineInput(
                    project_id=project.project_id,
                    media_id="media-1",
                    source_video=project.source_video_path,
                    project_dir=project.project_dir,
                    duration_ms=project.duration_ms,
                    source_language=project.source_language,
                    target_language=project.target_language,
                ),
                transcriber=transcriber,
                extract_audio_fn=self.runtime.extract_audio_fn,
                ffmpeg_path=self.runtime.ffmpeg_path,
                progress_callback=update_progress,
                cancel_token=token,
            )
            self.runtime.store.save_subtitle_document(project.project_id, result.subtitle_document)
            self.runtime.store.update_task(
                task_id,
                status="completed",
                progress=1,
                message="Analysis completed",
                completed=True,
                diagnostic_log_path=str(diagnostic_path),
            )
        except AsrCanceled:
            log("Analysis canceled")
            self.runtime.store.update_task(
                task_id,
                status="canceled",
                message="Analysis canceled",
                completed=True,
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
                error_message=str(exc),
                diagnostic_log_path=str(diagnostic_path),
            )
        except AsrConfigurationError as exc:
            log(exc.message)
            self.runtime.store.update_task(
                task_id,
                status="failed",
                message=exc.message,
                completed=True,
                error_code=exc.code,
                error_message=exc.message,
                diagnostic_log_path=str(diagnostic_path),
            )
        except Exception as exc:
            log(traceback.format_exc())
            self.runtime.store.update_task(
                task_id,
                status="failed",
                message="Analysis failed",
                completed=True,
                error_code="ANALYSIS_FAILED",
                error_message=str(exc),
                diagnostic_log_path=str(diagnostic_path),
            )
        finally:
            with self._lock:
                self._cancel_tokens.pop(task_id, None)

    def _resolve_config(self, config: AsrModelConfig, fallback_language: str) -> AsrModelConfig:
        return resolve_asr_model_config(
            config,
            store=self.runtime.store,
            registry=self.runtime.model_registry or [],
            fallback_language=fallback_language,
            allow_unmanaged_models=self.runtime.allow_unmanaged_asr_models,
        )
