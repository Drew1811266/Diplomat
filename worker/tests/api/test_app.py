from fastapi.testclient import TestClient

from diplomat_worker.api.app import create_app


def test_health_endpoint_returns_worker_status() -> None:
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"name": "diplomat-worker", "status": "ok", "version": "0.1.0"}
