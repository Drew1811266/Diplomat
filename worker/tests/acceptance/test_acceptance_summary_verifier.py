import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "acceptance" / "verify-0-40-acceptance-summary.py"
MIN_DURATION_MS = 2 * 60 * 60 * 1000


def write_complete_summary(tmp_path: Path, **overrides) -> Path:
    evidence_dir = tmp_path / "evidence"
    evidence_dir.mkdir()
    source_video = tmp_path / "two-hour.mp4"
    source_video.write_bytes(b"video")
    asr_model_dir = tmp_path / "models" / "asr"
    translation_model_dir = tmp_path / "models" / "translation"
    asr_model_dir.mkdir(parents=True)
    translation_model_dir.mkdir(parents=True)
    asr_log = evidence_dir / "analysis.log"
    translation_log = evidence_dir / "translation.log"
    asr_log.write_text("Runtime cleanup: Closed runtime resource.\n", encoding="utf-8")
    translation_log.write_text("Runtime cleanup: Closed runtime resource.\n", encoding="utf-8")
    manifest_path = evidence_dir / "manifest.json"
    subtitle_path = evidence_dir / "subtitle.diplomat.json"
    export_dir = evidence_dir / "exports"
    manifest_path.write_text("{}", encoding="utf-8")
    subtitle_path.write_text("{}", encoding="utf-8")
    export_dir.mkdir()
    export_artifacts = []
    for export_format in ["srt", "vtt", "ass"]:
        export_path = export_dir / f"subtitle-bilingual.{export_format}"
        export_path.write_text(f"{export_format} export", encoding="utf-8")
        export_artifacts.append(
            {
                "format": export_format,
                "mode": "bilingual",
                "path": str(export_path),
                "bytes": export_path.stat().st_size,
            }
        )

    summary = {
        "schemaVersion": "diplomat.0-40-acceptance.v1",
        "status": "passed",
        "acceptanceProfile": "release",
        "sourceVideo": str(source_video),
        "evidenceDir": str(evidence_dir),
        "preflightOnly": False,
        "videoProbe": {
            "durationMs": MIN_DURATION_MS,
            "minimumDurationMs": MIN_DURATION_MS,
            "hasAudio": True,
            "audioCodec": "aac",
            "videoCodec": "h264",
        },
        "checks": [
            {
                "id": "preflight",
                "status": "passed",
                "stdout": "ready",
                "stderr": "",
            }
        ],
        "developmentModels": {
            "asr.microsoft.vibevoice-asr": str(asr_model_dir),
            "translation.tencent.hunyuan-mt-7b-fp8": str(translation_model_dir),
        },
        "glossary": {
            "path": None,
            "termCount": 0,
        },
        "project": {
            "projectId": "project-1",
            "projectDir": str(evidence_dir / "worker-data" / "project-1"),
        },
        "analysisTask": {
            "taskId": "analysis-task",
            "type": "analysis",
            "status": "completed",
            "progress": 1,
            "message": "complete",
            "errorCode": None,
            "errorMessage": None,
            "diagnosticLogPath": str(asr_log),
        },
        "translationTask": {
            "taskId": "translation-task",
            "type": "translation",
            "status": "completed",
            "progress": 1,
            "message": "complete",
            "errorCode": None,
            "errorMessage": None,
            "diagnosticLogPath": str(translation_log),
        },
        "runtimeCleanup": {
            "analysis": {
                "label": "analysis",
                "logPath": str(asr_log),
                "closed": True,
                "acceleratorCacheCleared": True,
                "messages": ["Closed runtime resource.", "Cleared CUDA accelerator cache."],
            },
            "translation": {
                "label": "translation",
                "logPath": str(translation_log),
                "closed": True,
                "acceleratorCacheCleared": True,
                "messages": ["Closed runtime resource.", "Cleared CUDA accelerator cache."],
            },
        },
        "asrChunks": {
            "taskId": "analysis-task",
            "manifestPath": str(manifest_path),
            "chunkCount": 12,
            "completedChunkCount": 12,
            "durationMs": MIN_DURATION_MS,
            "chunkMs": 900_000,
            "overlapMs": 1_000,
            "firstChunkStartMs": 0,
            "lastChunkEndMs": MIN_DURATION_MS,
        },
        "subtitle": {
            "lineCount": 4000,
            "sourceLineCount": 4000,
            "translatedLineCount": 4000,
            "blankSourceLineCount": 0,
            "missingTranslationCount": 0,
            "failedTranslationCount": 0,
            "incompleteTranslationStatusCount": 0,
            "timingIssueCount": 0,
            "translationQualityIssueCount": 0,
            "path": str(subtitle_path),
        },
        "exports": {
            "mode": "bilingual",
            "artifactCount": 3,
            "artifacts": export_artifacts,
        },
    }
    summary.update(overrides)

    summary_path = evidence_dir / "acceptance-summary.json"
    summary_path.write_text(json.dumps(summary), encoding="utf-8")
    return summary_path


