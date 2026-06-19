import json
import importlib.util
import shutil
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from diplomat_worker.asr.base import AsrResult, AsrSegment
from diplomat_worker.asr.chunk_store import (
    build_chunk_manifest,
    chunk_result_path,
    write_chunk_result,
    write_manifest,
)
from diplomat_worker.media.audio import build_fixed_chunks
from diplomat_worker.schemas.subtitle import (
    AiOrigin,
    SubtitleDocument,
    SubtitleLine,
    TranslationOrigin,
    TranslationQualityIssue,
)


ROOT = Path(__file__).resolve().parents[3]


def write_fake_ffprobe(tmp_path: Path, payload: dict) -> Path:
    ffprobe = tmp_path / "ffprobe.cmd"
    ffprobe.write_text(
        "@echo off\n"
        f"echo {json.dumps(payload)}\n",
        encoding="utf-8",
    )
    return ffprobe


def load_acceptance_runner():
    script = ROOT / "scripts" / "acceptance" / "run-0-40-three-hour.py"
    spec = importlib.util.spec_from_file_location("run_0_40_three_hour", script)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_0_40_runner_defaults_use_bfloat16_for_real_model_targets(monkeypatch) -> None:
    runner = load_acceptance_runner()
    monkeypatch.setattr(
        sys,
        "argv",
        ["run-0-40-three-hour.py", "--source-video", "fixture.mp4"],
    )

    args = runner.parse_args()

    assert args.asr_provider == "vibevoice-asr"
    assert args.asr_model_id == "asr.microsoft.vibevoice-asr"
    assert args.asr_compute_type == "bfloat16"
    assert args.translation_provider == "local-llm"
    assert args.translation_model_id == "translation.tencent.hunyuan-mt-7b-fp8"
    assert args.translation_compute_type == "bfloat16"


def test_0_40_verify_wrapper_exposes_help() -> None:
    shell = shutil.which("pwsh") or shutil.which("powershell")
    if shell is None:
        pytest.skip("PowerShell is not available")
    script = ROOT / "scripts" / "verify-0.40-three-hour-workflow.ps1"

    result = subprocess.run(
        [
            shell,
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(script),
            "-Help",
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0
    assert "verify-0.40-three-hour-workflow.ps1" in result.stdout
    assert "GlossaryPath" in result.stdout
    assert "PreflightOnly" in result.stdout


def test_0_40_runner_writes_summary_for_missing_source(tmp_path: Path) -> None:
    evidence_dir = tmp_path / "evidence"
    missing_source = tmp_path / "missing.mp4"

    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "acceptance" / "run-0-40-three-hour.py"),
            "--source-video",
            str(missing_source),
            "--evidence-dir",
            str(evidence_dir),
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    summary = json.loads((evidence_dir / "acceptance-summary.json").read_text(encoding="utf-8"))
    assert result.returncode == 1
    assert summary["status"] == "failed"
    assert "Source video does not exist" in summary["error"]


def test_0_40_runner_rejects_short_source_before_model_preflight(tmp_path: Path) -> None:
    evidence_dir = tmp_path / "evidence"
    source = tmp_path / "short.mp4"
    source.write_bytes(b"fixture")
    ffprobe = write_fake_ffprobe(
        tmp_path,
        {
            "format": {"duration": "42"},
            "streams": [
                {"codec_type": "video", "codec_name": "h264"},
                {"codec_type": "audio", "codec_name": "aac"},
            ],
        },
    )

    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "acceptance" / "run-0-40-three-hour.py"),
            "--source-video",
            str(source),
            "--evidence-dir",
            str(evidence_dir),
            "--ffprobe-path",
            str(ffprobe),
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    summary = json.loads((evidence_dir / "acceptance-summary.json").read_text(encoding="utf-8"))
    assert result.returncode == 1
    assert summary["status"] == "failed"
    assert summary["videoProbe"]["durationMs"] == 42_000
    assert "shorter than three hours" in summary["error"]
    assert summary["checks"] == []


