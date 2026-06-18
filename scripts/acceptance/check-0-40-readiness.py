from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKER_ROOT = ROOT / "worker"
if str(WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKER_ROOT))

from diplomat_worker.models.dev_manifests import (  # noqa: E402
    development_readiness,
    load_development_manifests,
)


REQUIRED_MODULES = [
    "huggingface_hub",
    "soundfile",
    "torch",
    "transformers",
]


def main() -> int:
    errors: list[str] = []
    print("Diplomat 0.40 acceptance preflight")

    manifests = load_development_manifests(ROOT)
    if not manifests:
        errors.append("No development model manifests were found.")

    for manifest in manifests:
        readiness = development_readiness(manifest, ROOT)
        status = "usable" if readiness.usable else f"blocked: {readiness.reason}"
        print(f"- {manifest.model_id}: {status}")
        if not readiness.usable:
            errors.append(f"{manifest.model_id}: {readiness.reason}")

        probe = ROOT / manifest.development_path / "__diplomat_acceptance_probe.safetensors"
        check = subprocess.run(
            ["git", "check-ignore", "-q", str(probe)],
            cwd=ROOT,
            check=False,
        )
        if check.returncode != 0:
            errors.append(f"Model files are not ignored by Git under {manifest.development_path}.")

    for module_name in REQUIRED_MODULES:
        if importlib.util.find_spec(module_name) is None:
            errors.append(f"Required runtime module is missing: {module_name}")
        else:
            print(f"- runtime module available: {module_name}")

    if errors:
        print("\n0.40 preflight failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\n0.40 preflight passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
