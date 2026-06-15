import hashlib
import sqlite3
from pathlib import Path

import pytest

from diplomat_worker.models.manager import (
    ModelDownloadManager,
    hf_manifest_checksum,
    parse_hf_snapshot_source_url,
)
from diplomat_worker.models.capabilities import RuntimeCapabilities
from diplomat_worker.models.registry import ModelRegistryEntry
from diplomat_worker.storage.project_store import ProjectStore


def make_entry(
    source_path: Path,
    checksum: str,
    model_id: str = "fixture-asr-light",
    task: str = "asr",
) -> ModelRegistryEntry:
    return ModelRegistryEntry(
        model_id=model_id,
        name="Fixture ASR Light",
        task=task,
        tier="light",
        runtime="faster-whisper" if task == "asr" else "ct2-marian",
        provider="faster-whisper" if task == "asr" else "ct2-marian",
        version="test",
        languages=["zh", "en"],
        language_pairs=[] if task == "asr" else [("zh", "en")],
        model_size_bytes=source_path.stat().st_size,
        download_size_bytes=source_path.stat().st_size,
        disk_requirement_bytes=source_path.stat().st_size,
        recommended_hardware="test hardware",
        license_name="MIT",
        license_url="https://example.invalid/license",
        source_url=str(source_path),
        checksum_algorithm="sha256",
        checksum=checksum,
        terms_summary="Test fixture model.",
    )


def write_fixture(tmp_path: Path, content: bytes = b"fixture model") -> tuple[Path, str]:
    source_path = tmp_path / "source-model.bin"
    source_path.write_bytes(content)
    checksum = hashlib.sha256(content).hexdigest()
    return source_path, checksum


def make_manager(
    tmp_path: Path,
    registry: list[ModelRegistryEntry],
) -> ModelDownloadManager:
    store = ProjectStore(tmp_path / "diplomat.db")
    return ModelDownloadManager(store, registry=registry, auto_start=False)


def test_parse_hf_snapshot_source_url_requires_pinned_revision() -> None:
    source = parse_hf_snapshot_source_url(
        "hf://Systran/faster-whisper-small@536b0662742c02347bc0e980a01041f333bce120"
    )

    assert source is not None
    assert source.repo_id == "Systran/faster-whisper-small"
    assert source.revision == "536b0662742c02347bc0e980a01041f333bce120"
    assert parse_hf_snapshot_source_url("https://huggingface.co/Systran/faster-whisper-small") is None
    assert parse_hf_snapshot_source_url("hf://Systran/faster-whisper-small") is None


def test_hf_manifest_checksum_uses_repo_revision_paths_sizes_and_hashes() -> None:
    checksum = hf_manifest_checksum(
        repo_id="example/model",
        revision="abc123",
        files=[
            {"path": "b.bin", "size": 2, "sha": "b" * 40},
            {"path": "a.json", "size": 1, "sha": "a" * 40},
        ],
    )

    assert checksum == "96802f57a5c04771f47b6d629268a1194452434538c48e02911b720163256b2e"


def test_model_download_installs_verified_local_fixture(tmp_path: Path) -> None:
    source_path, checksum = write_fixture(tmp_path)
    manager = make_manager(tmp_path, [make_entry(source_path, checksum)])

    response = manager.start_download("fixture-asr-light")
    assert response.status == "queued"

    manager.run_pending_once()
    catalog_entry = manager.get_catalog_entry("fixture-asr-light")

    assert catalog_entry.installation.status == "installed"
    assert catalog_entry.availability.usable is True
    installed_path = Path(catalog_entry.installation.installed_path or "")
    assert installed_path.is_dir()
    assert (installed_path / source_path.name).read_bytes() == b"fixture model"


def test_catalog_entry_includes_runtime_profiles(tmp_path: Path) -> None:
    source_path, checksum = write_fixture(tmp_path)
    manager = ModelDownloadManager(
        ProjectStore(tmp_path / "diplomat.db"),
        registry=[make_entry(source_path, checksum)],
        runtime_capabilities=RuntimeCapabilities(
            cuda_available=False,
            cuda_device_count=0,
            detected_by="test",
        ),
        auto_start=False,
    )

    catalog_entry = manager.get_catalog_entry("fixture-asr-light")

    assert catalog_entry.runtime_profiles[0].profile_id == "fixture-asr-light:cpu:int8"
    assert any(
        profile.reason == "CUDA is not available in this Worker runtime."
        for profile in catalog_entry.runtime_profiles
    )