def test_0_40_runner_rejects_silent_source_before_model_preflight(tmp_path: Path) -> None:
    evidence_dir = tmp_path / "evidence"
    source = tmp_path / "silent.mp4"
    source.write_bytes(b"fixture")
    ffprobe = write_fake_ffprobe(
        tmp_path,
        {
            "format": {"duration": "10800"},
            "streams": [{"codec_type": "video", "codec_name": "h264"}],
        },
    )

    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "acceptance" / "run-0-40-three-hour.py"),
            "--source-video",
            str(source),
            "--evidence-dir",
            str(evidence_dir),
            "--ffprobe-path",
            str(ffprobe),
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    summary = json.loads((evidence_dir / "acceptance-summary.json").read_text(encoding="utf-8"))
    assert result.returncode == 1
    assert summary["status"] == "failed"
    assert summary["videoProbe"]["durationMs"] == 10_800_000
    assert summary["videoProbe"]["hasAudio"] is False
    assert "no audio stream" in summary["error"]
    assert summary["checks"] == []


def test_0_40_runner_preflight_only_stops_before_worker_execution(
    monkeypatch,
    tmp_path: Path,
) -> None:
    runner = load_acceptance_runner()
    evidence_dir = tmp_path / "evidence"
    source = tmp_path / "three-hour.mp4"
    source.write_bytes(b"fixture")
    ffprobe = write_fake_ffprobe(
        tmp_path,
        {
            "format": {"duration": "10800"},
            "streams": [
                {"codec_type": "video", "codec_name": "h264"},
                {"codec_type": "audio", "codec_name": "aac"},
            ],
        },
    )

    def fake_subprocess_run(command, *args, **kwargs):
        if command and str(command[0]) == str(ffprobe):
            return SimpleNamespace(
                returncode=0,
                stdout=json.dumps(
                    {
                        "format": {"duration": "10800"},
                        "streams": [
                            {"codec_type": "video", "codec_name": "h264"},
                            {"codec_type": "audio", "codec_name": "aac"},
                        ],
                    }
                ),
                stderr="",
            )
        return SimpleNamespace(returncode=0, stdout="preflight ok", stderr="")

    def fail_worker_runtime(*args, **kwargs):
        raise AssertionError("preflight-only mode must not create WorkerRuntime")

    monkeypatch.setattr(runner.subprocess, "run", fake_subprocess_run)
    monkeypatch.setattr(
        runner,
        "resolve_development_model_paths",
        lambda root, model_ids: {model_id: f"D:/models/{model_id}" for model_id in model_ids},
    )
    monkeypatch.setattr(runner, "WorkerRuntime", fail_worker_runtime)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "run-0-40-three-hour.py",
            "--source-video",
            str(source),
            "--evidence-dir",
            str(evidence_dir),
            "--ffprobe-path",
            str(ffprobe),
            "--preflight-only",
        ],
    )

    assert runner.main() == 0

    summary = json.loads((evidence_dir / "acceptance-summary.json").read_text(encoding="utf-8"))
    assert summary["status"] == "preflight-passed"
    assert summary["preflightOnly"] is True
    assert summary["videoProbe"]["durationMs"] == 10_800_000
    assert summary["videoProbe"]["hasAudio"] is True
    assert summary["checks"][0]["id"] == "preflight"
    assert "project" not in summary
    assert "analysisTask" not in summary


