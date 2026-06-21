from dataclasses import replace
from pathlib import Path

from diplomat_worker.asr.config import AsrModelConfig
from diplomat_worker.models.capabilities import RuntimeCapabilities
from diplomat_worker.models.dev_manifests import (
    development_model_path,
    development_readiness,
    get_development_manifest,
)
from diplomat_worker.models.registry import ModelRegistryEntry, get_model_entry
from diplomat_worker.storage.project_store import ProjectStore


class AsrConfigurationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


COMPUTE_TYPES_BY_DEVICE = {
    "cpu": {"int8", "float32"},
    "cuda": {"int8", "float16", "bfloat16", "float32"},
}
VIBEVOICE_COMPUTE_TYPES = {"float16", "bfloat16", "float32"}


def resolve_asr_model_config(
    config: AsrModelConfig,
    *,
    store: ProjectStore,
    registry: list[ModelRegistryEntry],
    fallback_language: str,
    allow_unmanaged_models: bool = False,
    runtime_capabilities: RuntimeCapabilities | None = None,
    development_model_root: Path | None = None,
) -> AsrModelConfig:
    language = config.source_language or fallback_language
    _validate_runtime_options(config.device, config.compute_type, runtime_capabilities)

    if config.provider == "fake":
        return replace(config, source_language=language)

    if config.provider not in {"faster-whisper", "vibevoice-asr"}:
        raise AsrConfigurationError(
            "ASR_PROVIDER_UNSUPPORTED",
            f"Unsupported ASR provider: {config.provider}",
        )
    if config.provider == "vibevoice-asr":
        _validate_vibevoice_runtime_options(config.device, config.compute_type)

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

    _validate_entry_for_asr(entry, config.provider)
    if language not in entry.languages:
        raise AsrConfigurationError(
            "ASR_LANGUAGE_UNSUPPORTED",
            f"{entry.name} does not support source language: {language}",
        )

    if allow_unmanaged_models and config.model_name_or_path:
        model_path = Path(config.model_name_or_path)
        if not model_path.exists():
            raise AsrConfigurationError(
                "ASR_MODEL_FILES_MISSING",
                f"ASR model files are missing for {entry.name}: {model_path}",
            )
        return replace(config, source_language=language, model_name_or_path=str(model_path))

    installation = store.get_model_installation(
        entry.model_id,
        checksum=entry.checksum,
        total_bytes=entry.download_size_bytes,
    )
    if installation.status != "installed":
        development_path, development_reason = _development_model_resolution(
            entry,
            development_model_root,
        )
        if development_path is not None:
            return replace(
                config,
                source_language=language,
                model_name_or_path=str(development_path),
            )
        if development_reason is not None:
            raise AsrConfigurationError(
                "ASR_MODEL_NOT_INSTALLED",
                f"Development model is not ready for {entry.name}: {development_reason}",
            )
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


def _development_model_resolution(
    entry: ModelRegistryEntry,
    root: Path | None,
) -> tuple[Path | None, str | None]:
    try:
        manifest = get_development_manifest(entry.model_id, root=root)
    except KeyError:
        return None, None
    readiness = development_readiness(manifest, root)
    if not readiness.usable:
        return None, readiness.reason
    return development_model_path(manifest, root), None


def _validate_entry_for_asr(entry: ModelRegistryEntry, provider: str) -> None:
    if provider == "faster-whisper":
        compatible = entry.task == "asr" and entry.runtime == "faster-whisper" and entry.provider == "faster-whisper"
        expected = "a faster-whisper ASR model"
    else:
        compatible = entry.task == "asr" and entry.runtime == "vibevoice-asr"
        expected = "a VibeVoice ASR model"
    if not compatible:
        raise AsrConfigurationError(
            "ASR_MODEL_NOT_COMPATIBLE",
            f"{entry.name} is not {expected}.",
        )


def _validate_vibevoice_runtime_options(device: str, compute_type: str) -> None:
    if device != "cuda":
        raise AsrConfigurationError(
            "ASR_DEVICE_UNSUPPORTED",
            "VibeVoice ASR requires CUDA for 0.4 development.",
        )
    if compute_type not in VIBEVOICE_COMPUTE_TYPES:
        supported = ", ".join(sorted(VIBEVOICE_COMPUTE_TYPES))
        raise AsrConfigurationError(
            "ASR_COMPUTE_UNSUPPORTED",
            f"Unsupported VibeVoice ASR compute type {compute_type}. Use one of: {supported}.",
        )


def _validate_runtime_options(
    device: str,
    compute_type: str,
    runtime_capabilities: RuntimeCapabilities | None = None,
) -> None:
    supported_compute = COMPUTE_TYPES_BY_DEVICE.get(device)
    if supported_compute is None:
        raise AsrConfigurationError(
            "ASR_DEVICE_UNSUPPORTED",
            f"Unsupported ASR device: {device}. Use cpu or cuda.",
        )
    if (
        device == "cuda"
        and runtime_capabilities is not None
        and not runtime_capabilities.cuda_available
    ):
        raise AsrConfigurationError(
            "ASR_CUDA_UNAVAILABLE",
            "CUDA is not available in this Worker runtime. Switch to CPU or install a working NVIDIA CUDA runtime.",
        )
    if compute_type not in supported_compute:
        supported = ", ".join(sorted(supported_compute))
        raise AsrConfigurationError(
            "ASR_COMPUTE_UNSUPPORTED",
            f"Unsupported ASR compute type {compute_type} for {device}. Use one of: {supported}.",
        )
