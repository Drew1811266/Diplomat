from dataclasses import replace

from diplomat_worker.asr.config import AsrModelConfig
from diplomat_worker.models.registry import ModelRegistryEntry, get_model_entry
from diplomat_worker.storage.project_store import ProjectStore


class AsrConfigurationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


COMPUTE_TYPES_BY_DEVICE = {
    "cpu": {"int8", "float32"},
    "cuda": {"int8", "float16", "float32"},
}


def resolve_asr_model_config(
    config: AsrModelConfig,
    *,
    store: ProjectStore,
    registry: list[ModelRegistryEntry],
    fallback_language: str,
    allow_unmanaged_models: bool = False,
) -> AsrModelConfig:
    language = config.source_language or fallback_language
    _validate_runtime_options(config.device, config.compute_type)

    if config.provider == "fake":
        return replace(config, source_language=language)

    if config.provider != "faster-whisper":
        raise AsrConfigurationError(
            "ASR_PROVIDER_UNSUPPORTED",
            f"Unsupported ASR provider: {config.provider}",
        )

    if not config.model_id:
        if allow_unmanaged_models and config.model_name_or_path:
            return replace(config, source_language=language)
        raise AsrConfigurationError(
            "ASR_MODEL_REQUIRED",
            "Select an installed ASR model before starting transcription.",
        )

    try:
        entry = get_model_entry(config.model_id, registry)
    except KeyError as exc:
        raise AsrConfigurationError(
            "ASR_MODEL_NOT_FOUND",
            f"ASR model is not in the curated registry: {config.model_id}",
        ) from exc

    _validate_entry_for_asr(entry)
    if language not in entry.languages:
        raise AsrConfigurationError(
            "ASR_LANGUAGE_UNSUPPORTED",
            f"{entry.name} does not support source language: {language}",
        )

    installation = store.get_model_installation(
        entry.model_id,
        checksum=entry.checksum,
        total_bytes=entry.download_size_bytes,
    )
    if installation.status != "installed":
        raise AsrConfigurationError(
            "ASR_MODEL_NOT_INSTALLED",
            f"Install {entry.name} from Models before starting transcription.",
        )
    if installation.installed_path is None:
        raise AsrConfigurationError(
            "ASR_MODEL_FILES_MISSING",
            f"Installed model path is missing for {entry.name}.",
        )

    store._assert_safe_model_path(installation.installed_path)
    if not installation.installed_path.exists():
        raise AsrConfigurationError(
            "ASR_MODEL_FILES_MISSING",
            f"Installed model files are missing for {entry.name}: {installation.installed_path}",
        )

    return replace(
        config,
        source_language=language,
        model_name_or_path=str(installation.installed_path),
    )


def _validate_entry_for_asr(entry: ModelRegistryEntry) -> None:
    if entry.task != "asr" or entry.runtime != "faster-whisper" or entry.provider != "faster-whisper":
        raise AsrConfigurationError(
            "ASR_MODEL_NOT_COMPATIBLE",
            f"{entry.name} is not a faster-whisper ASR model.",
        )


def _validate_runtime_options(device: str, compute_type: str) -> None:
    supported_compute = COMPUTE_TYPES_BY_DEVICE.get(device)
    if supported_compute is None:
        raise AsrConfigurationError(
            "ASR_DEVICE_UNSUPPORTED",
            f"Unsupported ASR device: {device}. Use cpu or cuda.",
        )
    if compute_type not in supported_compute:
        supported = ", ".join(sorted(supported_compute))
        raise AsrConfigurationError(
            "ASR_COMPUTE_UNSUPPORTED",
            f"Unsupported ASR compute type {compute_type} for {device}. Use one of: {supported}.",
        )