def copy_model_layout(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    manifest_dir = root / "models" / "manifests"
    manifest_dir.mkdir(parents=True)
    shutil.copy2(ROOT / "models" / "manifests" / "hunyuan-mt-7b-fp8.json", manifest_dir)
    shutil.copy2(ROOT / "models" / "manifests" / "vibevoice-asr.json", manifest_dir)
    (root / "models" / "dev" / "translation" / "tencent--Hunyuan-MT-7B-fp8").mkdir(
        parents=True
    )
    (root / "models" / "dev" / "asr" / "microsoft--VibeVoice-ASR").mkdir(parents=True)
    return root


def populate_ready_model(root: Path, manifest_filename: str) -> None:
    manifest = json.loads((root / "models" / "manifests" / manifest_filename).read_text(encoding="utf-8"))
    model_dir = root / manifest["developmentPath"]
    for expected_file in manifest["expectedFiles"]:
        target = model_dir / expected_file
        target.parent.mkdir(parents=True, exist_ok=True)
        if expected_file == "config.json":
            target.write_text("{}", encoding="utf-8")
        else:
            target.write_text("fixture", encoding="utf-8")
    acceptance_record = manifest.get("license", {}).get("acceptanceRecord")
    if acceptance_record:
        target = root / acceptance_record
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            json.dumps(
                {
                    "schemaVersion": "diplomat.licenseAcceptance.v1",
                    "modelId": manifest["modelId"],
                    "licenseUrl": manifest["license"]["url"],
                    "restrictedLicenseAcknowledged": True,
                    "permittedTerritoryConfirmed": True,
                    "noRedistributionConfirmed": True,
                }
            ),
            encoding="utf-8",
        )


def test_0_40_runner_resolves_ready_development_model_paths(tmp_path: Path) -> None:
    root = copy_model_layout(tmp_path)
    populate_ready_model(root, "vibevoice-asr.json")
    populate_ready_model(root, "hunyuan-mt-7b-fp8.json")
    runner = load_acceptance_runner()

    paths = runner.resolve_development_model_paths(
        root,
        [
            "asr.microsoft.vibevoice-asr",
            "translation.tencent.hunyuan-mt-7b-fp8",
        ],
    )

    assert paths["asr.microsoft.vibevoice-asr"] == str(
        root / "models" / "dev" / "asr" / "microsoft--VibeVoice-ASR"
    )
    assert paths["translation.tencent.hunyuan-mt-7b-fp8"] == str(
        root / "models" / "dev" / "translation" / "tencent--Hunyuan-MT-7B-fp8"
    )


def test_0_40_runner_collects_runtime_cleanup_evidence(tmp_path: Path) -> None:
    log_path = tmp_path / "analysis.log"
    log_path.write_text(
        "Starting analysis\n"
        "Runtime cleanup: Closed runtime resource.\n"
        "Runtime cleanup: Cleared CUDA accelerator cache.\n",
        encoding="utf-8",
    )
    runner = load_acceptance_runner()

    evidence = runner.collect_runtime_cleanup_evidence(
        {
            "type": "analysis",
            "diagnosticLogPath": str(log_path),
        },
        label="analysis",
        require_cuda_cache=True,
    )

    assert evidence == {
        "label": "analysis",
        "logPath": str(log_path),
        "closed": True,
        "acceleratorCacheCleared": True,
        "messages": [
            "Closed runtime resource.",
            "Cleared CUDA accelerator cache.",
        ],
    }


def test_0_40_runner_rejects_missing_cuda_cleanup_evidence(tmp_path: Path) -> None:
    log_path = tmp_path / "translation.log"
    log_path.write_text(
        "Starting translation\n"
        "Runtime cleanup: Closed runtime resource.\n"
        "Runtime cleanup: CUDA is not available; accelerator cache cleanup skipped.\n",
        encoding="utf-8",
    )
    runner = load_acceptance_runner()

    with pytest.raises(runner.AcceptanceError, match="translation did not clear CUDA accelerator cache"):
        runner.collect_runtime_cleanup_evidence(
            {
                "type": "translation",
                "diagnosticLogPath": str(log_path),
            },
            label="translation",
            require_cuda_cache=True,
        )


def make_asr_result(chunk_index: int) -> AsrResult:
    return AsrResult(
        engine="vibevoice-asr",
        model="asr.microsoft.vibevoice-asr",
        language="zh",
        segments=[
            AsrSegment(
                id=f"segment-{chunk_index}",
                start_ms=chunk_index * 1000,
                end_ms=chunk_index * 1000 + 500,
                text=f"chunk {chunk_index}",
                words=[],
            )
        ],
    )