def run_verifier(summary_path: Path) -> subprocess.CompletedProcess[str]:
    return run_verifier_with_args(["--summary", str(summary_path)])


def run_verifier_with_args(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def test_0_40_summary_verifier_accepts_complete_final_summary(tmp_path: Path) -> None:
    summary_path = write_complete_summary(tmp_path)

    result = run_verifier(summary_path)

    assert result.returncode == 0, result.stderr or result.stdout
    assert "0.40 acceptance summary verified" in result.stdout


def test_0_40_summary_verifier_rejects_preflight_only_summary(tmp_path: Path) -> None:
    summary_path = write_complete_summary(tmp_path, status="preflight-passed", preflightOnly=True)

    result = run_verifier(summary_path)

    assert result.returncode == 1
    assert "status must be passed" in result.stderr
    assert "preflightOnly must be false" in result.stderr


def test_0_40_summary_verifier_rejects_incomplete_chunk_coverage(tmp_path: Path) -> None:
    summary_path = write_complete_summary(tmp_path)
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    summary["asrChunks"]["completedChunkCount"] = 11
    summary["asrChunks"]["lastChunkEndMs"] = MIN_DURATION_MS - 1
    summary_path.write_text(json.dumps(summary), encoding="utf-8")

    result = run_verifier(summary_path)

    assert result.returncode == 1
    assert "completedChunkCount must equal chunkCount" in result.stderr
    assert "lastChunkEndMs must cover the source duration" in result.stderr


def test_0_40_summary_verifier_rejects_subtitle_quality_failures(tmp_path: Path) -> None:
    summary_path = write_complete_summary(tmp_path)
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    summary["subtitle"]["missingTranslationCount"] = 1
    summary["subtitle"]["translationQualityIssueCount"] = 1
    summary_path.write_text(json.dumps(summary), encoding="utf-8")

    result = run_verifier(summary_path)

    assert result.returncode == 1
    assert "missingTranslationCount must be 0" in result.stderr
    assert "translationQualityIssueCount must be 0" in result.stderr


def test_0_40_summary_verifier_rejects_missing_export_artifacts(tmp_path: Path) -> None:
    summary_path = write_complete_summary(tmp_path)
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    missing_export = Path(summary["exports"]["artifacts"][0]["path"])
    missing_export.unlink()
    summary["exports"]["artifactCount"] = 2
    summary["exports"]["artifacts"] = summary["exports"]["artifacts"][1:]
    summary_path.write_text(json.dumps(summary), encoding="utf-8")

    result = run_verifier(summary_path)

    assert result.returncode == 1
    assert "exports.artifactCount must be 3" in result.stderr
    assert "exports.artifacts must include srt" in result.stderr


def test_0_40_summary_verifier_accepts_smoke_profile_summary(tmp_path: Path) -> None:
    summary_path = write_complete_summary(
        tmp_path,
        acceptanceProfile="smoke",
        videoProbe={
            "durationMs": 600_000,
            "minimumDurationMs": 300_000,
            "hasAudio": True,
            "audioCodec": "aac",
            "videoCodec": "h264",
        },
        asrChunks={
            "taskId": "analysis-task",
            "manifestPath": str(tmp_path / "evidence" / "manifest.json"),
            "chunkCount": 2,
            "completedChunkCount": 2,
            "durationMs": 600_000,
            "chunkMs": 300_000,
            "overlapMs": 1_000,
            "firstChunkStartMs": 0,
            "lastChunkEndMs": 600_000,
        },
    )

    result = run_verifier_with_args(["--summary", str(summary_path), "--acceptance-profile", "smoke"])

    assert result.returncode == 0, result.stderr or result.stdout


def test_0_40_summary_verifier_rejects_smoke_summary_for_release_gate(tmp_path: Path) -> None:
    summary_path = write_complete_summary(
        tmp_path,
        acceptanceProfile="smoke",
        videoProbe={
            "durationMs": 600_000,
            "minimumDurationMs": 600_000,
            "hasAudio": True,
            "audioCodec": "aac",
            "videoCodec": "h264",
        },
    )

    result = run_verifier(summary_path)

    assert result.returncode == 1
    assert "acceptanceProfile must be release" in result.stderr
    assert "videoProbe.durationMs must be at least two hours" in result.stderr
