import json
import os

from fastapi import FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from diplomat_worker import __version__
from diplomat_worker.api.runtime import WorkerRuntime, create_default_runtime
from diplomat_worker.api.schemas import (
    AnalyzeProjectResponse,
    AnalysisJobRequest,
    CreateProjectRequest,
    ModelCatalogEntryResponse,
    ModelCatalogResponse,
    ModelAvailabilityResponse,
    ModelDeleteResponse,
    ModelDownloadResponse,
    ModelInstallationResponse,
    ProjectListResponse,
    ProjectBackupResponse,
    ProjectDiagnosticsResponse,
    ProjectImportRequest,
    ProjectMaintenanceResponse,
    ProjectResponse,
    ProjectWarningResponse,
    SrtExportRequest,
    SrtExportResponse,
    SubtitleDraftResponse,
    SubtitleDocumentRequest,
    SubtitleSnapshotCreateRequest,
    SubtitleSnapshotListResponse,
    SubtitleSnapshotResponse,
    SubtitleSnapshotSummaryResponse,
    TranslationJobRequest,
    TranslationSettingsRequest,
    TranslationSettingsResponse,
    WaveformPeakResponse,
    WaveformResponse,
)
from diplomat_worker.asr.config import AsrModelConfig
from diplomat_worker.asr.resolver import AsrConfigurationError
from diplomat_worker.export.srt import write_srt_export
from diplomat_worker.media.waveform import WaveformData, read_waveform_cache
from diplomat_worker.models.manager import (
    ModelCatalogEntry as ModelCatalogEntryRecord,
    ModelDeleteResponse as ModelDeleteResult,
    ModelDownloadManager,
    ModelDownloadResponse as ModelDownloadResult,
)
from diplomat_worker.pipeline.core import CorePipelineInput, run_core_pipeline
from diplomat_worker.schemas.subtitle import SubtitleDocument
from diplomat_worker.schemas.task import TaskResponse
from diplomat_worker.storage.project_store import ModelInstallationRecord
from diplomat_worker.storage.project_store import SubtitleDraftRecord
from diplomat_worker.storage.project_store import SubtitleSnapshotRecord
from diplomat_worker.storage.project_store import TaskRecord
from diplomat_worker.storage.project_store import StorageMigrationError
from diplomat_worker.tasks.analysis import AnalysisJobManager
from diplomat_worker.tasks.translation import TranslationJobManager
from diplomat_worker.tasks.waveform import WaveformJobManager
from diplomat_worker.translation.config import TranslationProviderConfig
from diplomat_worker.translation.resolver import TranslationConfigurationError

DEFAULT_CORS_ORIGINS = ("http://localhost:1420", "http://127.0.0.1:1420")


def cors_origins() -> list[str]:
    origins = list(DEFAULT_CORS_ORIGINS)
    configured = os.environ.get("DIPLOMAT_CORS_ORIGINS", "")
    for origin in configured.split(","):
        normalized = origin.strip()
        if normalized and normalized not in origins:
            origins.append(normalized)
    return origins


def project_response(project, runtime: WorkerRuntime) -> ProjectResponse:
    diagnostics = runtime.store.project_diagnostics(project)
    return ProjectResponse(
        project_id=project.project_id,
        name=project.name,
        source_video_path=str(project.source_video_path),
        project_dir=str(project.project_dir),
        duration_ms=project.duration_ms,
        source_language=project.source_language,
        target_language=project.target_language,
        created_at=project.created_at,
        updated_at=project.updated_at,
        has_subtitle_document=runtime.store.has_subtitle_document(project.project_id),
        diagnostics=ProjectDiagnosticsResponse(
            status=diagnostics.status,
            warnings=[
                ProjectWarningResponse(code=warning.code, message=warning.message)
                for warning in diagnostics.warnings
            ],
            source_video_exists=diagnostics.source_video_exists,
            project_dir_exists=diagnostics.project_dir_exists,
            disk_usage_bytes=diagnostics.disk_usage_bytes,
            cache_usage_bytes=diagnostics.cache_usage_bytes,
            export_usage_bytes=diagnostics.export_usage_bytes,
            export_count=diagnostics.export_count,
            subtitle_line_count=diagnostics.subtitle_line_count,
            translated_line_count=diagnostics.translated_line_count,
            active_task_count=diagnostics.active_task_count,
            failed_task_count=diagnostics.failed_task_count,
            latest_task_status=diagnostics.latest_task_status,
            exports_dir=str(diagnostics.exports_dir),
            cache_dir=str(diagnostics.cache_dir),
            logs_dir=str(diagnostics.logs_dir),
            backups_dir=str(diagnostics.backups_dir),
        ),
    )