def write_asr_chunk_evidence(
    project_dir: Path,
    *,
    task_id: str = "analysis-task",
    duration_ms: int = 65_000,
    skip_chunk_id: str | None = None,
) -> Path:
    chunks = build_fixed_chunks(duration_ms, chunk_ms=30_000, overlap_ms=500)
    task_cache_dir = project_dir / "cache" / "asr" / task_id
    manifest = build_chunk_manifest(
        task_id=task_id,
        audio_path=project_dir / "cache" / "audio-16000-mono.wav",
        source_video_path=project_dir / "source.mp4",
        duration_ms=duration_ms,
        chunk_ms=30_000,
        overlap_ms=500,
        chunks=chunks,
    )
    write_manifest(task_cache_dir / "manifest.json", manifest)
    for chunk in manifest.chunks:
        if chunk.chunk_id == skip_chunk_id:
            continue
        write_chunk_result(
            chunk_result_path(task_cache_dir, chunk.chunk_id),
            chunk_id=chunk.chunk_id,
            result=make_asr_result(chunk.index),
        )
    return task_cache_dir


def test_0_40_runner_collects_complete_asr_chunk_evidence(tmp_path: Path) -> None:
    project_dir = tmp_path / "project"
    write_asr_chunk_evidence(project_dir)
    runner = load_acceptance_runner()

    evidence = runner.validate_asr_chunk_evidence(
        project_dir,
        {"taskId": "analysis-task"},
        duration_ms=65_000,
    )

    assert evidence == {
        "taskId": "analysis-task",
        "manifestPath": str(project_dir / "cache" / "asr" / "analysis-task" / "manifest.json"),
        "chunkCount": 3,
        "completedChunkCount": 3,
        "durationMs": 65_000,
        "chunkMs": 30_000,
        "overlapMs": 500,
        "firstChunkStartMs": 0,
        "lastChunkEndMs": 65_000,
    }


def test_0_40_runner_rejects_missing_asr_chunk_result(tmp_path: Path) -> None:
    project_dir = tmp_path / "project"
    write_asr_chunk_evidence(project_dir, skip_chunk_id="chunk-000002")
    runner = load_acceptance_runner()

    with pytest.raises(runner.AcceptanceError, match="missing ASR chunk result"):
        runner.validate_asr_chunk_evidence(
            project_dir,
            {"taskId": "analysis-task"},
            duration_ms=65_000,
        )


def test_0_40_runner_rejects_asr_chunk_manifest_duration_mismatch(tmp_path: Path) -> None:
    project_dir = tmp_path / "project"
    write_asr_chunk_evidence(project_dir, duration_ms=64_000)
    runner = load_acceptance_runner()

    with pytest.raises(runner.AcceptanceError, match="does not match source duration"):
        runner.validate_asr_chunk_evidence(
            project_dir,
            {"taskId": "analysis-task"},
            duration_ms=65_000,
        )


def make_acceptance_document(lines: list[SubtitleLine] | None = None) -> SubtitleDocument:
    return SubtitleDocument(
        project_id="project-1",
        media_id="media-1",
        duration_ms=10_000,
        speakers=[],
        styles=[],
        lines=lines
        or [
            SubtitleLine(
                id="line-1",
                start_ms=0,
                end_ms=1000,
                speaker_id=None,
                source_language="zh",
                target_language="en",
                source_text="你好",
                translated_text="Hello",
                words=[],
                style_overrides={},
                review_status="draft",
                ai_origin=AiOrigin(engine="vibevoice-asr", model="asr.microsoft.vibevoice-asr"),
                translation_status="translated",
                translation_origin=TranslationOrigin(
                    provider="local-llm",
                    model="translation.tencent.hunyuan-mt-7b-fp8",
                ),
                notes="",
            )
        ],
    )


