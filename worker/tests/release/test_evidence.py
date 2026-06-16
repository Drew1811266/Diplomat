import json
from datetime import UTC, datetime
from pathlib import Path

from diplomat_worker.release.evidence import (
    ReleaseEvidenceArtifact,
    build_release_evidence_report,
    parse_key_value_items,
    write_release_evidence,
)


def test_write_release_evidence_records_artifacts_metrics_and_notes(tmp_path: Path) -> None:
    installer = tmp_path / "Diplomat_0.35.0_x64-setup.exe"
    installer.write_bytes(b"installer")
    created_at = datetime(2026, 6, 15, 1, 30, tzinfo=UTC)

    report = build_release_evidence_report(
        stage="0.35",
        kind="installer",
        status="pass",
        artifacts=[ReleaseEvidenceArtifact.from_path("installer", installer)],
        metrics={"workerReachable": "true"},
        notes=["Installed app launched and Worker responded."],
        created_at=created_at,
    )
    path = write_release_evidence(tmp_path / "evidence", report)

    payload = json.loads(path.read_text(encoding="utf-8"))
    assert path.name == "evidence-0.35-installer-20260615T013000Z.json"
    assert payload["schemaVersion"] == "diplomat.release_evidence.v1"
    assert payload["stage"] == "0.35"
    assert payload["kind"] == "installer"
    assert payload["status"] == "pass"
    assert payload["artifacts"] == [
        {
            "label": "installer",
            "path": str(installer),
            "required": True,
            "exists": True,
        }
    ]
    assert payload["metrics"] == {"workerReachable": "true"}
    assert payload["notes"] == ["Installed app launched and Worker responded."]


def test_release_evidence_fails_when_required_artifact_is_missing(tmp_path: Path) -> None:
    report = build_release_evidence_report(
        stage="0.35",
        kind="long_video",
        status="pass",
        artifacts=[ReleaseEvidenceArtifact.from_path("one_hour_media", tmp_path / "missing.mp4")],
    )

    assert report.status == "fail"
    assert report.artifacts[0].exists is False


def test_parse_key_value_items_rejects_invalid_items() -> None:
    assert parse_key_value_items(["duration=one-hour", "task=translation"]) == {
        "duration": "one-hour",
        "task": "translation",
    }

    try:
        parse_key_value_items(["missing-separator"])
    except ValueError as exc:
        assert "key=value" in str(exc)
    else:
        raise AssertionError("invalid key-value input should fail")
