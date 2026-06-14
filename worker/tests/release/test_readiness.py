from diplomat_worker.models.registry import ModelRegistryEntry, built_in_model_registry
from diplomat_worker.release.readiness import build_release_readiness_report


def fixture_entry() -> ModelRegistryEntry:
    return ModelRegistryEntry(
        model_id="asr.fixture.release",
        name="Release Fixture ASR",
        task="asr",
        tier="light",
        runtime="faster-whisper",
        provider="faster-whisper",
        version="2026-06-14",
        languages=["zh", "en"],
        language_pairs=[],
        model_size_bytes=12,
        download_size_bytes=12,
        disk_requirement_bytes=24,
        recommended_hardware="CPU fallback; NVIDIA GPU recommended.",
        license_name="MIT",
        license_url="https://example.invalid/license",
        source_url="https://example.invalid/models/asr.fixture.release.zip",
        checksum_algorithm="sha256",
        checksum="a" * 64,
        terms_summary="Release fixture model.",
    )


def test_release_readiness_flags_placeholder_model_checksums() -> None:
    entry = fixture_entry()
    placeholder_entry = ModelRegistryEntry(
        **{
            **entry.__dict__,
            "checksum": "0" * 64,
        }
    )
    report = build_release_readiness_report(
        version="0.3.0",
        registry=[placeholder_entry],
        ffmpeg_status={"status": "available", "message": "FFmpeg available"},
        ffprobe_status={"status": "available", "message": "FFprobe available"},
        desktop_bundle_active=True,
        help_center_available=True,
        release_docs_available=True,
    )

    checksum_check = next(check for check in report.checks if check.id == "model_registry_checksums")

    assert checksum_check.severity == "blocker"
    assert "placeholder" in checksum_check.message.lower()
    assert report.summary["blocker"] >= 1
    assert report.ready is False


def test_release_readiness_flags_bare_hugging_face_repository_sources() -> None:
    entry = fixture_entry()
    bare_repo_entry = ModelRegistryEntry(
        **{
            **entry.__dict__,
            "source_url": "https://huggingface.co/Systran/faster-whisper-small",
        }
    )
    report = build_release_readiness_report(
        version="0.3.0",
        registry=[bare_repo_entry],
        ffmpeg_status={"status": "available", "message": "FFmpeg available"},
        ffprobe_status={"status": "available", "message": "FFprobe available"},
        desktop_bundle_active=True,
        help_center_available=True,
        release_docs_available=True,
    )

    source_check = next(check for check in report.checks if check.id == "model_registry_sources")

    assert source_check.severity == "blocker"
    assert "repository page" in source_check.message.lower()


def test_built_in_registry_is_release_ready_when_tools_and_docs_pass() -> None:
    report = build_release_readiness_report(
        version="0.3.0",
        registry=built_in_model_registry(),
        ffmpeg_status={"status": "available", "message": "FFmpeg available"},
        ffprobe_status={"status": "available", "message": "FFprobe available"},
        desktop_bundle_active=True,
        help_center_available=True,
        release_docs_available=True,
    )

    assert report.summary == {"pass": len(report.checks), "warning": 0, "blocker": 0}
    assert report.ready is True


def test_release_readiness_passes_when_inputs_are_audited() -> None:
    report = build_release_readiness_report(
        version="0.3.0",
        registry=[fixture_entry()],
        ffmpeg_status={"status": "available", "message": "FFmpeg available"},
        ffprobe_status={"status": "available", "message": "FFprobe available"},
        desktop_bundle_active=True,
        help_center_available=True,
        release_docs_available=True,
    )

    assert report.summary == {"pass": len(report.checks), "warning": 0, "blocker": 0}
    assert report.ready is True
