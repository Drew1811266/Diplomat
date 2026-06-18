import json
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
