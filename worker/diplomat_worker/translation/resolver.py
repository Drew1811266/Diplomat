from dataclasses import replace

from diplomat_worker.models.capabilities import RuntimeCapabilities
from diplomat_worker.models.registry import ModelRegistryEntry, get_model_entry
from diplomat_worker.storage.project_store import ProjectStore
from diplomat_worker.translation.config import TranslationProviderConfig


class TranslationConfigurationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


COMPUTE_TYPES_BY_DEVICE = {
    "cpu": {"int8", "float32"},
    "cuda": {"int8", "float16", "float32"},
}
LOCAL_TRANSLATION_PROVIDERS = {"ct2-marian", "local-llm"}


def resolve_translation_provider_config(
    config: TranslationProviderConfig,
    *,
    store: ProjectStore,
    registry: list[ModelRegistryEntry],
    fallback_source_language: str,
    fallback_target_language: str,
    allow_unmanaged_models: bool = False,
    runtime_capabilities: RuntimeCapabilities | None = None,
) -> TranslationProviderConfig:
    if config.provider in {"fake", "libretranslate"}:
        return config

    if config.provider not in LOCAL_TRANSLATION_PROVIDERS:
        raise TranslationConfigurationError(
            "TRANSLATION_PROVIDER_UNSUPPORTED",
            f"Unsupported translation provider: {config.provider}",
        )

    _validate_runtime_options(config.device, config.compute_type, runtime_capabilities)

    if not config.model_id:
        if allow_unmanaged_models and config.model_name_or_path:
            return config
        raise TranslationConfigurationError(
            "TRANSLATION_MODEL_REQUIRED",
            "Select an installed translation model before starting translation.",
        )

    try:
        entry = get_model_entry(config.model_id, registry)
    except KeyError as exc:
        raise TranslationConfigurationError(
            "TRANSLATION_MODEL_NOT_FOUND",
            f"Translation model is not in the curated registry: {config.model_id}",
        ) from exc

    _validate_entry_for_translation(entry, config.provider)
    _validate_language_pair(entry, fallback_source_language, fallback_target_language)

    installation = store.get_model_installation(
        entry.model_id,
        checksum=entry.checksum,
        total_bytes=entry.download_size_bytes,
    )
    if installation.status != "installed":
        raise TranslationConfigurationError(
            "TRANSLATION_MODEL_NOT_INSTALLED",
            f"Install {entry.name} from Models before starting translation.",
        )
    if installation.installed_path is None:
        raise TranslationConfigurationError(
            "TRANSLATION_MODEL_FILES_MISSING",
            f"Installed model path is missing for {entry.name}.",
        )

    store._assert_safe_model_path(installation.installed_path)
    if not installation.installed_path.exists():
        raise TranslationConfigurationError(
            "TRANSLATION_MODEL_FILES_MISSING",
            f"Installed model files are missing for {entry.name}: {installation.installed_path}",
        )

    return replace(
        config,
        model_name_or_path=str(installation.installed_path),
    )


def _validate_entry_for_translation(entry: ModelRegistryEntry, provider: str) -> None:
    if entry.task != "translation":
        raise TranslationConfigurationError(
            "TRANSLATION_MODEL_NOT_COMPATIBLE",
            f"{entry.name} is not a translation model.",
        )
    if entry.runtime != provider or entry.provider != provider:
        raise TranslationConfigurationError(
            "TRANSLATION_MODEL_NOT_COMPATIBLE",
            f"{entry.name} is not compatible with provider {provider}.",
        )


def _validate_language_pair(
    entry: ModelRegistryEntry,
    source_language: str,
    target_language: str,
) -> None:
    if (source_language, target_language) not in entry.language_pairs:
        raise TranslationConfigurationError(
            "TRANSLATION_LANGUAGE_PAIR_UNSUPPORTED",
            f"{entry.name} does not support translation from {source_language} to {target_language}.",
        )


def _validate_runtime_options(
    device: str,
    compute_type: str,
    runtime_capabilities: RuntimeCapabilities | None = None,
) -> None:
    supported_compute = COMPUTE_TYPES_BY_DEVICE.get(device)
    if supported_compute is None:
        raise TranslationConfigurationError(
            "TRANSLATION_DEVICE_UNSUPPORTED",
            f"Unsupported translation device: {device}. Use cpu or cuda.",
        )
    if (
        device == "cuda"
        and runtime_capabilities is not None
        and not runtime_capabilities.cuda_available
    ):
        raise TranslationConfigurationError(
            "TRANSLATION_CUDA_UNAVAILABLE",
            "CUDA is not available in this Worker runtime. Switch to CPU or install a working NVIDIA CUDA runtime.",
        )
    if compute_type not in supported_compute:
        supported = ", ".join(sorted(supported_compute))
        raise TranslationConfigurationError(
            "TRANSLATION_COMPUTE_UNSUPPORTED",
            f"Unsupported translation compute type {compute_type} for {device}. Use one of: {supported}.",
        )