def test_0_40_runner_summarizes_complete_subtitle_document(tmp_path: Path) -> None:
    runner = load_acceptance_runner()
    subtitle_path = tmp_path / "subtitle.diplomat.json"

    summary = runner.validate_subtitle_acceptance(
        make_acceptance_document(),
        subtitle_path=subtitle_path,
    )

    assert summary == {
        "lineCount": 1,
        "sourceLineCount": 1,
        "translatedLineCount": 1,
        "blankSourceLineCount": 0,
        "missingTranslationCount": 0,
        "failedTranslationCount": 0,
        "incompleteTranslationStatusCount": 0,
        "timingIssueCount": 0,
        "translationQualityIssueCount": 0,
        "path": str(subtitle_path),
    }


def test_0_40_runner_rejects_partial_subtitle_translation(tmp_path: Path) -> None:
    document = make_acceptance_document()
    document = document.model_copy(
        update={
            "lines": [
                document.lines[0],
                document.lines[0].model_copy(
                    update={
                        "id": "line-2",
                        "start_ms": 1000,
                        "end_ms": 2000,
                        "source_text": "第二句",
                        "translated_text": "",
                        "translation_status": "queued",
                        "translation_origin": None,
                    }
                ),
            ]
        }
    )
    runner = load_acceptance_runner()

    with pytest.raises(runner.AcceptanceError, match="Subtitle acceptance failed"):
        runner.validate_subtitle_acceptance(
            document,
            subtitle_path=tmp_path / "subtitle.diplomat.json",
        )


def test_0_40_runner_rejects_subtitle_timing_corruption(tmp_path: Path) -> None:
    document = make_acceptance_document(
        [
            make_acceptance_document().lines[0].model_copy(
                update={
                    "id": "line-1",
                    "start_ms": 9500,
                    "end_ms": 10_500,
                }
            )
        ]
    )
    runner = load_acceptance_runner()

    with pytest.raises(runner.AcceptanceError, match="timing issue"):
        runner.validate_subtitle_acceptance(
            document,
            subtitle_path=tmp_path / "subtitle.diplomat.json",
        )


def test_0_40_runner_rejects_translation_quality_issues(tmp_path: Path) -> None:
    document = make_acceptance_document(
        [
            make_acceptance_document().lines[0].model_copy(
                update={
                    "translation_quality_issues": [
                        TranslationQualityIssue(
                            code="glossary_term_missing",
                            severity="warning",
                            message='Expected translation for "GPU" to include "GPU".',
                            termId="term-gpu",
                        )
                    ]
                }
            )
        ]
    )
    runner = load_acceptance_runner()

    with pytest.raises(runner.AcceptanceError, match="translation quality issue"):
        runner.validate_subtitle_acceptance(
            document,
            subtitle_path=tmp_path / "subtitle.diplomat.json",
        )


def test_0_40_runner_loads_glossary_file(tmp_path: Path) -> None:
    glossary_path = tmp_path / "glossary.json"
    glossary_path.write_text(
        json.dumps(
            [
                {
                    "id": "term-gpu",
                    "sourceText": "GPU",
                    "targetText": "GPU",
                    "sourceLanguage": "zh",
                    "targetLanguage": "en",
                    "caseSensitive": False,
                }
            ]
        ),
        encoding="utf-8",
    )
    runner = load_acceptance_runner()

    glossary = runner.load_acceptance_glossary(glossary_path)

    assert glossary == [
        {
            "id": "term-gpu",
            "sourceText": "GPU",
            "targetText": "GPU",
            "sourceLanguage": "zh",
            "targetLanguage": "en",
            "caseSensitive": False,
        }
    ]


def test_0_40_runner_rejects_invalid_glossary_file(tmp_path: Path) -> None:
    glossary_path = tmp_path / "glossary.json"
    glossary_path.write_text('{"id": "term-gpu"}', encoding="utf-8")
    runner = load_acceptance_runner()

    with pytest.raises(runner.AcceptanceError, match="Glossary file must contain a JSON array"):
        runner.load_acceptance_glossary(glossary_path)