def task_response(task: TaskRecord) -> TaskResponse:
    return TaskResponse(
        task_id=task.task_id,
        project_id=task.project_id,
        type=task.type,
        status=task.status,
        progress=task.progress,
        message=task.message,
        started_at=task.started_at,
        updated_at=task.updated_at,
        completed_at=task.completed_at,
        error_code=task.error_code,
        error_message=task.error_message,
        diagnostic_log_path=task.diagnostic_log_path,
    )


def subtitle_draft_response(draft: SubtitleDraftRecord) -> SubtitleDraftResponse:
    return SubtitleDraftResponse(
        project_id=draft.project_id,
        updated_at=draft.updated_at,
        line_count=draft.line_count,
        document=draft.document,
    )


def subtitle_snapshot_summary_response(
    snapshot: SubtitleSnapshotRecord,
) -> SubtitleSnapshotSummaryResponse:
    return SubtitleSnapshotSummaryResponse(
        snapshot_id=snapshot.snapshot_id,
        project_id=snapshot.project_id,
        reason=snapshot.reason,
        label=snapshot.label,
        created_at=snapshot.created_at,
        line_count=snapshot.line_count,
    )


def subtitle_snapshot_response(snapshot: SubtitleSnapshotRecord) -> SubtitleSnapshotResponse:
    return SubtitleSnapshotResponse(
        snapshot_id=snapshot.snapshot_id,
        project_id=snapshot.project_id,
        reason=snapshot.reason,
        label=snapshot.label,
        created_at=snapshot.created_at,
        line_count=snapshot.line_count,
        document=snapshot.document,
    )


def maintenance_response(result) -> ProjectMaintenanceResponse:
    return ProjectMaintenanceResponse(
        project_id=result.project_id,
        action=result.action,
        files_affected=result.files_affected,
        bytes_affected=result.bytes_affected,
        message=result.message,
    )


def backup_response(result) -> ProjectBackupResponse:
    return ProjectBackupResponse(
        project_id=result.project_id,
        package_path=str(result.package_path),
        bytes_written=result.bytes_written,
        message=result.message,
    )


def model_installation_response(record: ModelInstallationRecord) -> ModelInstallationResponse:
    return ModelInstallationResponse(
        model_id=record.model_id,
        status=record.status,
        installed_path=str(record.installed_path) if record.installed_path is not None else None,
        downloaded_bytes=record.downloaded_bytes,
        total_bytes=record.total_bytes,
        checksum=record.checksum,
        error_message=record.error_message,
        created_at=record.created_at,
        updated_at=record.updated_at,
        installed_at=record.installed_at,
    )