def test_model_install_state_persists_across_store_recreation(tmp_path: Path) -> None:
    source_path, checksum = write_fixture(tmp_path)
    registry = [make_entry(source_path, checksum)]
    manager = make_manager(tmp_path, registry)
    manager.start_download("fixture-asr-light")
    manager.run_pending_once()

    restored_manager = make_manager(tmp_path, registry)
    catalog_entry = restored_manager.get_catalog_entry("fixture-asr-light")

    assert catalog_entry.installation.status == "installed"
    assert catalog_entry.availability.usable is True


def test_checksum_mismatch_marks_model_failed_and_unusable(tmp_path: Path) -> None:
    source_path, _checksum = write_fixture(tmp_path)
    manager = make_manager(tmp_path, [make_entry(source_path, "1" * 64)])

    manager.start_download("fixture-asr-light")
    manager.run_pending_once()
    catalog_entry = manager.get_catalog_entry("fixture-asr-light")

    assert catalog_entry.installation.status == "failed"
    assert catalog_entry.availability.usable is False
    assert "checksum" in (catalog_entry.installation.error_message or "").lower()


def test_cancel_queued_download_marks_model_canceled(tmp_path: Path) -> None:
    source_path, checksum = write_fixture(tmp_path)
    manager = make_manager(tmp_path, [make_entry(source_path, checksum)])

    manager.start_download("fixture-asr-light")
    response = manager.cancel_download("fixture-asr-light")
    manager.run_pending_once()

    assert response.status == "canceled"
    assert manager.get_catalog_entry("fixture-asr-light").installation.status == "canceled"


def test_retry_failed_download_can_install_after_registry_fix(tmp_path: Path) -> None:
    source_path, checksum = write_fixture(tmp_path)
    bad_manager = make_manager(tmp_path, [make_entry(source_path, "1" * 64)])
    bad_manager.start_download("fixture-asr-light")
    bad_manager.run_pending_once()
    assert bad_manager.get_catalog_entry("fixture-asr-light").installation.status == "failed"

    fixed_manager = make_manager(tmp_path, [make_entry(source_path, checksum)])
    retry = fixed_manager.retry_download("fixture-asr-light")
    fixed_manager.run_pending_once()

    assert retry.status == "queued"
    assert fixed_manager.get_catalog_entry("fixture-asr-light").installation.status == "installed"


def test_delete_model_removes_only_safe_model_directory(tmp_path: Path) -> None:
    source_path, checksum = write_fixture(tmp_path)
    manager = make_manager(tmp_path, [make_entry(source_path, checksum)])
    manager.start_download("fixture-asr-light")
    manager.run_pending_once()
    installed_path = Path(
        manager.get_catalog_entry("fixture-asr-light").installation.installed_path or ""
    )

    result = manager.delete_model("fixture-asr-light")

    assert result.files_deleted == 1
    assert result.bytes_deleted == len(b"fixture model")
    assert not installed_path.exists()
    assert manager.get_catalog_entry("fixture-asr-light").installation.status == "not_installed"


def test_delete_model_refuses_unsafe_installed_path(tmp_path: Path) -> None:
    source_path, checksum = write_fixture(tmp_path)
    manager = make_manager(tmp_path, [make_entry(source_path, checksum)])
    unsafe_dir = tmp_path.parent / f"{tmp_path.name}-outside-model"
    unsafe_dir.mkdir()
    (unsafe_dir / "model.bin").write_bytes(b"unsafe")
    with sqlite3.connect(manager.store.database_path) as connection:
        connection.execute(
            """
            INSERT INTO model_installations (
                model_id,
                status,
                installed_path,
                downloaded_bytes,
                total_bytes,
                checksum,
                error_message,
                created_at,
                updated_at,
                installed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "fixture-asr-light",
                "installed",
                str(unsafe_dir),
                6,
                6,
                checksum,
                None,
                "2026-06-14T00:00:00+00:00",
                "2026-06-14T00:00:00+00:00",
                "2026-06-14T00:00:00+00:00",
            ),
        )
        connection.commit()

    with pytest.raises(ValueError, match="unsafe model"):
        manager.delete_model("fixture-asr-light")

    assert unsafe_dir.exists()
