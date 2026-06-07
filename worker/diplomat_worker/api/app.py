from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from diplomat_worker import __version__
from diplomat_worker.api.runtime import WorkerRuntime, create_default_runtime
from diplomat_worker.api.schemas import (
    AnalyzeProjectResponse,
    AnalysisJobRequest,
    CreateProjectRequest,
    ProjectListResponse,
    ProjectResponse,
    SrtExportRequest,
    SrtExportResponse,
    SubtitleDocumentRequest,
)
from diplomat_worker.asr.config import AsrModelConfig
from diplomat_worker.export.srt import write_srt_export
from diplomat_worker.pipeline.core import CorePipelineInput, run_core_pipeline
from diplomat_worker.schemas.subtitle import SubtitleDocument
from diplomat_worker.schemas.task import TaskResponse
from diplomat_worker.storage.project_store import TaskRecord
from diplomat_worker.tasks.analysis import AnalysisJobManager


def project_response(project, runtime: WorkerRuntime) -> ProjectResponse:
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


def analysis_config_from_request(request: AnalysisJobRequest) -> AsrModelConfig:
    return AsrModelConfig(
        provider=request.provider,
        model_name_or_path=request.model_name_or_path,
        device=request.device,
        compute_type=request.compute_type,
        source_language=request.source_language,
        initial_prompt=request.initial_prompt,
    )


def create_app(
    runtime: WorkerRuntime | None = None,
    analysis_jobs: AnalysisJobManager | None = None,
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
        allow_origins=["http://localhost:1420", "http://127.0.0.1:1420"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.runtime = runtime
    app.state.analysis_jobs = analysis_jobs

    def get_runtime() -> WorkerRuntime:
        active_runtime = app.state.runtime
        if active_runtime is None:
            active_runtime = create_default_runtime()
            app.state.runtime = active_runtime
        return active_runtime

    def get_analysis_jobs() -> AnalysisJobManager:
        active_jobs = app.state.analysis_jobs
        if active_jobs is None:
            active_jobs = AnalysisJobManager(get_runtime())
            app.state.analysis_jobs = active_jobs
        return active_jobs

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"name": "diplomat-worker", "status": "ok", "version": __version__}

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

    @app.get("/projects/{project_id}", response_model=ProjectResponse)
    def get_project(project_id: str) -> ProjectResponse:
        active_runtime = get_runtime()
        try:
            project = active_runtime.store.get_project(project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        return project_response(project, active_runtime)

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
        return task_response(task)

    @app.get("/tasks/{task_id}", response_model=TaskResponse)
    def get_task(task_id: str) -> TaskResponse:
        try:
            return task_response(get_analysis_jobs().get_task(task_id))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Task not found") from exc

    @app.post("/tasks/{task_id}/cancel", response_model=TaskResponse)
    def cancel_task(task_id: str) -> TaskResponse:
        try:
            return task_response(get_analysis_jobs().cancel_task(task_id))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Task not found") from exc

    @app.post("/tasks/{task_id}/retry", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
    def retry_task(task_id: str, request: AnalysisJobRequest | None = None) -> TaskResponse:
        try:
            config = analysis_config_from_request(request) if request is not None else None
            return task_response(get_analysis_jobs().retry_task(task_id, config))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Task not found") from exc
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

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
