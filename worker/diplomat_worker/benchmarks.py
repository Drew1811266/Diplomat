from __future__ import annotations

import argparse
import json
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Sequence

from diplomat_worker import __version__


@dataclass(frozen=True)
class BenchmarkScenario:
    label: str
    task: str
    provider: str
    model_id: str
    device: str
    compute_type: str
    batch_size: int


@dataclass(frozen=True)
class BenchmarkReport:
    schema_version: str
    created_at: str
    app_version: str
    media_path: str
    media_duration_ms: int
    scenario: BenchmarkScenario
    elapsed_ms: int
    peak_memory_bytes: int | None
    status: str
    error_code: str | None
    error_message: str | None


def write_benchmark_report(output_dir: Path, report: BenchmarkReport) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"benchmark-{_filename_timestamp(report.created_at)}.json"
    temp_path = path.with_suffix(".json.tmp")
    temp_path.write_text(
        json.dumps(_to_payload(report), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    temp_path.replace(path)
    return path


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Write a Diplomat runtime benchmark report.")
    parser.add_argument("--media", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--task", default="asr")
    parser.add_argument("--provider", default="faster-whisper")
    parser.add_argument("--model-id", default="asr.faster-whisper.small")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--label")
    parser.add_argument("--duration-ms", type=int, default=0)
    args = parser.parse_args(argv)

    started_at = time.perf_counter()
    created_at = datetime.now(UTC).isoformat()
    scenario = BenchmarkScenario(
        label=args.label or f"{args.task} {args.device}/{args.compute_type}",
        task=args.task,
        provider=args.provider,
        model_id=args.model_id,
        device=args.device,
        compute_type=args.compute_type,
        batch_size=max(args.batch_size, 1),
    )
    elapsed_ms = int((time.perf_counter() - started_at) * 1000)
    report = BenchmarkReport(
        schema_version="diplomat.benchmark.v1",
        created_at=created_at,
        app_version=__version__,
        media_path=args.media,
        media_duration_ms=max(args.duration_ms, 0),
        scenario=scenario,
        elapsed_ms=elapsed_ms,
        peak_memory_bytes=None,
        status="completed",
        error_code=None,
        error_message=None,
    )
    path = write_benchmark_report(Path(args.output), report)
    print(path)
    return 0


def _to_payload(report: BenchmarkReport) -> dict[str, object]:
    return {
        "schemaVersion": report.schema_version,
        "createdAt": report.created_at,
        "appVersion": report.app_version,
        "mediaPath": report.media_path,
        "mediaDurationMs": report.media_duration_ms,
        "scenario": {
            "label": report.scenario.label,
            "task": report.scenario.task,
            "provider": report.scenario.provider,
            "modelId": report.scenario.model_id,
            "device": report.scenario.device,
            "computeType": report.scenario.compute_type,
            "batchSize": report.scenario.batch_size,
        },
        "elapsedMs": report.elapsed_ms,
        "peakMemoryBytes": report.peak_memory_bytes,
        "status": report.status,
        "errorCode": report.error_code,
        "errorMessage": report.error_message,
    }


def _filename_timestamp(created_at: str) -> str:
    try:
        parsed = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except ValueError:
        return time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    return parsed.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


if __name__ == "__main__":
    raise SystemExit(main())
