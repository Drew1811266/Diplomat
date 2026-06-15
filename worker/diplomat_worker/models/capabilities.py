from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class RuntimeCapabilities:
    cuda_available: bool = False
    cuda_device_count: int = 0
    detected_by: str = "default"


def detect_runtime_capabilities() -> RuntimeCapabilities:
    configured = os.environ.get("DIPLOMAT_CUDA_AVAILABLE")
    if configured is not None:
        enabled = configured.strip().lower() in {"1", "true", "yes", "on"}
        return RuntimeCapabilities(
            cuda_available=enabled,
            cuda_device_count=1 if enabled else 0,
            detected_by="DIPLOMAT_CUDA_AVAILABLE",
        )

    try:
        import ctranslate2
    except ImportError:
        return RuntimeCapabilities()

    try:
        count = int(ctranslate2.get_cuda_device_count())
    except Exception:
        return RuntimeCapabilities(detected_by="ctranslate2")
    return RuntimeCapabilities(
        cuda_available=count > 0,
        cuda_device_count=max(count, 0),
        detected_by="ctranslate2",
    )