def model_catalog_entry_response(entry: ModelCatalogEntryRecord) -> ModelCatalogEntryResponse:
    registry = entry.registry
    return ModelCatalogEntryResponse(
        model_id=registry.model_id,
        name=registry.name,
        task=registry.task,
        tier=registry.tier,
        runtime=registry.runtime,
        provider=registry.provider,
        version=registry.version,
        languages=registry.languages,
        language_pairs=registry.language_pairs,
        model_size_bytes=registry.model_size_bytes,
        download_size_bytes=registry.download_size_bytes,
        disk_requirement_bytes=registry.disk_requirement_bytes,
        recommended_hardware=registry.recommended_hardware,
        license_name=registry.license_name,
        license_url=registry.license_url,
        source_url=registry.source_url,
        checksum_algorithm=registry.checksum_algorithm,
        checksum=registry.checksum,
        terms_summary=registry.terms_summary,
        installation=model_installation_response(entry.installation),
        availability=ModelAvailabilityResponse(
            usable=entry.availability.usable,
            reason=entry.availability.reason,
        ),
    )


def model_download_response(result: ModelDownloadResult) -> ModelDownloadResponse:
    return ModelDownloadResponse(
        model_id=result.model_id,
        status=result.status,
        downloaded_bytes=result.downloaded_bytes,
        total_bytes=result.total_bytes,
        message=result.message,
    )


def model_delete_response(result: ModelDeleteResult) -> ModelDeleteResponse:
    return ModelDeleteResponse(
        model_id=result.model_id,
        files_deleted=result.files_deleted,
        bytes_deleted=result.bytes_deleted,
        message=result.message,
    )


def analysis_config_from_request(request: AnalysisJobRequest) -> AsrModelConfig:
    return AsrModelConfig(
        provider=request.provider,
        model_id=request.model_id,
        model_name_or_path=request.model_name_or_path,
        device=request.device,
        compute_type=request.compute_type,
        source_language=request.source_language,
        initial_prompt=request.initial_prompt,
    )


def translation_config_from_request(request: TranslationSettingsRequest) -> TranslationProviderConfig:
    return TranslationProviderConfig(
        provider=request.provider,
        model_id=request.model_id,
        model_name_or_path=request.model_name_or_path,
        device=request.device,
        compute_type=request.compute_type,
        endpoint=request.endpoint,
        api_key_env=request.api_key_env,
    )


def translation_settings_response(settings) -> TranslationSettingsResponse:
    return TranslationSettingsResponse(
        project_id=settings.project_id,
        provider=settings.provider,
        model_id=settings.model_id,
        model_name_or_path=settings.model_name_or_path,
        source_language=settings.source_language,
        target_language=settings.target_language,
        mode=settings.mode,
        device=settings.device,
        compute_type=settings.compute_type,
        endpoint=settings.endpoint,
        api_key_env=settings.api_key_env,
        updated_at=settings.updated_at,
    )


def waveform_response(data: WaveformData) -> WaveformResponse:
    return WaveformResponse(
        project_id=data.project_id,
        duration_ms=data.duration_ms,
        sample_rate=data.sample_rate,
        peak_count=len(data.peaks),
        peaks=[
            WaveformPeakResponse(
                index=peak.index,
                start_ms=peak.start_ms,
                end_ms=peak.end_ms,
                min=peak.min,
                max=peak.max,
            )
            for peak in data.peaks
        ],
    )


