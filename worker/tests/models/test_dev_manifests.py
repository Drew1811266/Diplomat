import json
from pathlib import Path

from diplomat_worker.models.dev_manifests import (
    development_readiness,
    get_development_manifest,
    load_development_manifests,
    repo_root,
)
from diplomat_worker.models.manager import ModelDownloadManager
from diplomat_worker.models.registry import built_in_model_registry, get_model_entry
from diplomat_worker.storage.project_store import ProjectStore


def copy_manifest_fixture(root: Path, filename: str, *, create_development_dir: bool = True) -> dict:
    source = repo_root() / "models" / "manifests" / filename
    payload = json.loads(source.read_text(encoding="utf-8"))
    manifest_dir = root / "models" / "manifests"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    (manifest_dir / filename).write_text(json.dumps(payload), encoding="utf-8")
    if create_development_dir:
        development_dir = root / payload["developmentPath"]
        development_dir.mkdir(parents=True, exist_ok=True)
        (development_dir / ".gitkeep").write_text("", encoding="utf-8")
    return payload


def test_development_manifests_load_approved_model_targets() -> None:
    manifests = load_development_manifests()

    model_ids = {manifest.model_id for manifest in manifests}
    assert "asr.microsoft.vibevoice-asr" in model_ids
    assert "translation.tencent.hunyuan-mt-7b-fp8" in model_ids

    vibevoice = get_development_manifest("asr.microsoft.vibevoice-asr", manifests)
    assert vibevoice.source.repo_id == "microsoft/VibeVoice-ASR"
    assert vibevoice.license.acceptance_required is False
    assert vibevoice.development_path == Path("models/dev/asr/microsoft--VibeVoice-ASR")
    assert len([item for item in vibevoice.expected_files if item.endswith(".safetensors")]) == 8


def test_hunyuan_manifest_declares_restricted_external_model_policy() -> None:
    payload = json.loads(
        (repo_root() / "models" / "manifests" / "hunyuan-mt-7b-fp8.json").read_text(
            encoding="utf-8"
        )
    )

    license_payload = payload["license"]
    assert license_payload["licenseType"] == "restricted-external-model"
    assert license_payload["sourceCodeLicenseCompatible"] is True
    assert license_payload["redistributionAllowed"] is False
    assert license_payload["modelWeightsBundled"] is False
    assert license_payload["userProvidedOnly"] is True
    assert license_payload["excludedTerritories"] == [
        "European Union",
        "United Kingdom",
        "South Korea",
    ]


def test_missing_development_directory_returns_safe_readiness_reason(tmp_path: Path) -> None:
    copy_manifest_fixture(tmp_path, "vibevoice-asr.json", create_development_dir=False)
    manifest = get_development_manifest(
        "asr.microsoft.vibevoice-asr",
        load_development_manifests(tmp_path),
    )

    readiness = development_readiness(manifest, tmp_path)

    assert readiness.usable is False
    assert readiness.reason == "Development model directory is missing."


def test_missing_expected_files_returns_safe_readiness_reason(tmp_path: Path) -> None:
    copy_manifest_fixture(tmp_path, "vibevoice-asr.json")
    manifest = get_development_manifest(
        "asr.microsoft.vibevoice-asr",
        load_development_manifests(tmp_path),
    )

    readiness = development_readiness(manifest, tmp_path)

    assert readiness.usable is False
    assert readiness.reason is not None
    assert readiness.reason.startswith("Development model files are missing:")
    for expected_file in [
        "config.json",
        "model-00001-of-00008.safetensors",
        "model-00008-of-00008.safetensors",
        "model.safetensors.index.json",
        "qwen-tokenizer/tokenizer.json",
    ]:
        assert expected_file in readiness.reason


def test_license_required_model_is_blocked_until_acceptance_record_exists(tmp_path: Path) -> None:
    copy_manifest_fixture(tmp_path, "hunyuan-mt-7b-fp8.json")
    manifest = get_development_manifest(
        "translation.tencent.hunyuan-mt-7b-fp8",
        load_development_manifests(tmp_path),
    )

    blocked = development_readiness(manifest, tmp_path)

    assert blocked.usable is False
    assert blocked.reason == "Model license acceptance is required."

    acceptance_record = tmp_path / (manifest.license.acceptance_record or Path())
    acceptance_record.parent.mkdir(parents=True, exist_ok=True)
    acceptance_record.write_text(
        json.dumps(
            {
                "schemaVersion": "diplomat.licenseAcceptance.v1",
                "modelId": manifest.model_id,
                "licenseUrl": manifest.license.url,
                "restrictedLicenseAcknowledged": True,
                "permittedTerritoryConfirmed": True,
                "noRedistributionConfirmed": True,
            }
        ),
        encoding="utf-8",
    )
    development_dir = tmp_path / manifest.development_path
    for expected_file in manifest.expected_files:
        (development_dir / expected_file).write_text("fixture", encoding="utf-8")

    ready = development_readiness(manifest, tmp_path)

    assert ready.usable is True
    assert ready.reason is None


def test_hunyuan_incomplete_acceptance_record_stays_blocked(tmp_path: Path) -> None:
    copy_manifest_fixture(tmp_path, "hunyuan-mt-7b-fp8.json")
    manifest = get_development_manifest(
        "translation.tencent.hunyuan-mt-7b-fp8",
        load_development_manifests(tmp_path),
    )
    acceptance_record = tmp_path / (manifest.license.acceptance_record or Path())
    acceptance_record.parent.mkdir(parents=True, exist_ok=True)
    acceptance_record.write_text('{"accepted": true}', encoding="utf-8")

    readiness = development_readiness(manifest, tmp_path)

    assert readiness.usable is False
    assert readiness.reason == "Model license acceptance record is incomplete."


def test_catalog_reports_development_model_readiness_without_installation(
    tmp_path: Path,
) -> None:
    copy_manifest_fixture(tmp_path, "vibevoice-asr.json")
    entry = get_model_entry("asr.microsoft.vibevoice-asr", built_in_model_registry())
    manager = ModelDownloadManager(
        ProjectStore(tmp_path / "diplomat.db"),
        registry=[entry],
        development_model_root=tmp_path,
        auto_start=False,
    )

    catalog_entry = manager.get_catalog_entry(entry.model_id)

    assert catalog_entry.installation.status == "not_installed"
    assert catalog_entry.availability.usable is False
    assert catalog_entry.availability.reason is not None
    assert catalog_entry.availability.reason.startswith("Development model files are missing:")
