from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "diplomat.modelManifest.v1"
LICENSE_ACCEPTANCE_SCHEMA_VERSION = "diplomat.licenseAcceptance.v1"
HUNYUAN_MODEL_ID = "translation.tencent.hunyuan-mt-7b-fp8"


@dataclass(frozen=True)
class ModelManifestSource:
    type: str
    repo_id: str
    revision: str
    url: str


@dataclass(frozen=True)
class ModelManifestLicense:
    name: str
    url: str
    acceptance_required: bool
    acceptance_record: Path | None


@dataclass(frozen=True)
class ModelDevelopmentManifest:
    model_id: str
    name: str
    task: str
    runtime: str
    provider: str
    source: ModelManifestSource
    license: ModelManifestLicense
    development_path: Path
    expected_files: list[str]


@dataclass(frozen=True)
class DevelopmentModelReadiness:
    usable: bool
    reason: str | None


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def load_development_manifests(root: Path | None = None) -> list[ModelDevelopmentManifest]:
    base = root or repo_root()
    manifest_dir = base / "models" / "manifests"
    if not manifest_dir.exists():
        return []

    manifests = [
        _manifest_from_payload(json.loads(path.read_text(encoding="utf-8")))
        for path in sorted(manifest_dir.glob("*.json"))
    ]
    model_ids = [manifest.model_id for manifest in manifests]
    if len(set(model_ids)) != len(model_ids):
        raise ValueError("Development model manifests contain duplicate model IDs.")
    return manifests


def get_development_manifest(
    model_id: str,
    manifests: list[ModelDevelopmentManifest] | None = None,
    root: Path | None = None,
) -> ModelDevelopmentManifest:
    available_manifests = manifests if manifests is not None else load_development_manifests(root)
    for manifest in available_manifests:
        if manifest.model_id == model_id:
            return manifest
    raise KeyError(f"Development model manifest not found: {model_id}")


def development_readiness(
    manifest: ModelDevelopmentManifest,
    root: Path | None = None,
) -> DevelopmentModelReadiness:
    base = root or repo_root()
    development_dir = _rooted_path(base, manifest.development_path)
    if not development_dir.is_dir():
        return DevelopmentModelReadiness(
            usable=False,
            reason="Development model directory is missing.",
        )

    if manifest.license.acceptance_required:
        acceptance_record = manifest.license.acceptance_record
        if acceptance_record is None:
            return DevelopmentModelReadiness(
                usable=False,
                reason="Model license acceptance is required.",
            )
        acceptance_path = _rooted_path(base, acceptance_record)
        if not acceptance_path.is_file():
            return DevelopmentModelReadiness(
                usable=False,
                reason="Model license acceptance is required.",
            )
        if not _valid_acceptance_record(acceptance_path, manifest):
            return DevelopmentModelReadiness(
                usable=False,
                reason="Model license acceptance record is incomplete.",
            )

    missing_files = [
        expected_file
        for expected_file in manifest.expected_files
        if not (development_dir / expected_file).is_file()
    ]
    if missing_files:
        return DevelopmentModelReadiness(
            usable=False,
            reason=f"Development model files are missing: {', '.join(missing_files)}",
        )

    return DevelopmentModelReadiness(usable=True, reason=None)


def _manifest_from_payload(payload: dict[str, Any]) -> ModelDevelopmentManifest:
    if payload.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError("Unsupported development model manifest schema version.")

    source = payload.get("source")
    if not isinstance(source, dict):
        raise ValueError("Development model manifest source is required.")

    license_payload = payload.get("license")
    if not isinstance(license_payload, dict):
        raise ValueError("Development model manifest license is required.")

    expected_files = payload.get("expectedFiles")
    if not isinstance(expected_files, list) or not expected_files:
        raise ValueError("Development model manifest expectedFiles must be a non-empty list.")

    acceptance_record = license_payload.get("acceptanceRecord")
    return ModelDevelopmentManifest(
        model_id=_required_string(payload, "modelId"),
        name=_required_string(payload, "name"),
        task=_required_string(payload, "task"),
        runtime=_required_string(payload, "runtime"),
        provider=_required_string(payload, "provider"),
        source=ModelManifestSource(
            type=_required_string(source, "type"),
            repo_id=_required_string(source, "repoId"),
            revision=_required_string(source, "revision"),
            url=_required_string(source, "url"),
        ),
        license=ModelManifestLicense(
            name=_required_string(license_payload, "name"),
            url=_required_string(license_payload, "url"),
            acceptance_required=bool(license_payload.get("acceptanceRequired", False)),
            acceptance_record=Path(acceptance_record) if acceptance_record else None,
        ),
        development_path=Path(_required_string(payload, "developmentPath")),
        expected_files=[str(item) for item in expected_files],
    )


def _required_string(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Development model manifest field is required: {key}")
    return value


def _rooted_path(root: Path, path: Path) -> Path:
    return path if path.is_absolute() else root / path


def _valid_acceptance_record(path: Path, manifest: ModelDevelopmentManifest) -> bool:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False

    if payload.get("schemaVersion") != LICENSE_ACCEPTANCE_SCHEMA_VERSION:
        return False
    if payload.get("modelId") != manifest.model_id:
        return False
    if payload.get("licenseUrl") != manifest.license.url:
        return False

    if manifest.model_id == HUNYUAN_MODEL_ID:
        return (
            payload.get("restrictedLicenseAcknowledged") is True
            and payload.get("permittedTerritoryConfirmed") is True
            and payload.get("noRedistributionConfirmed") is True
        )

    return True
