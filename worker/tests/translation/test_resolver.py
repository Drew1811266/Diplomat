from pathlib import Path

import pytest

from diplomat_worker.models.registry import ModelRegistryEntry
from diplomat_worker.storage.project_store import ProjectStore
from diplomat_worker.translation.config import TranslationProviderConfig
from diplomat_worker.translation.resolver import (
    TranslationConfigurationError,
    resolve_translation_provider_config,
)


def make_entry(
    model_id: str = "translation.fixture.zh-en",
    task: str = "translation",
    runtime: str = "ct2-marian",
    provider: str = "ct2-marian",
    language_pairs: list[tuple[str, str]] | None = None,
) -> ModelRegistryEntry:
    return ModelRegistryEntry(
        model_id=model_id,
        name="Fixture Translation",
        task=task,
        tier="light",
        runtime=runtime,
        provider=provider,
        version="test",
        languages=["zh", "en"],
        language_pairs=language_pairs or [("zh", "en")],
        model_size_bytes=12,
        download_size_bytes=12,
        disk_requirement_bytes=12,
        recommended_hardware="test hardware",
        license_name="MIT",
        license_url="https://example.invalid/license",
        source_url="https://example.invalid/model.bin",
        checksum_algorithm="sha256",
        checksum="b" * 64,
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
    config: TranslationProviderConfig,
    registry: list[ModelRegistryEntry],
    source_language: str = "zh",
    target_language: str = "en",
) -> TranslationProviderConfig:
    return resolve_translation_provider_config(
        config,
        store=make_store(tmp_path),
        registry=registry,
        fallback_source_language=source_language,
        fallback_target_language=target_language,
    )


def assert_translation_error(code: str, func) -> None:
    with pytest.raises(TranslationConfigurationError) as exc_info:
        func()
    assert exc_info.value.code == code
    assert exc_info.value.message


def test_resolver_requires_model_id_for_formal_ct2_marian(tmp_path: Path) -> None:
    assert_translation_error(
        "TRANSLATION_MODEL_REQUIRED",
        lambda: resolve(
            tmp_path,
            TranslationProviderConfig(provider="ct2-marian"),
            [make_entry()],
        ),
    )


def test_resolver_rejects_unknown_model_id(tmp_path: Path) -> None:
    assert_translation_error(
        "TRANSLATION_MODEL_NOT_FOUND",
        lambda: resolve(
            tmp_path,
            TranslationProviderConfig(provider="ct2-marian", model_id="missing-model"),
            [make_entry()],
        ),
    )


def test_resolver_rejects_non_translation_model(tmp_path: Path) -> None:
    asr = make_entry(
        model_id="asr.fixture.small",
        task="asr",
        runtime="faster-whisper",
        provider="faster-whisper",
        language_pairs=[],
    )

    assert_translation_error(
        "TRANSLATION_MODEL_NOT_COMPATIBLE",
        lambda: resolve(
            tmp_path,
            TranslationProviderConfig(provider="ct2-marian", model_id=asr.model_id),
            [asr],
        ),
    )


def test_resolver_rejects_wrong_local_provider_runtime(tmp_path: Path) -> None:
    entry = make_entry()

    assert_translation_error(
        "TRANSLATION_MODEL_NOT_COMPATIBLE",
        lambda: resolve(
            tmp_path,
            TranslationProviderConfig(provider="local-llm", model_id=entry.model_id),
            [entry],
        ),
    )


def test_resolver_rejects_unsupported_language_pair(tmp_path: Path) -> None:
    entry = make_entry(language_pairs=[("zh", "en")])
    store = make_store(tmp_path)
    install_entry(store, entry)

    assert_translation_error(
        "TRANSLATION_LANGUAGE_PAIR_UNSUPPORTED",
        lambda: resolve_translation_provider_config(
            TranslationProviderConfig(provider="ct2-marian", model_id=entry.model_id),
            store=store,
            registry=[entry],
            fallback_source_language="en",
            fallback_target_language="zh",
        ),
    )


def test_resolver_rejects_uninstalled_model(tmp_path: Path) -> None:
    entry = make_entry()

    assert_translation_error(
        "TRANSLATION_MODEL_NOT_INSTALLED",
        lambda: resolve(
            tmp_path,
            TranslationProviderConfig(provider="ct2-marian", model_id=entry.model_id),
            [entry],
        ),
    )


def test_resolver_rejects_missing_installed_files(tmp_path: Path) -> None:
    entry = make_entry()
    store = make_store(tmp_path)
    install_entry(store, entry, create_files=False)

    assert_translation_error(
        "TRANSLATION_MODEL_FILES_MISSING",
        lambda: resolve_translation_provider_config(
            TranslationProviderConfig(provider="ct2-marian", model_id=entry.model_id),
            store=store,
            registry=[entry],
            fallback_source_language="zh",
            fallback_target_language="en",
        ),
    )


def test_resolver_returns_installed_path_for_curated_translation_model(tmp_path: Path) -> None:
    entry = make_entry()
    store = make_store(tmp_path)
    installed_path = install_entry(store, entry)

    resolved = resolve_translation_provider_config(
        TranslationProviderConfig(provider="ct2-marian", model_id=entry.model_id),
        store=store,
        registry=[entry],
        fallback_source_language="zh",
        fallback_target_language="en",
    )

    assert resolved.provider == "ct2-marian"
    assert resolved.model_id == entry.model_id
    assert resolved.model_name_or_path == str(installed_path)


def test_resolver_rejects_cpu_float16_and_accepts_cuda_float16(tmp_path: Path) -> None:
    entry = make_entry()
    store = make_store(tmp_path)
    installed_path = install_entry(store, entry)

    assert_translation_error(
        "TRANSLATION_COMPUTE_UNSUPPORTED",
        lambda: resolve_translation_provider_config(
            TranslationProviderConfig(
                provider="ct2-marian",
                model_id=entry.model_id,
                device="cpu",
                compute_type="float16",
            ),
            store=store,
            registry=[entry],
            fallback_source_language="zh",
            fallback_target_language="en",
        ),
    )

    resolved = resolve_translation_provider_config(
        TranslationProviderConfig(
            provider="ct2-marian",
            model_id=entry.model_id,
            device="cuda",
            compute_type="float16",
        ),
        store=store,
        registry=[entry],
        fallback_source_language="zh",
        fallback_target_language="en",
    )

    assert resolved.model_name_or_path == str(installed_path)
    assert resolved.device == "cuda"
    assert resolved.compute_type == "float16"
