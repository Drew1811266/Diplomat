import subprocess
import traceback
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from typing import TYPE_CHECKING

from diplomat_worker.media.waveform import write_waveform_cache
from diplomat_worker.storage.project_store import TaskRecord
from diplomat_worker.tasks.analysis import ThreadCancelToken

if TYPE_CHECKING:
    from diplomat_worker.api.runtime import WorkerRuntime


class WaveformJobManager:
    def __init__(self, runtime: "WorkerRuntime", auto_start: bool = True, max_workers: int = 1) -> None:
        self.runtime = runtime
        self.auto_start = auto_start
        self._executor = ThreadPoolExecutor(max_workers=max_workers) if auto_start else None
        self._pending: list[str] = []
        self._cancel_tokens: dict[str, ThreadCancelToken] = {}
        self._lock = Lock()

    def create_waveform_job(self, project_id: str) -> TaskRecord:
        self.runtime.store.get_project(project_id)
        task = self.runtime.store.create_task(
            project_id=project_id,
            task_type="waveform",
            message="Queued waveform",
            request_payload={},
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
                message="Waveform canceled",
                completed=True,
            )
        if task.status == "running":
            return self.runtime.store.update_task(
                task_id,
                status="canceling",
                message="Canceling waveform",
            )
        return task

    def retry_task(self, task_id: str) -> TaskRecord:
        task = self.runtime.store.get_task(task_id)
        if task.status not in {"failed", "canceled"}:
            raise ValueError("Only failed or canceled tasks can be retried")
        return self.create_waveform_job(task.project_id)

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

        try:
            self.runtime.store.update_task(
                task_id,
                status="running",
                progress=0.01,
                message="Starting waveform generation",
                started=True,
                diagnostic_log_path=str(diagnostic_path),
            )
            if token.is_cancel_requested():
                self._mark_canceled(task_id, diagnostic_path)
                return

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

            self.runtime.store.update_task(
                task_id,
                status="running",
                progress=0.25,
                message="Extracting waveform",
                diagnostic_log_path=str(diagnostic_path),
            )
            data = self.runtime.waveform_generator(
                project.project_id,
                project.source_video_path,
                project.duration_ms,
                self.runtime.ffmpeg_path,
            )
            if token.is_cancel_requested():
                self._mark_canceled(task_id, diagnostic_path)
                return

            write_waveform_cache(project.project_dir / "cache" / "waveform.json", data)
            self.runtime.store.touch_project(project.project_id)
            self.runtime.store.update_task(
                task_id,
                status="completed",
                progress=1,
                message="Waveform completed",
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
        except Exception as exc:
            log(traceback.format_exc())
            self.runtime.store.update_task(
                task_id,
                status="failed",
                message="Waveform failed",
                completed=True,
                error_code="WAVEFORM_FAILED",
                error_message=str(exc),
                diagnostic_log_path=str(diagnostic_path),
            )
        finally:
            with self._lock:
                self._cancel_tokens.pop(task_id, None)

    def _mark_canceled(self, task_id: str, diagnostic_path) -> None:
        with diagnostic_path.open("a", encoding="utf-8") as handle:
            handle.write("Waveform canceled\n")
        self.runtime.store.update_task(
            task_id,
            status="canceled",
            message="Waveform canceled",
            completed=True,
            diagnostic_log_path=str(diagnostic_path),
        )
