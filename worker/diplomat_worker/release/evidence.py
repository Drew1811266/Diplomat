from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal, Sequence

EvidenceKind = Literal["installer", "long_video", "crash_resume", "full_check"]
EvidenceStatus = Literal["pass", "warning", "fail"]


@dataclass(frozen=True)
class ReleaseEvidenceArtifact:
    label: str
    path: str
    required: bool
    exists: bool

    @classmethod
    def from_path(cls, label: str, path: str | Path, required: bool = True) -> "ReleaseEvidenceArtifact":
        artifact_path = Path(path)
        return cls(
            label=label,
            path=str(artifact_path),
            required=required,
            exists=artifact_path.exists(),
        )

    def to_payload(self) -> dict[str, object]:
        return {
            "label": self.label,
            "path": self.path,
            "required": self.required,
            "exists": self.exists,
        }


@dataclass(frozen=True)
class ReleaseEvidenceReport:
    schema_version: str
    stage: str
    kind: EvidenceKind
    status: EvidenceStatus
    generated_at: str
    artifacts: list[ReleaseEvidenceArtifact]
    metrics: dict[str, str]
    notes: list[str]

    def to_payload(self) -> dict[str, object]:
        return {
            "schemaVersion": self.schema_version,
            "stage": self.stage,
            "kind": self.kind,
            "status": self.status,
            "generatedAt": self.generated_at,
            "artifacts": [artifact.to_payload() for artifact in self.artifacts],
            "metrics": self.metrics,
            "notes": self.notes,
        }


def build_release_evidence_report(
    *,
    stage: str,
    kind: EvidenceKind,
    status: EvidenceStatus,
    artifacts: Sequence[ReleaseEvidenceArtifact] | None = None,
    metrics: dict[str, str] | None = None,
    notes: Sequence[str] | None = None,
    created_at: datetime | None = None,
) -> ReleaseEvidenceReport:
    artifact_list = list(artifacts or [])
    resolved_status = status
    if any(artifact.required and not artifact.exists for artifact in artifact_list):
        resolved_status = "fail"
    generated_at = (created_at or datetime.now(UTC)).astimezone(UTC).isoformat()
    return ReleaseEvidenceReport(
        schema_version="diplomat.release_evidence.v1",
        stage=stage,
        kind=kind,
        status=resolved_status,
        generated_at=generated_at,
        artifacts=artifact_list,
        metrics=metrics or {},
        notes=list(notes or []),
    )


def write_release_evidence(output_dir: Path, report: ReleaseEvidenceReport) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.fromisoformat(report.generated_at)
    path = output_dir / (
        f"evidence-{report.stage}-{report.kind}-{_filename_timestamp(generated_at)}.json"
    )
    path.write_text(
        json.dumps(report.to_payload(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return path


def parse_key_value_items(items: Sequence[str]) -> dict[str, str]:
    values: dict[str, str] = {}
    for item in items:
        key, separator, value = item.partition("=")
        if not separator or not key.strip():
            raise ValueError(f"Expected key=value item, got: {item}")
        values[key.strip()] = value.strip()
    return values


def parse_artifact_items(items: Sequence[str]) -> list[ReleaseEvidenceArtifact]:
    artifacts: list[ReleaseEvidenceArtifact] = []
    for item in items:
        label, separator, artifact_path = item.partition("=")
        if not separator or not label.strip() or not artifact_path.strip():
            raise ValueError(f"Expected label=path artifact, got: {item}")
        artifacts.append(ReleaseEvidenceArtifact.from_path(label.strip(), artifact_path.strip()))
    return artifacts


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Write a Diplomat 0.35 release evidence report.")
    parser.add_argument("--stage", default="0.35")
    parser.add_argument("--kind", required=True, choices=["installer", "long_video", "crash_resume", "full_check"])
    parser.add_argument("--status", default="pass", choices=["pass", "warning", "fail"])
    parser.add_argument("--output", default=".dev/release-evidence")
    parser.add_argument("--artifact", action="append", default=[], help="Required artifact as label=path.")
    parser.add_argument("--metric", action="append", default=[], help="Metric as key=value.")
    parser.add_argument("--note", action="append", default=[])
    args = parser.parse_args(argv)

    report = build_release_evidence_report(
        stage=args.stage,
        kind=args.kind,
        status=args.status,
        artifacts=parse_artifact_items(args.artifact),
        metrics=parse_key_value_items(args.metric),
        notes=args.note,
    )
    path = write_release_evidence(Path(args.output), report)
    print(path)
    return 1 if report.status == "fail" else 0


def _filename_timestamp(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


if __name__ == "__main__":
    raise SystemExit(main())
