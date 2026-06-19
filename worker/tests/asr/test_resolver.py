from pathlib import Path

import pytest

from diplomat_worker.asr.config import AsrModelConfig
from diplomat_worker.asr.resolver import AsrConfigurationError, resolve_asr_model_config
from diplomat_worker.models.capabilities import RuntimeCapabilities
from diplomat_worker.models.registry import ModelRegistryEntry
from diplomat_worker.storage.project_store import ProjectStore


def make_entry(
    model_id: str = "asr.fixture.small",
    task: str = "asr",
    runtime: str = "faster-whisper",
    provider: str = "faster-whisper",
    languages: list[str] | None = None,
) -> ModelRegistryEntry:
    return ModelRegistryEntry(
        model_id=model_id,
        name="Fixture ASR",
        task=task,
        tier="light",
        runtime=runtime,
        provider=provider,
        version="test",
        languages=languages or ["zh", "en"],
        language_pairs=[] if task == "asr" else [("zh", "en")],
        model_size_bytes=12,
        download_size_bytes=12,
        disk_requirement_bytes=12,
        recommended_hardware="test hardware",
        license_name="MIT",
        license_url="https://example.invalid/license",
        source_url="https://example.invalid/model.bin",
        checksum_algorithm="sha256",
        checksum="a" * 64,
        terms_summary="Test fixture model.",
    )


def make_store(tmp_path: Path) -> ProjectStore:
    return ProjectStore(tmp_path / "diplomat.db")


def install_entry(store: ProjectStore, entry: ModelRegistryEntry, create_files: bool = True) -> Path:
    installed_path = store.safe_model_dir(entry.model_id)
    if create_files:
        installed_path.mkdir(parents=True, exist_ok=True)
        (installed_path / "model.bin").write_bytes(b"fixture")
    store.upsert_model_installation(
        model_id=entry.model_id,
        status="installed",
        installed_path=installed_path,
        downloaded_bytes=entry.download_size_bytes,
        total_bytes=entry.download_size_bytes,
        checksum=entry.checksum,
        installed=True,
    )
    return installed_path


def resolve(
    tmp_path: Path,
    config: AsrModelConfig,
    registry: list[ModelRegistryEntry],
    fallback_language: str = "zh",
) -> AsrModelConfig:
    return resolve_asr_model_config(
        config,
        store=make_store(tmp_path),
        registry=registry,
        fallback_language=fallback_language,
    )


def assert_asr_error(code: str, func) -> None:
    with pytest.raises(AsrConfigurationError) as exc_info:
        func()
    assert exc_info.value.code == code
    assert exc_info.value.message


def test_resolver_requires_model_id_for_formal_faster_whisper(tmp_path: Path) -> None:
    assert_asr_error(
        "ASR_MODEL_REQUIRED",
        lambda: resolve(
            tmp_path,
            AsrModelConfig(provider="faster-whisper"),
            [make_entry()],
        ),
    )


def test_resolver_rejects_unknown_model_id(tmp_path: Path) -> None:
    assert_asr_error(
        "ASR_MODEL_NOT_FOUND",
        lambda: resolve(
            tmp_path,
            AsrModelConfig(provider="faster-whisper", model_id="missing-model"),
            [make_entry()],
        ),
    )


def test_resolver_rejects_non_asr_model(tmp_path: Path) -> None:
    translation = make_entry(
        model_id="translation.fixture",
        task="translation",
        runtime="ct2-marian",
        provider="ct2-marian",
    )

    assert_asr_error(
        "ASR_MODEL_NOT_COMPATIBLE",
        lambda: resolve(
            tmp_path,
            AsrModelConfig(provider="faster-whisper", model_id=translation.model_id),
            [translation],
        ),
    )


def test_resolver_rejects_unsupported_language(tmp_path: Path) -> None:
    entry = make_entry(languages=["en"])
    store = make_store(tmp_path)
    install_entry(store, entry)

    assert_asr_error(
        "ASR_LANGUAGE_UNSUPPORTED",
        lambda: resolve_asr_model_config(
            AsrModelConfig(provider="faster-whisper", model_id=entry.model_id, source_language="zh"),
            store=store,
            registry=[entry],
            fallback_language="zh",
        ),
    )


def test_resolver_rejects_uninstalled_model(tmp_path: Path) -> None:
    entry = make_entry()

    assert_asr_error(
        "ASR_MODEL_NOT_INSTALLED",
        lambda: resolve(
            tmp_path,
            AsrModelConfig(provider="faster-whisper", model_id=entry.model_id),
            [entry],
        ),
    )


def test_resolver_rejects_missing_installed_files(tmp_path: Path) -> None:
    entry = make_entry()
    store = make_store(tmp_path)
    install_entry(store, entry, create_files=False)

    assert_asr_error(
        "ASR_MODEL_FILES_MISSING",
        lambda: resolve_asr_model_config(
            AsrModelConfig(provider="faster-whisper", model_id=entry.model_id),
            store=store,
            registry=[entry],
            fallback_language="zh",
        ),
    )


