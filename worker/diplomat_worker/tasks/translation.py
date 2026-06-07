import traceback
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from typing import TYPE_CHECKING

from diplomat_worker.schemas.subtitle import SubtitleDocument, SubtitleLine, TranslationOrigin
from diplomat_worker.storage.project_store import TaskRecord
from diplomat_worker.tasks.analysis import ThreadCancelToken
from diplomat_worker.translation.base import (
    TranslationCanceled,
    TranslationRequest,
)
from diplomat_worker.translation.config import TranslationProviderConfig

if TYPE_CHECKING:
    from diplomat_worker.api.runtime import WorkerRuntime


class TranslationJobManager:
    def __init__(self, runtime: "WorkerRuntime", auto_start: bool = True, max_workers: int = 1) -> None:
        self.runtime = runtime
        self.auto_start = auto_start
        self._executor = ThreadPoolExecutor(max_workers=max_workers) if auto_start else None
        self._pending: list[str] = []
        self._cancel_tokens: dict[str, ThreadCancelToken] = {}
        self._lock = Lock()

    def create_translation_job(
        self,
        project_id: str,
        source_language: str,
        target_language: str,
        mode: str,
        provider_config: TranslationProviderConfig,
    ) -> TaskRecord:
        self.runtime.store.get_project(project_id)
        if mode not in {"missing_only", "overwrite_all"}:
            raise ValueError("Unsupported translation mode")
        task = self.runtime.store.create_task(
            project_id=project_id,
            task_type="translation",
            message="Queued translation",
            request_payload={
                "sourceLanguage": source_language,
                "targetLanguage": target_language,
                "mode": mode,
                **provider_config.to_request_payload(),
            },
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
                message="Translation canceled",
                completed=True,
            )
        if task.status == "running":
            return self.runtime.store.update_task(
                task_id,
                status="canceling",
                message="Canceling translation",
            )
        return task

    def retry_task(
        self,
        task_id: str,
        provider_config: TranslationProviderConfig | None = None,
    ) -> TaskRecord:
        task = self.runtime.store.get_task(task_id)
        if task.status not in {"failed", "canceled"}:
            raise ValueError("Only failed or canceled tasks can be retried")
        payload = task.request_payload
        return self.create_translation_job(
            task.project_id,
            source_language=payload["sourceLanguage"],
            target_language=payload["targetLanguage"],
            mode=payload["mode"],
            provider_config=provider_config or TranslationProviderConfig.from_request_payload(payload),
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

        try:
            payload = task.request_payload
            source_language = payload["sourceLanguage"]
            target_language = payload["targetLanguage"]
            mode = payload["mode"]
            provider_config = TranslationProviderConfig.from_request_payload(payload)
            provider = self.runtime.translation_provider_factory(provider_config)

            document = self.runtime.store.load_subtitle_document(task.project_id)
            selected_lines = self._select_lines(document.lines, mode)
            document = self._mark_selected_lines_queued(document, selected_lines)
            self.runtime.store.save_subtitle_document(task.project_id, document)
            self.runtime.store.update_task(
                task_id,
                status="running",
                progress=0.05,
                message="Starting translation",
                started=True,
                diagnostic_log_path=str(diagnostic_path),
            )

            if token.is_cancel_requested():
                raise TranslationCanceled("Translation canceled")

            if not selected_lines:
                self.runtime.store.update_task(
                    task_id,
                    status="completed",
                    progress=1,
                    message="Translation completed",
                    completed=True,
                    diagnostic_log_path=str(diagnostic_path),
                )
                return

            translated_lines: dict[str, SubtitleLine] = {}
            for index, line in enumerate(selected_lines):
                if token.is_cancel_requested():
                    raise TranslationCanceled("Translation canceled")

                result = provider.translate(
                    TranslationRequest(
                        line_id=line.id,
                        source_text=line.source_text,
                        source_language=source_language,
                        target_language=target_language,
                    ),
                    cancel_token=token,
                )
                translated_lines[line.id] = line.model_copy(
                    update={
                        "target_language": target_language,
                        "translated_text": result.translated_text,
                        "translation_status": "translated",
                        "translation_origin": TranslationOrigin(
                            provider=result.provider,
                            model=result.model,
                        ),
                        "translation_error": None,
                    }
                )
                progress = 0.05 + ((index + 1) / len(selected_lines)) * 0.9
                self.runtime.store.update_task(
                    task_id,
                    status="running",
                    progress=progress,
                    message=f"Translated {index + 1} of {len(selected_lines)} lines",
                    diagnostic_log_path=str(diagnostic_path),
                )

            next_document = document.model_copy(
                update={
                    "lines": [
                        translated_lines.get(line.id, line)
                        for line in document.lines
                    ]
                }
            )
            self.runtime.store.save_subtitle_document(task.project_id, next_document)
            self.runtime.store.update_task(
                task_id,
                status="completed",
                progress=1,
                message="Translation completed",
                completed=True,
                diagnostic_log_path=str(diagnostic_path),
            )
        except TranslationCanceled:
            log("Translation canceled")
            self.runtime.store.update_task(
                task_id,
                status="canceled",
                message="Translation canceled",
                completed=True,
                diagnostic_log_path=str(diagnostic_path),
            )
        except Exception as exc:
            log(traceback.format_exc())
            self._mark_first_failed_line(task, str(exc))
            self.runtime.store.update_task(
                task_id,
                status="failed",
                message="Translation failed",
                completed=True,
                error_code="TRANSLATION_FAILED",
                error_message=str(exc),
                diagnostic_log_path=str(diagnostic_path),
            )
        finally:
            with self._lock:
                self._cancel_tokens.pop(task_id, None)

    def _select_lines(self, lines: list[SubtitleLine], mode: str) -> list[SubtitleLine]:
        if mode == "overwrite_all":
            return [line for line in lines if line.source_text.strip()]
        return [
            line
            for line in lines
            if line.source_text.strip()
            and (
                not line.translated_text.strip()
                or line.translation_status in {"not_requested", "failed"}
            )
        ]

    def _mark_selected_lines_queued(
        self,
        document: SubtitleDocument,
        selected_lines: list[SubtitleLine],
    ) -> SubtitleDocument:
        selected_ids = {line.id for line in selected_lines}
        return document.model_copy(
            update={
                "lines": [
                    line.model_copy(
                        update={"translation_status": "queued", "translation_error": None}
                    )
                    if line.id in selected_ids
                    else line
                    for line in document.lines
                ]
            }
        )

    def _mark_first_failed_line(self, task: TaskRecord, error_message: str) -> None:
        try:
            document = self.runtime.store.load_subtitle_document(task.project_id)
        except FileNotFoundError:
            return
        payload = task.request_payload
        selected_lines = self._select_lines(document.lines, payload.get("mode", "missing_only"))
        if not selected_lines:
            return
        failed_line_id = selected_lines[0].id
        self.runtime.store.save_subtitle_document(
            task.project_id,
            document.model_copy(
                update={
                    "lines": [
                        line.model_copy(
                            update={
                                "translation_status": "failed",
                                "translation_error": error_message,
                            }
                        )
                        if line.id == failed_line_id
                        else line
                        for line in document.lines
                    ]
                }
            ),
        )
