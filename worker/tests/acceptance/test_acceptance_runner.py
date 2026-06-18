import json
import importlib.util
import shutil
import subprocess
import sys
from pathlib import Path

import pytest


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
        target.write_text('{"accepted": true}', encoding="utf-8")


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
