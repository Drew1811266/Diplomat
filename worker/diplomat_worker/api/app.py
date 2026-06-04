from fastapi import FastAPI

from diplomat_worker import __version__


def create_app() -> FastAPI:
    app = FastAPI(title="Diplomat Worker", version=__version__)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"name": "diplomat-worker", "status": "ok", "version": __version__}

    return app


app = create_app()
