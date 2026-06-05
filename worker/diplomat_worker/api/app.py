from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from diplomat_worker import __version__
from diplomat_worker.api.runtime import WorkerRuntime, create_default_runtime
from diplomat_worker.api.schemas import (
    AnalyzeProjectResponse,
    CreateProjectRequest,
    ProjectResponse,
    SubtitleDocumentRequest,
)
from diplomat_worker.pipeline.core import CorePipelineInput, run_core_pipeline
from diplomat_worker.schemas.subtitle import SubtitleDocument


def project_response(project) -> ProjectResponse:
    return ProjectResponse(
        project_id=project.project_id,
        name=project.name,
        source_video_path=str(project.source_video_path),
        project_dir=str(project.project_dir),
        duration_ms=project.duration_ms,
        source_language=project.source_language,
        target_language=project.target_language,
    )


def create_app(runtime: WorkerRuntime | None = None) -> FastAPI:
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

    def get_runtime() -> WorkerRuntime:
        active_runtime = app.state.runtime
        if active_runtime is None:
            active_runtime = create_default_runtime()
            app.state.runtime = active_runtime
        return active_runtime

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"name": "diplomat-worker", "status": "ok", "version": __version__}

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
        return project_response(project)

    @app.get("/projects/{project_id}", response_model=ProjectResponse)
    def get_project(project_id: str) -> ProjectResponse:
        active_runtime = get_runtime()
        try:
            project = active_runtime.store.get_project(project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        return project_response(project)

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

    return app


app = create_app()
