from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKER_ROOT = ROOT / "worker"
if str(WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKER_ROOT))

from diplomat_worker.models.dev_manifests import (  # noqa: E402
    ModelDevelopmentManifest,
    development_readiness,
    load_development_manifests,
)

HUNYUAN_MODEL_ID = "translation.tencent.hunyuan-mt-7b-fp8"
VIBEVOICE_MODEL_ID = "asr.microsoft.vibevoice-asr"
QWEN_TOKENIZER_PREFIX = "qwen-tokenizer/"
QWEN_TOKENIZER_REPO_ID = "Qwen/Qwen2.5-7B"
QWEN_TOKENIZER_REVISION = "d149729398750b98c0af14eb82c78cfe92750796"
HUNYUAN_EXCLUDED_TERRITORIES = ["European Union", "United Kingdom", "South Korea"]


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    manifests = load_development_manifests(root)
    selected = [manifest for manifest in manifests if args.model_id in {"all", manifest.model_id}]
    if not selected:
        print(f"No development model manifest matched: {args.model_id}", file=sys.stderr)
        return 1

    errors: list[str] = []
    if args.download:
        _check_disk_space(root, args.min_free_gb, errors)

    for manifest in selected:
        print(f"Preparing {manifest.model_id}")
        target_dir = root / manifest.development_path
        target_dir.mkdir(parents=True, exist_ok=True)

        license_error = _prepare_license(root, manifest, args)
        if license_error:
            errors.append(license_error)
            continue

        _prepare_auxiliary_files(manifest, target_dir)

        if args.download:
            download_error = _download_manifest(manifest, target_dir, args)
            if download_error:
                errors.append(download_error)
                continue
            _prepare_auxiliary_files(manifest, target_dir)
        else:
            print("  download skipped; pass --download to fetch model files")

        readiness = development_readiness(manifest, root)
        print(f"  readiness: {'usable' if readiness.usable else readiness.reason}")
        if not readiness.usable:
            errors.append(f"{manifest.model_id}: {readiness.reason}")

    if errors:
        print("\n0.40 model preparation incomplete:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\n0.40 model preparation completed.")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare local models for Diplomat 0.40 acceptance.")
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--model-id", default="all")
    parser.add_argument("--download", action="store_true", help="Download model snapshots from Hugging Face.")
    parser.add_argument(
        "--accept-hunyuan-license",
        action="store_true",
        help="Record local acceptance of the upstream Hunyuan MT FP8 license.",
    )
    parser.add_argument(
        "--confirm-hunyuan-restricted-license",
        action="store_true",
        help="Confirm Hunyuan is governed by Tencent's restricted upstream model license, not Diplomat's MIT license.",
    )
    parser.add_argument(
        "--confirm-hunyuan-permitted-territory",
        action="store_true",
        help="Confirm local use is only in a territory permitted by the upstream Hunyuan license.",
    )
    parser.add_argument(
        "--confirm-hunyuan-no-redistribution",
        action="store_true",
        help="Confirm Hunyuan model weights will not be redistributed with Diplomat.",
    )
    parser.add_argument("--hf-token", default=os.environ.get("HF_TOKEN"))
    parser.add_argument("--min-free-gb", type=float, default=40.0)
    return parser.parse_args()


def _check_disk_space(root: Path, min_free_gb: float, errors: list[str]) -> None:
    free_gb = shutil.disk_usage(root).free / (1024**3)
    print(f"Free disk space: {free_gb:.1f} GiB")
    if free_gb < min_free_gb:
        errors.append(f"Free disk space is below {min_free_gb:.1f} GiB: {free_gb:.1f} GiB.")


