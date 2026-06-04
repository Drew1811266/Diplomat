from fastapi.testclient import TestClient

from diplomat_worker.api.app import create_app


def test_health_endpoint_returns_worker_status() -> None:
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"name": "diplomat-worker", "status": "ok", "version": "0.1.0"}


def test_app_exposes_only_health_route() -> None:
    app = create_app()
    paths = {route.path for route in app.routes if isinstance(getattr(route, "path", None), str)}

    assert paths == {"/health"}
