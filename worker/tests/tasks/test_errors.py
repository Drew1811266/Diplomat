from diplomat_worker.tasks.errors import classify_runtime_error


def test_classify_runtime_error_maps_out_of_memory() -> None:
    code, message = classify_runtime_error(RuntimeError("CUDA out of memory while allocating"))

    assert code == "RUNTIME_OUT_OF_MEMORY"
    assert "memory" in message.lower()


def test_classify_runtime_error_maps_cuda_unavailable() -> None:
    code, message = classify_runtime_error(RuntimeError("CUDA driver is not available"))

    assert code == "RUNTIME_CUDA_UNAVAILABLE"
    assert "CUDA" in message
