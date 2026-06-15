import json
from pathlib import Path

from diplomat_worker.benchmarks import (
    BenchmarkReport,
    BenchmarkScenario,
    write_benchmark_report,
)


def test_write_benchmark_report_records_runtime_metadata(tmp_path: Path) -> None:
    report = BenchmarkReport(
        schema_version="diplomat.benchmark.v1",
        created_at="2026-06-15T00:00:00+00:00",
        app_version="0.33.0",
        media_path="D:/media/demo.mp4",
        media_duration_ms=600_000,
        scenario=BenchmarkScenario(
            label="10-minute smoke",
            task="asr",
            provider="faster-whisper",
            model_id="asr.faster-whisper.small",
            device="cpu",
            compute_type="int8",
            batch_size=1,
        ),
        elapsed_ms=1234,
        peak_memory_bytes=99,
        status="completed",
        error_code=None,
        error_message=None,
    )

    path = write_benchmark_report(tmp_path, report)

    assert path.name == "benchmark-20260615T000000Z.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert payload["schemaVersion"] == "diplomat.benchmark.v1"
    assert payload["createdAt"] == "2026-06-15T00:00:00+00:00"
    assert payload["appVersion"] == "0.33.0"
    assert payload["mediaPath"] == "D:/media/demo.mp4"
    assert payload["mediaDurationMs"] == 600_000
    assert payload["scenario"]["modelId"] == "asr.faster-whisper.small"
    assert payload["scenario"]["computeType"] == "int8"
    assert payload["scenario"]["batchSize"] == 1
    assert payload["elapsedMs"] == 1234
    assert payload["peakMemoryBytes"] == 99
    assert payload["errorCode"] is None
    assert payload["errorMessage"] is None
