import json
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


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