def test_resolver_returns_installed_path_for_curated_asr_model(tmp_path: Path) -> None:
    entry = make_entry()
    store = make_store(tmp_path)
    installed_path = install_entry(store, entry)

    resolved = resolve_asr_model_config(
        AsrModelConfig(provider="faster-whisper", model_id=entry.model_id),
        store=store,
        registry=[entry],
        fallback_language="zh",
    )

    assert resolved.provider == "faster-whisper"
    assert resolved.model_id == entry.model_id
    assert resolved.model_name_or_path == str(installed_path)
    assert resolved.source_language == "zh"


def test_resolver_returns_installed_path_for_vibevoice_asr_model(tmp_path: Path) -> None:
    entry = make_entry(
        model_id="asr.microsoft.vibevoice-asr",
        runtime="vibevoice-asr",
        provider="microsoft",
    )
    store = make_store(tmp_path)
    installed_path = install_entry(store, entry)

    resolved = resolve_asr_model_config(
        AsrModelConfig(
            provider="vibevoice-asr",
            model_id=entry.model_id,
            device="cuda",
            compute_type="bfloat16",
        ),
        store=store,
        registry=[entry],
        fallback_language="zh",
        runtime_capabilities=RuntimeCapabilities(cuda_available=True),
    )

    assert resolved.provider == "vibevoice-asr"
    assert resolved.model_name_or_path == str(installed_path)
    assert resolved.compute_type == "bfloat16"


def test_resolver_accepts_curated_unmanaged_vibevoice_path_for_acceptance(tmp_path: Path) -> None:
    entry = make_entry(
        model_id="asr.microsoft.vibevoice-asr",
        runtime="vibevoice-asr",
        provider="microsoft",
    )
    dev_path = tmp_path / "models-dev" / "vibevoice"
    dev_path.mkdir(parents=True)

    resolved = resolve_asr_model_config(
        AsrModelConfig(
            provider="vibevoice-asr",
            model_id=entry.model_id,
            model_name_or_path=str(dev_path),
            device="cuda",
            compute_type="bfloat16",
        ),
        store=make_store(tmp_path),
        registry=[entry],
        fallback_language="zh",
        allow_unmanaged_models=True,
        runtime_capabilities=RuntimeCapabilities(cuda_available=True),
    )

    assert resolved.provider == "vibevoice-asr"
    assert resolved.model_id == entry.model_id
    assert resolved.model_name_or_path == str(dev_path)


def test_resolver_rejects_vibevoice_without_cuda(tmp_path: Path) -> None:
    entry = make_entry(
        model_id="asr.microsoft.vibevoice-asr",
        runtime="vibevoice-asr",
        provider="microsoft",
    )
    store = make_store(tmp_path)
    install_entry(store, entry)

    assert_asr_error(
        "ASR_DEVICE_UNSUPPORTED",
        lambda: resolve_asr_model_config(
            AsrModelConfig(
                provider="vibevoice-asr",
                model_id=entry.model_id,
                device="cpu",
                compute_type="float32",
            ),
            store=store,
            registry=[entry],
            fallback_language="zh",
        ),
    )


def test_resolver_rejects_vibevoice_int8(tmp_path: Path) -> None:
    entry = make_entry(
        model_id="asr.microsoft.vibevoice-asr",
        runtime="vibevoice-asr",
        provider="microsoft",
    )
    store = make_store(tmp_path)
    install_entry(store, entry)

    assert_asr_error(
        "ASR_COMPUTE_UNSUPPORTED",
        lambda: resolve_asr_model_config(
            AsrModelConfig(
                provider="vibevoice-asr",
                model_id=entry.model_id,
                device="cuda",
                compute_type="int8",
            ),
            store=store,
            registry=[entry],
            fallback_language="zh",
            runtime_capabilities=RuntimeCapabilities(cuda_available=True),
        ),
    )


def test_resolver_rejects_cpu_float16_and_accepts_cuda_float16(tmp_path: Path) -> None:
    entry = make_entry()
    store = make_store(tmp_path)
    installed_path = install_entry(store, entry)

    assert_asr_error(
        "ASR_COMPUTE_UNSUPPORTED",
        lambda: resolve_asr_model_config(
            AsrModelConfig(
                provider="faster-whisper",
                model_id=entry.model_id,
                device="cpu",
                compute_type="float16",
            ),
            store=store,
            registry=[entry],
            fallback_language="zh",
        ),
    )

    resolved = resolve_asr_model_config(
        AsrModelConfig(
            provider="faster-whisper",
            model_id=entry.model_id,
            device="cuda",
            compute_type="float16",
        ),
        store=store,
        registry=[entry],
        fallback_language="zh",
    )

    assert resolved.model_name_or_path == str(installed_path)
    assert resolved.device == "cuda"
    assert resolved.compute_type == "float16"


def test_resolver_rejects_cuda_when_runtime_reports_unavailable(tmp_path: Path) -> None:
    entry = make_entry()
    store = make_store(tmp_path)
    install_entry(store, entry)

    assert_asr_error(
        "ASR_CUDA_UNAVAILABLE",
        lambda: resolve_asr_model_config(
            AsrModelConfig(
                provider="faster-whisper",
                model_id=entry.model_id,
                device="cuda",
                compute_type="float16",
            ),
            store=store,
            registry=[entry],
            fallback_language="zh",
            runtime_capabilities=RuntimeCapabilities(cuda_available=False),
        ),
    )
