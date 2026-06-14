from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal, Mapping
from urllib.parse import urlparse

from diplomat_worker import __version__ as EXPECTED_RELEASE_VERSION
from diplomat_worker.models.registry import ModelRegistryEntry

ReleaseSeverity = Literal["pass", "warning", "blocker"]


@dataclass(frozen=True)
class ReleaseReadinessCheck:
    id: str
    label: str
    severity: ReleaseSeverity
    message: str
    remediation: str | None = None


@dataclass(frozen=True)
class ReleaseReadinessReport:
    version: str
    generated_at: str
    ready: bool
    summary: dict[str, int]
    checks: list[ReleaseReadinessCheck]


def build_release_readiness_report(
    *,
    version: str,
    registry: list[ModelRegistryEntry],
    ffmpeg_status: Mapping[str, str],
    ffprobe_status: Mapping[str, str],
    desktop_bundle_active: bool,
    help_center_available: bool,
    release_docs_available: bool,
) -> ReleaseReadinessReport:
    checks = [
        _version_check(version),
        _tool_check("ffmpeg_available", "FFmpeg", ffmpeg_status),
        _tool_check("ffprobe_available", "FFprobe", ffprobe_status),
        _checksum_check(registry),
        _source_check(registry),
        _license_check(registry),
        _boolean_check(
            "desktop_packaging",
            "Desktop packaging",
            desktop_bundle_active,
            "Tauri Windows bundle configuration is enabled.",
            "Tauri Windows bundle configuration is not enabled.",
            "Enable the Tauri bundle configuration before release packaging.",
        ),
        _boolean_check(
            "help_center",
            "Help Center",
            help_center_available,
            "In-app Help Center is available.",
            "In-app Help Center is missing.",
            "Add the Help Center before accepting 0.30.",
        ),
        _boolean_check(
            "release_docs",
            "Release documentation",
            release_docs_available,
            "Release documentation set is available.",
            "Release documentation set is incomplete.",
            "Add packaging, privacy, model, FFmpeg, and acceptance documents.",
        ),
    ]
    summary = {
        "pass": sum(1 for check in checks if check.severity == "pass"),
        "warning": sum(1 for check in checks if check.severity == "warning"),
        "blocker": sum(1 for check in checks if check.severity == "blocker"),
    }
    return ReleaseReadinessReport(
        version=version,
        generated_at=datetime.now(UTC).isoformat(),
        ready=summary["blocker"] == 0,
        summary=summary,
        checks=checks,
    )


def _version_check(version: str) -> ReleaseReadinessCheck:
    if version == EXPECTED_RELEASE_VERSION:
        return ReleaseReadinessCheck(
            id="version_metadata",
            label="Version metadata",
            severity="pass",
            message=f"Worker release version is {EXPECTED_RELEASE_VERSION}.",
        )
    return ReleaseReadinessCheck(
        id="version_metadata",
        label="Version metadata",
        severity="blocker",
        message=f"Worker release version is {version}; expected {EXPECTED_RELEASE_VERSION}.",
        remediation=f"Update all release metadata to {EXPECTED_RELEASE_VERSION}.",
    )


def _tool_check(
    check_id: str,
    label: str,
    status: Mapping[str, str],
) -> ReleaseReadinessCheck:
    if status.get("status") == "available":
        return ReleaseReadinessCheck(
            id=check_id,
            label=label,
            severity="pass",
            message=status.get("message") or f"{label} is available.",
        )
    return ReleaseReadinessCheck(
        id=check_id,
        label=label,
        severity="blocker",
        message=status.get("message") or f"{label} is not available.",
        remediation=f"Install or bundle a release-approved {label} binary.",
    )


def _checksum_check(registry: list[ModelRegistryEntry]) -> ReleaseReadinessCheck:
    placeholder_ids = [
        entry.model_id
        for entry in registry
        if entry.checksum_algorithm == "sha256" and set(entry.checksum) == {"0"}
    ]
    if not placeholder_ids:
        return ReleaseReadinessCheck(
            id="model_registry_checksums",
            label="Model registry checksums",
            severity="pass",
            message="All built-in model registry entries use non-placeholder checksums.",
        )
    return ReleaseReadinessCheck(
        id="model_registry_checksums",
        label="Model registry checksums",
        severity="blocker",
        message=f"Placeholder checksums remain for: {', '.join(placeholder_ids)}.",
        remediation="Replace placeholder checksums with audited package checksums.",
    )


def _source_check(registry: list[ModelRegistryEntry]) -> ReleaseReadinessCheck:
    bare_repo_ids = [
        entry.model_id for entry in registry if _is_bare_hugging_face_repository(entry.source_url)
    ]
    if not bare_repo_ids:
        return ReleaseReadinessCheck(
            id="model_registry_sources",
            label="Model registry sources",
            severity="pass",
            message="All built-in model sources point at downloadable package artifacts or pinned snapshots.",
        )
    return ReleaseReadinessCheck(
        id="model_registry_sources",
        label="Model registry sources",
        severity="blocker",
        message=f"Model sources point at repository page URLs for: {', '.join(bare_repo_ids)}.",
        remediation="Pin downloadable model package artifacts or implement audited snapshot downloads.",
    )


def _is_bare_hugging_face_repository(source_url: str) -> bool:
    parsed = urlparse(source_url)
    if parsed.scheme not in {"http", "https"} or parsed.netloc.lower() != "huggingface.co":
        return False
    parts = [part for part in parsed.path.split("/") if part]
    return len(parts) == 2


def _license_check(registry: list[ModelRegistryEntry]) -> ReleaseReadinessCheck:
    missing_ids = [
        entry.model_id
        for entry in registry
        if not entry.license_name.strip() or not entry.license_url.strip()
    ]
    if not missing_ids:
        return ReleaseReadinessCheck(
            id="model_registry_licenses",
            label="Model registry licenses",
            severity="pass",
            message="All built-in model registry entries expose license metadata.",
        )
    return ReleaseReadinessCheck(
        id="model_registry_licenses",
        label="Model registry licenses",
        severity="blocker",
        message=f"License metadata is missing for: {', '.join(missing_ids)}.",
        remediation="Add audited license names and URLs for every built-in model.",
    )


def _boolean_check(
    check_id: str,
    label: str,
    condition: bool,
    pass_message: str,
    blocker_message: str,
    remediation: str,
) -> ReleaseReadinessCheck:
    if condition:
        return ReleaseReadinessCheck(
            id=check_id,
            label=label,
            severity="pass",
            message=pass_message,
        )
    return ReleaseReadinessCheck(
        id=check_id,
        label=label,
        severity="blocker",
        message=blocker_message,
        remediation=remediation,
    )