def test_0_40_prepare_requires_explicit_hunyuan_license_acceptance(tmp_path: Path) -> None:
    root = copy_model_layout(tmp_path)

    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "acceptance" / "prepare-0-40-models.py"),
            "--root",
            str(root),
            "--model-id",
            "translation.tencent.hunyuan-mt-7b-fp8",
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 1
    assert "license acceptance is required" in result.stdout
    assert not (root / "models" / "licenses" / "accepted" / "tencent--Hunyuan-MT-7B-fp8.json").exists()


def test_0_40_prepare_requires_hunyuan_license_compliance_confirmations(
    tmp_path: Path,
) -> None:
    root = copy_model_layout(tmp_path)

    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "acceptance" / "prepare-0-40-models.py"),
            "--root",
            str(root),
            "--model-id",
            "translation.tencent.hunyuan-mt-7b-fp8",
            "--accept-hunyuan-license",
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 1
    assert "--confirm-hunyuan-restricted-license" in result.stdout
    assert "--confirm-hunyuan-permitted-territory" in result.stdout
    assert "--confirm-hunyuan-no-redistribution" in result.stdout
    assert not (root / "models" / "licenses" / "accepted" / "tencent--Hunyuan-MT-7B-fp8.json").exists()


def test_0_40_prepare_can_record_hunyuan_license_acceptance(tmp_path: Path) -> None:
    root = copy_model_layout(tmp_path)

    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "acceptance" / "prepare-0-40-models.py"),
            "--root",
            str(root),
            "--model-id",
            "translation.tencent.hunyuan-mt-7b-fp8",
            "--accept-hunyuan-license",
            "--confirm-hunyuan-restricted-license",
            "--confirm-hunyuan-permitted-territory",
            "--confirm-hunyuan-no-redistribution",
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    acceptance_path = root / "models" / "licenses" / "accepted" / "tencent--Hunyuan-MT-7B-fp8.json"
    payload = json.loads(acceptance_path.read_text(encoding="utf-8"))
    assert result.returncode == 1
    assert payload["modelId"] == "translation.tencent.hunyuan-mt-7b-fp8"
    assert payload["licenseName"] == "Upstream License.txt"
    assert payload["restrictedLicenseAcknowledged"] is True
    assert payload["permittedTerritoryConfirmed"] is True
    assert payload["noRedistributionConfirmed"] is True
    assert payload["excludedTerritories"] == [
        "European Union",
        "United Kingdom",
        "South Korea",
    ]
    assert "model-00001-of-00002.safetensors" in result.stdout


def test_0_40_prepare_patches_hunyuan_fp8_config(tmp_path: Path) -> None:
    root = copy_model_layout(tmp_path)
    manifest = json.loads((root / "models" / "manifests" / "hunyuan-mt-7b-fp8.json").read_text(encoding="utf-8"))
    model_dir = root / manifest["developmentPath"]
    for expected_file in manifest["expectedFiles"]:
        target = model_dir / expected_file
        target.parent.mkdir(parents=True, exist_ok=True)
        if expected_file == "config.json":
            target.write_text(
                json.dumps(
                    {
                        "quantization_config": {
                            "ignored_layers": ["lm_head"],
                            "quant_method": "compressed-tensors",
                        }
                    }
                ),
                encoding="utf-8",
            )
        else:
            target.write_text("fixture", encoding="utf-8")

    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "acceptance" / "prepare-0-40-models.py"),
            "--root",
            str(root),
            "--model-id",
            "translation.tencent.hunyuan-mt-7b-fp8",
            "--accept-hunyuan-license",
            "--confirm-hunyuan-restricted-license",
            "--confirm-hunyuan-permitted-territory",
            "--confirm-hunyuan-no-redistribution",
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    patched = json.loads((model_dir / "config.json").read_text(encoding="utf-8"))
    assert result.returncode == 0
    assert patched["quantization_config"]["ignore"] == ["lm_head"]
    assert "ignored_layers" not in patched["quantization_config"]
