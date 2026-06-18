from __future__ import annotations

from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class RuntimeReleaseReport:
    closed: bool
    accelerator_cache_cleared: bool
    messages: list[str]


def release_runtime_resources(resource: object | None) -> RuntimeReleaseReport:
    messages: list[str] = []
    closed = _close_resource(resource, messages)
    accelerator_cache_cleared = _clear_accelerator_cache(messages)
    return RuntimeReleaseReport(
        closed=closed,
        accelerator_cache_cleared=accelerator_cache_cleared,
        messages=messages,
    )


def _close_resource(resource: object | None, messages: list[str]) -> bool:
    if resource is None:
        messages.append("Runtime resource is empty.")
        return False

    close = getattr(resource, "close", None)
    if not callable(close):
        messages.append("Runtime resource has no close hook.")
        return False

    try:
        close()
    except Exception as exc:
        messages.append(f"Runtime resource close failed: {exc}")
        return False

    messages.append("Closed runtime resource.")
    return True


def _clear_accelerator_cache(messages: list[str]) -> bool:
    try:
        import torch
    except ImportError:
        messages.append("Torch is not installed; accelerator cache cleanup skipped.")
        return False

    cuda = getattr(torch, "cuda", None)
    if cuda is None:
        messages.append("Torch CUDA module is unavailable; accelerator cache cleanup skipped.")
        return False

    try:
        is_available: Callable[[], bool] | None = getattr(cuda, "is_available", None)
        if is_available is None or not is_available():
            messages.append("CUDA is not available; accelerator cache cleanup skipped.")
            return False

        cuda.empty_cache()
        ipc_collect = getattr(cuda, "ipc_collect", None)
        if callable(ipc_collect):
            ipc_collect()
    except Exception as exc:
        messages.append(f"Accelerator cache cleanup failed: {exc}")
        return False

    messages.append("Cleared CUDA accelerator cache.")
    return True