def _prepare_license(
    root: Path,
    manifest: ModelDevelopmentManifest,
    args: argparse.Namespace,
) -> str | None:
    if not manifest.license.acceptance_required:
        print("  license acceptance: not required")
        return None

    acceptance_record = manifest.license.acceptance_record
    if acceptance_record is None:
        return f"{manifest.model_id}: license acceptance is required but no record path is configured."

    acceptance_path = root / acceptance_record
    if acceptance_path.is_file():
        print(f"  license acceptance: existing record {acceptance_record}")
        return None

    if manifest.model_id == HUNYUAN_MODEL_ID and args.accept_hunyuan_license:
        confirmation_error = _hunyuan_confirmation_error(args)
        if confirmation_error:
            return confirmation_error
        acceptance_path.parent.mkdir(parents=True, exist_ok=True)
        acceptance_payload = {
            "schemaVersion": "diplomat.licenseAcceptance.v1",
            "modelId": manifest.model_id,
            "modelName": manifest.name,
            "repoId": manifest.source.repo_id,
            "revision": manifest.source.revision,
            "licenseName": manifest.license.name,
            "licenseUrl": manifest.license.url,
            "acceptedAt": datetime.now(UTC).isoformat(),
            "acceptedFor": "Diplomat 0.40 local development and acceptance testing",
            "restrictedLicenseAcknowledged": True,
            "permittedTerritoryConfirmed": True,
            "noRedistributionConfirmed": True,
            "excludedTerritories": HUNYUAN_EXCLUDED_TERRITORIES,
            "notice": (
                "Hunyuan model weights are user-provided external assets. "
                "They are not included in, sublicensed by, or redistributed with "
                "the MIT-licensed Diplomat source repository."
            ),
        }
        acceptance_path.write_text(
            json.dumps(acceptance_payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"  license acceptance: wrote {acceptance_record}")
        return None

    return (
        f"{manifest.model_id}: license acceptance is required. "
        "Review the upstream license and rerun with --accept-hunyuan-license if accepted."
    )


def _hunyuan_confirmation_error(args: argparse.Namespace) -> str | None:
    missing: list[str] = []
    if not args.confirm_hunyuan_restricted_license:
        missing.append("--confirm-hunyuan-restricted-license")
    if not args.confirm_hunyuan_permitted_territory:
        missing.append("--confirm-hunyuan-permitted-territory")
    if not args.confirm_hunyuan_no_redistribution:
        missing.append("--confirm-hunyuan-no-redistribution")
    if missing:
        return (
            f"{HUNYUAN_MODEL_ID}: Hunyuan license acceptance requires explicit "
            f"compliance confirmations: {', '.join(missing)}."
        )
    return None


def _prepare_auxiliary_files(manifest: ModelDevelopmentManifest, target_dir: Path) -> None:
    if manifest.model_id == HUNYUAN_MODEL_ID:
        _patch_hunyuan_fp8_config(target_dir)
        return
    if manifest.model_id != VIBEVOICE_MODEL_ID:
        return
    config_path = target_dir / "preprocessor_config.json"
    if config_path.is_file():
        print("  auxiliary config: existing preprocessor_config.json")
        return
    payload = {
        "speech_tok_compress_ratio": 3200,
        "target_sample_rate": 24000,
        "normalize_audio": True,
        "target_dB_FS": -25,
        "eps": 1e-6,
    }
    config_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print("  auxiliary config: wrote preprocessor_config.json")


def _patch_hunyuan_fp8_config(target_dir: Path) -> None:
    config_path = target_dir / "config.json"
    if not config_path.is_file():
        return
    payload = json.loads(config_path.read_text(encoding="utf-8"))
    quantization_config = payload.get("quantization_config")
    if not isinstance(quantization_config, dict):
        return
    ignored_layers = quantization_config.pop("ignored_layers", None)
    if ignored_layers is None:
        return
    quantization_config["ignore"] = ignored_layers
    config_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("  auxiliary config: patched Hunyuan FP8 quantization_config.ignore")


def _download_manifest(
    manifest: ModelDevelopmentManifest,
    target_dir: Path,
    args: argparse.Namespace,
) -> str | None:
    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        return "huggingface-hub is required to download model snapshots."

    print(f"  downloading {manifest.source.repo_id}@{manifest.source.revision}")
    for index, expected_file in enumerate(manifest.expected_files, start=1):
        destination = target_dir / expected_file
        if destination.is_file():
            print(f"    [{index}/{len(manifest.expected_files)}] exists: {expected_file}")
            continue
        print(f"    [{index}/{len(manifest.expected_files)}] fetching: {expected_file}")
        repo_id = manifest.source.repo_id
        revision = manifest.source.revision
        filename = expected_file
        local_dir = target_dir
        if manifest.model_id == VIBEVOICE_MODEL_ID and expected_file.startswith(QWEN_TOKENIZER_PREFIX):
            repo_id = QWEN_TOKENIZER_REPO_ID
            revision = QWEN_TOKENIZER_REVISION
            filename = expected_file.removeprefix(QWEN_TOKENIZER_PREFIX)
            local_dir = target_dir / QWEN_TOKENIZER_PREFIX.rstrip("/")
        try:
            hf_hub_download(
                repo_id=repo_id,
                revision=revision,
                filename=filename,
                local_dir=str(local_dir),
                token=args.hf_token,
            )
        except Exception as exc:
            return f"{manifest.model_id}: download failed for {expected_file}: {exc}"

    return None


if __name__ == "__main__":
    raise SystemExit(main())