def create_app(
    runtime: WorkerRuntime | None = None,
    analysis_jobs: AnalysisJobManager | None = None,
    translation_jobs: TranslationJobManager | None = None,
    waveform_jobs: WaveformJobManager | None = None,
    model_downloads: ModelDownloadManager | None = None,
) -> FastAPI:
    app = FastAPI(
        title="Diplomat Worker",
        version=__version__,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.runtime = runtime
    app.state.analysis_jobs = analysis_jobs
    app.state.translation_jobs = translation_jobs
    app.state.waveform_jobs = waveform_jobs
    app.state.model_downloads = model_downloads

    def get_runtime() -> WorkerRuntime:
        active_runtime = app.state.runtime
        if active_runtime is None:
            try:
                active_runtime = create_default_runtime()
            except StorageMigrationError as exc:
                raise HTTPException(
                    status_code=503,
                    detail=f"Project database migration failed: {exc}",
                ) from exc
            app.state.runtime = active_runtime
        return active_runtime

    def get_analysis_jobs() -> AnalysisJobManager:
        active_jobs = app.state.analysis_jobs
        if active_jobs is None:
            active_jobs = AnalysisJobManager(get_runtime())
            app.state.analysis_jobs = active_jobs
        return active_jobs

    def get_translation_jobs() -> TranslationJobManager:
        active_jobs = app.state.translation_jobs
        if active_jobs is None:
            active_jobs = TranslationJobManager(get_runtime())
            app.state.translation_jobs = active_jobs
        return active_jobs

    def get_waveform_jobs() -> WaveformJobManager:
        active_jobs = app.state.waveform_jobs
        if active_jobs is None:
            active_jobs = WaveformJobManager(get_runtime())
            app.state.waveform_jobs = active_jobs
        return active_jobs

    def get_model_downloads() -> ModelDownloadManager:
        active_downloads = app.state.model_downloads
        if active_downloads is None:
            active_runtime = get_runtime()
            active_downloads = ModelDownloadManager(
                active_runtime.store,
                registry=active_runtime.model_registry,
            )
            app.state.model_downloads = active_downloads
        return active_downloads

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"name": "diplomat-worker", "status": "ok", "version": __version__}

    @app.get("/models", response_model=ModelCatalogResponse)
    def list_models() -> ModelCatalogResponse:
        return ModelCatalogResponse(
            models=[
                model_catalog_entry_response(entry)
                for entry in get_model_downloads().list_catalog()
            ]
        )

    @app.get("/models/{model_id}", response_model=ModelCatalogEntryResponse)
    def get_model(model_id: str) -> ModelCatalogEntryResponse:
        try:
            return model_catalog_entry_response(get_model_downloads().get_catalog_entry(model_id))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Model not found") from exc

    @app.post(
        "/models/{model_id}/download",
        response_model=ModelDownloadResponse,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def download_model(model_id: str) -> ModelDownloadResponse:
        try:
            return model_download_response(get_model_downloads().start_download(model_id))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Model not found") from exc
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.post("/models/{model_id}/cancel", response_model=ModelDownloadResponse)
    def cancel_model_download(model_id: str) -> ModelDownloadResponse:
        try:
            return model_download_response(get_model_downloads().cancel_download(model_id))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Model not found") from exc

    @app.post(
        "/models/{model_id}/retry",
        response_model=ModelDownloadResponse,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def retry_model_download(model_id: str) -> ModelDownloadResponse:
        try:
            return model_download_response(get_model_downloads().retry_download(model_id))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Model not found") from exc
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.delete("/models/{model_id}", response_model=ModelDeleteResponse)
    def delete_model(model_id: str) -> ModelDeleteResponse:
        try:
            return model_delete_response(get_model_downloads().delete_model(model_id))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Model not found") from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/projects", response_model=ProjectListResponse)
    def list_projects() -> ProjectListResponse:
        active_runtime = get_runtime()
        return ProjectListResponse(
            projects=[
                project_response(project, active_runtime)
                for project in active_runtime.store.list_projects()
            ]
        )

    @app.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
    def create_project(request: CreateProjectRequest) -> ProjectResponse:
        active_runtime = get_runtime()
        try:
            probe = active_runtime.probe_video_fn(request.source_video_path)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Unable to probe source video: {exc}") from exc
        if not probe.has_audio:
            raise HTTPException(status_code=400, detail="Source video does not contain an audio stream")

        project = active_runtime.store.create_project(
            name=request.name,
            source_video_path=request.source_video_path,
            duration_ms=probe.duration_ms,
            source_language=request.source_language,
            target_language=request.target_language,
        )
        return project_response(project, active_runtime)

    @app.post("/projects/import", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
    def import_project(request: ProjectImportRequest) -> ProjectResponse:
        active_runtime = get_runtime()
        try:
            project = active_runtime.store.import_project_backup(
                request.package_path,
                restore_name=request.restore_name,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return project_response(project, active_runtime)

    @app.get("/projects/{project_id}", response_model=ProjectResponse)
    def get_project(project_id: str) -> ProjectResponse:
        active_runtime = get_runtime()
        try:
            project = active_runtime.store.get_project(project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        return project_response(project, active_runtime)

    @app.delete("/projects/{project_id}", response_model=ProjectMaintenanceResponse)
    def delete_project(
        project_id: str,
        delete_files: bool = Query(default=True, alias="deleteFiles"),
    ) -> ProjectMaintenanceResponse:
        try:
            return maintenance_response(get_runtime().store.delete_project(project_id, delete_files=delete_files))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/projects/{project_id}/cleanup/cache", response_model=ProjectMaintenanceResponse)
    def cleanup_project_cache(project_id: str) -> ProjectMaintenanceResponse:
        try:
            return maintenance_response(get_runtime().store.cleanup_project_cache(project_id))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/projects/{project_id}/cleanup/exports", response_model=ProjectMaintenanceResponse)
    def cleanup_project_exports(project_id: str) -> ProjectMaintenanceResponse:
        try:
            return maintenance_response(get_runtime().store.cleanup_project_exports(project_id))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/projects/{project_id}/backup", response_model=ProjectBackupResponse)
    def backup_project(project_id: str) -> ProjectBackupResponse:
        try:
            return backup_response(get_runtime().store.backup_project(project_id))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/projects/{project_id}/analyze", response_model=AnalyzeProjectResponse)
    def analyze_project(project_id: str) -> AnalyzeProjectResponse:
        active_runtime = get_runtime()
        try:
            project = active_runtime.store.get_project(project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc

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
            transcriber=active_runtime.transcriber,
            extract_audio_fn=active_runtime.extract_audio_fn,
        )
        subtitle_path = active_runtime.store.save_subtitle_document(project_id, result.subtitle_document)
        return AnalyzeProjectResponse(
            project_id=project_id,
            status="completed",
            subtitle_path=str(subtitle_path),
            line_count=len(result.subtitle_document.lines),
            document=result.subtitle_document,
        )

    @app.post(
        "/projects/{project_id}/analysis-jobs",
        response_model=TaskResponse,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def create_analysis_job(project_id: str, request: AnalysisJobRequest) -> TaskResponse:
        try:
            task = get_analysis_jobs().create_analysis_job(project_id, analysis_config_from_request(request))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        except AsrConfigurationError as exc:
            raise HTTPException(status_code=409, detail=exc.message) from exc
        return task_response(task)

    @app.get("/projects/{project_id}/media/source")
    def get_source_media(project_id: str) -> FileResponse:
        try:
            project = get_runtime().store.get_project(project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        if not project.source_video_path.exists():
            raise HTTPException(status_code=404, detail="Source media not found")
        return FileResponse(project.source_video_path)

    @app.get("/projects/{project_id}/waveform", response_model=WaveformResponse)
    def get_waveform(project_id: str) -> WaveformResponse:
        try:
            project = get_runtime().store.get_project(project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        cache_path = project.project_dir / "cache" / "waveform.json"
        if not cache_path.exists():
            raise HTTPException(status_code=404, detail="Waveform not found")
        return waveform_response(read_waveform_cache(cache_path))

    @app.post(
        "/projects/{project_id}/waveform-jobs",
        response_model=TaskResponse,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def create_waveform_job(project_id: str) -> TaskResponse:
        try:
            task = get_waveform_jobs().create_waveform_job(project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        return task_response(task)

    @app.get("/projects/{project_id}/translation-settings", response_model=TranslationSettingsResponse)
    def get_translation_settings(project_id: str) -> TranslationSettingsResponse:
        try:
            settings = get_runtime().store.get_translation_settings(project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        return translation_settings_response(settings)

    @app.put("/projects/{project_id}/translation-settings", response_model=TranslationSettingsResponse)
    def put_translation_settings(
        project_id: str,
        request: TranslationSettingsRequest,
    ) -> TranslationSettingsResponse:
        try:
            settings = get_runtime().store.save_translation_settings(
                project_id,
                provider=request.provider,
                model_id=request.model_id,
                model_name_or_path=request.model_name_or_path,
                source_language=request.source_language,
                target_language=request.target_language,
                mode=request.mode,
                device=request.device,
                compute_type=request.compute_type,
                endpoint=request.endpoint,
                api_key_env=request.api_key_env,
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return translation_settings_response(settings)

    @app.post(
        "/projects/{project_id}/translation-jobs",
        response_model=TaskResponse,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def create_translation_job(project_id: str, request: TranslationJobRequest) -> TaskResponse:
        try:
            get_runtime().store.save_translation_settings(
                project_id,
                provider=request.provider,
                model_id=request.model_id,
                model_name_or_path=request.model_name_or_path,
                source_language=request.source_language,
                target_language=request.target_language,
                mode=request.mode,
                device=request.device,
                compute_type=request.compute_type,
                endpoint=request.endpoint,
                api_key_env=request.api_key_env,
            )
            task = get_translation_jobs().create_translation_job(
                project_id,
                source_language=request.source_language,
                target_language=request.target_language,
                mode=request.mode,
                provider_config=translation_config_from_request(request),
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        except TranslationConfigurationError as exc:
            raise HTTPException(status_code=409, detail=exc.message) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return task_response(task)

    @app.get("/tasks/{task_id}", response_model=TaskResponse)
    def get_task(task_id: str) -> TaskResponse:
        try:
            return task_response(get_runtime().store.get_task(task_id))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Task not found") from exc

    @app.post("/tasks/{task_id}/cancel", response_model=TaskResponse)
    def cancel_task(task_id: str) -> TaskResponse:
        try:
            task = get_runtime().store.get_task(task_id)
            if task.type == "analysis":
                return task_response(get_analysis_jobs().cancel_task(task_id))
            if task.type == "translation":
                return task_response(get_translation_jobs().cancel_task(task_id))
            if task.type == "waveform":
                return task_response(get_waveform_jobs().cancel_task(task_id))
            raise HTTPException(status_code=409, detail=f"Task type cannot be canceled: {task.type}")
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Task not found") from exc

    @app.post("/tasks/{task_id}/retry", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
    async def retry_task(task_id: str, request: Request) -> TaskResponse:
        try:
            body = await request.body()
            payload = json.loads(body) if body else None
            task = get_runtime().store.get_task(task_id)
            if task.type == "analysis":
                config = (
                    analysis_config_from_request(AnalysisJobRequest.model_validate(payload))
                    if payload is not None
                    else None
                )
                return task_response(get_analysis_jobs().retry_task(task_id, config))
            if task.type == "translation":
                retry_request = TranslationJobRequest.model_validate(payload) if payload is not None else None
                return task_response(
                    get_translation_jobs().retry_task(
                        task_id,
                        provider_config=translation_config_from_request(retry_request)
                        if retry_request is not None
                        else None,
                        source_language=retry_request.source_language if retry_request is not None else None,
                        target_language=retry_request.target_language if retry_request is not None else None,
                        mode=retry_request.mode if retry_request is not None else None,
                    )
                )
            if task.type == "waveform":
                return task_response(get_waveform_jobs().retry_task(task_id))
            raise HTTPException(status_code=409, detail=f"Task type cannot be retried: {task.type}")
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Invalid JSON body") from exc
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Task not found") from exc
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.get("/projects/{project_id}/subtitle/draft", response_model=SubtitleDraftResponse)
    def get_subtitle_draft(project_id: str) -> SubtitleDraftResponse:
        active_runtime = get_runtime()
        try:
            return subtitle_draft_response(active_runtime.store.get_subtitle_draft_record(project_id))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Subtitle draft not found") from exc

    @app.put("/projects/{project_id}/subtitle/draft", response_model=SubtitleDraftResponse)
    def put_subtitle_draft(
        project_id: str,
        request: SubtitleDocumentRequest,
    ) -> SubtitleDraftResponse:
        active_runtime = get_runtime()
        try:
            return subtitle_draft_response(
                active_runtime.store.save_subtitle_draft(project_id, request.document)
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.delete("/projects/{project_id}/subtitle/draft", response_model=ProjectMaintenanceResponse)
    def delete_subtitle_draft(project_id: str) -> ProjectMaintenanceResponse:
        active_runtime = get_runtime()
        try:
            active_runtime.store.delete_subtitle_draft(project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Subtitle draft not found") from exc
        return ProjectMaintenanceResponse(
            project_id=project_id,
            action="clear_draft",
            files_affected=1,
            bytes_affected=0,
            message="Subtitle draft cleared.",
        )

    @app.get(
        "/projects/{project_id}/subtitle/snapshots",
        response_model=SubtitleSnapshotListResponse,
    )
    def list_subtitle_snapshots(project_id: str) -> SubtitleSnapshotListResponse:
        active_runtime = get_runtime()
        try:
            snapshots = active_runtime.store.list_subtitle_snapshots(project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        return SubtitleSnapshotListResponse(
            project_id=project_id,
            snapshots=[subtitle_snapshot_summary_response(snapshot) for snapshot in snapshots],
        )

    @app.post(
        "/projects/{project_id}/subtitle/snapshots",
        response_model=SubtitleSnapshotResponse,
        status_code=status.HTTP_201_CREATED,
    )
    def create_subtitle_snapshot(
        project_id: str,
        request: SubtitleSnapshotCreateRequest,
    ) -> SubtitleSnapshotResponse:
        active_runtime = get_runtime()
        try:
            snapshot = active_runtime.store.create_subtitle_snapshot(
                project_id,
                reason=request.reason,
                label=request.label,
                document=request.document,
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Subtitle document not found") from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return subtitle_snapshot_response(snapshot)

    @app.post(
        "/projects/{project_id}/subtitle/snapshots/{snapshot_id}/restore",
        response_model=SubtitleDocument,
    )
    def restore_subtitle_snapshot(project_id: str, snapshot_id: str) -> SubtitleDocument:
        active_runtime = get_runtime()
        try:
            return active_runtime.store.restore_subtitle_snapshot(project_id, snapshot_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Subtitle snapshot not found") from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/projects/{project_id}/subtitle", response_model=SubtitleDocument)
    def get_subtitle(project_id: str) -> SubtitleDocument:
        active_runtime = get_runtime()
        try:
            active_runtime.store.get_project(project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        try:
            return active_runtime.store.load_subtitle_document(project_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Subtitle document not found") from exc

    @app.put("/projects/{project_id}/subtitle", response_model=SubtitleDocument)
    def put_subtitle(project_id: str, request: SubtitleDocumentRequest) -> SubtitleDocument:
        active_runtime = get_runtime()
        try:
            active_runtime.store.get_project(project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        try:
            active_runtime.store.save_subtitle_document(project_id, request.document)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return request.document

    @app.post("/projects/{project_id}/exports/srt", response_model=SrtExportResponse)
    def export_srt(project_id: str, request: SrtExportRequest) -> SrtExportResponse:
        active_runtime = get_runtime()
        try:
            project = active_runtime.store.get_project(project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        try:
            document = active_runtime.store.load_subtitle_document(project_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Subtitle document not found") from exc

        export_path = project.project_dir / "exports" / f"subtitle-{request.mode}.srt"
        write_srt_export(document, export_path, mode=request.mode)
        active_runtime.store.touch_project(project_id)
        return SrtExportResponse(project_id=project_id, export_path=str(export_path), mode=request.mode)

    return app


app = create_app()
