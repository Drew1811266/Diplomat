def classify_runtime_error(exc: Exception) -> tuple[str, str]:
    message = str(exc) or exc.__class__.__name__
    lowered = message.lower()
    if "out of memory" in lowered or "oom" in lowered:
        return (
            "RUNTIME_OUT_OF_MEMORY",
            f"Model runtime ran out of memory. Use a lighter model, CPU int8, or a smaller batch size. Details: {message}",
        )
    if "cuda" in lowered and (
        "not available" in lowered or "driver" in lowered or "no cuda" in lowered
    ):
        return (
            "RUNTIME_CUDA_UNAVAILABLE",
            f"CUDA runtime is unavailable. Switch the model profile to CPU or install a working NVIDIA CUDA runtime. Details: {message}",
        )
    return ("RUNTIME_FAILED", message)
