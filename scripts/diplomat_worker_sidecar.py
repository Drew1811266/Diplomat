from __future__ import annotations

import os

import uvicorn

from diplomat_worker.api.app import app


def main() -> None:
    host = os.environ.get("DIPLOMAT_WORKER_HOST", "127.0.0.1")
    port = int(os.environ.get("DIPLOMAT_WORKER_PORT", "8765"))
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
