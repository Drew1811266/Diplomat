import hashlib
import json
import shutil
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from threading import Event, Lock

from diplomat_worker.models.registry import (
    ModelRegistryEntry,
    built_in_model_registry,
    get_model_entry,
)
from diplomat_worker.models.capabilities import RuntimeCapabilities
from diplomat_worker.models.dev_manifests import (
    development_model_path,
    development_readiness,
    get_development_manifest,
)
from diplomat_worker.models.profiles import ModelRuntimeProfile, build_runtime_profiles
from diplomat_worker.storage.project_store import ModelInstallationRecord, ProjectStore


@dataclass(frozen=True)
class ModelAvailability:
    usable: bool
    reason: str | None


@dataclass(frozen=True)
class ModelCatalogEntry:
    registry: ModelRegistryEntry
    installation: ModelInstallationRecord
    availability: ModelAvailability
    runtime_profiles: list[ModelRuntimeProfile]


@dataclass(frozen=True)
class ModelDownloadResponse:
    model_id: str
    status: str
    downloaded_bytes: int
    total_bytes: int
    message: str


@dataclass(frozen=True)
class ModelDeleteResponse:
    model_id: str
    files_deleted: int
    bytes_deleted: int
    message: str


@dataclass(frozen=True)
class HfSnapshotSource:
    repo_id: str
    revision: str


def parse_hf_snapshot_source_url(source_url: str) -> HfSnapshotSource | None:
    parsed = urllib.parse.urlparse(source_url)
    if parsed.scheme != "hf":
        return None

    source = f"{parsed.netloc}{parsed.path}".strip("/")
    if "@" not in source:
        return None

    repo_id, revision = source.rsplit("@", 1)
    if not repo_id or not revision:
        return None
    return HfSnapshotSource(repo_id=repo_id, revision=revision)


def hf_manifest_checksum(
    *,
    repo_id: str,
    revision: str,
    files: list[dict[str, str | int]],
) -> str:
    manifest = {
        "repo": repo_id,
        "revision": revision,
        "files": sorted(
            (
                {
                    "path": str(item["path"]),
                    "size": int(item["size"]),
                    "sha": str(item["sha"]),
                }
                for item in files
            ),
            key=lambda item: item["path"],
        ),
    }
    encoded = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


class ModelCancelToken:
    def __init__(self) -> None:
        self._event = Event()

    def request_cancel(self) -> None:
        self._event.set()

    def is_cancel_requested(self) -> bool:
        return self._event.is_set()


class ModelDownloadManager:
    def __init__(
        self,
        store: ProjectStore,
        registry: list[ModelRegistryEntry] | None = None,
        runtime_capabilities: RuntimeCapabilities | None = None,
        development_model_root: Path | None = None,
        auto_start: bool = True,
        max_workers: int = 1,
    ) -> None:
        self.store = store
        self.registry = registry or built_in_model_registry()
        self.runtime_capabilities = runtime_capabilities or RuntimeCapabilities()
        self.development_model_root = development_model_root
        self.auto_start = auto_start
        self._executor = ThreadPoolExecutor(max_workers=max_workers) if auto_start else None
        self._pending: list[str] = []
        self._cancel_tokens: dict[str, ModelCancelToken] = {}
        self._lock = Lock()

    def list_catalog(self) -> list[ModelCatalogEntry]:
        return [self.get_catalog_entry(entry.model_id) for entry in self.registry]

    def get_catalog_entry(self, model_id: str) -> ModelCatalogEntry:
        entry = get_model_entry(model_id, self.registry)
        tracked_installation = self.store.get_model_installation(
            entry.model_id,
            checksum=entry.checksum,
            total_bytes=entry.download_size_bytes,
        )
        installation = self._development_installation(entry, tracked_installation) or tracked_installation
        return ModelCatalogEntry(
            registry=entry,
            installation=installation,
            availability=self._availability(entry, installation),
            runtime_profiles=build_runtime_profiles(entry, self.runtime_capabilities),
        )

    def start_download(self, model_id: str) -> ModelDownloadResponse:
        entry = get_model_entry(model_id, self.registry)
        token = ModelCancelToken()
        installation = self.store.upsert_model_installation(
            model_id=entry.model_id,
            status="queued",
            installed_path=None,
            downloaded_bytes=0,
            total_bytes=entry.download_size_bytes,
            checksum=entry.checksum,
            error_message=None,
        )
        with self._lock:
            self._cancel_tokens[model_id] = token
            if self.auto_start:
                assert self._executor is not None
                self._executor.submit(self._run_download, model_id)
            else:
                self._pending.append(model_id)
        return self._download_response(installation, "Model download queued.")

    def cancel_download(self, model_id: str) -> ModelDownloadResponse:
        entry = get_model_entry(model_id, self.registry)
        with self._lock:
            token = self._cancel_tokens.setdefault(model_id, ModelCancelToken())
            token.request_cancel()
        installation = self.store.upsert_model_installation(
            model_id=entry.model_id,
            status="canceled",
            installed_path=None,
            downloaded_bytes=self.get_catalog_entry(model_id).installation.downloaded_bytes,
            total_bytes=entry.download_size_bytes,
            checksum=entry.checksum,
            error_message=None,
        )
        return self._download_response(installation, "Model download canceled.")

    def retry_download(self, model_id: str) -> ModelDownloadResponse:
        current = self.get_catalog_entry(model_id).installation
        if current.status not in {"failed", "canceled"}:
            raise ValueError("Only failed or canceled model downloads can be retried")
        return self.start_download(model_id)

    def delete_model(self, model_id: str) -> ModelDeleteResponse:
        entry = get_model_entry(model_id, self.registry)
        files_deleted, bytes_deleted = self.store.delete_model_files(
            entry.model_id,
            checksum=entry.checksum,
            total_bytes=entry.download_size_bytes,
        )
        self.store.delete_model_installation(entry.model_id)
        return ModelDeleteResponse(
            model_id=entry.model_id,
            files_deleted=files_deleted,
            bytes_deleted=bytes_deleted,
            message="Model deleted.",
        )

    def run_pending_once(self) -> None:
        with self._lock:
            model_id = self._pending.pop(0) if self._pending else None
        if model_id is not None:
            self._run_download(model_id)

    def _run_download(self, model_id: str) -> None:
        entry = get_model_entry(model_id, self.registry)
        token = self._cancel_tokens.setdefault(model_id, ModelCancelToken())
        current = self.get_catalog_entry(model_id).installation
        if current.status == "canceled" or token.is_cancel_requested():
            return

        staging_dir = self.store.models_root() / ".downloads" / self.store._safe_filename(model_id)
        final_dir = self.store.safe_model_dir(model_id)
        try:
            self.store.upsert_model_installation(
                model_id=entry.model_id,
                status="downloading",
                installed_path=None,
                downloaded_bytes=0,
                total_bytes=entry.download_size_bytes,
                checksum=entry.checksum,
                error_message=None,
            )
            if staging_dir.exists():
                shutil.rmtree(staging_dir)
            staging_dir.mkdir(parents=True, exist_ok=True)

            downloaded_bytes = self._download_to_staging(entry, staging_dir, token)
            if token.is_cancel_requested():
                self.store.upsert_model_installation(
                    model_id=entry.model_id,
                    status="canceled",
                    installed_path=None,
                    downloaded_bytes=downloaded_bytes,
                    total_bytes=entry.download_size_bytes,
                    checksum=entry.checksum,
                    error_message=None,
                )
                return

            self.store.upsert_model_installation(
                model_id=entry.model_id,
                status="verifying",
                installed_path=None,
                downloaded_bytes=downloaded_bytes,
                total_bytes=entry.download_size_bytes,
                checksum=entry.checksum,
                error_message=None,
            )
            actual_checksum = self._sha256_path(staging_dir)
            if actual_checksum != entry.checksum:
                raise ValueError(
                    f"Model checksum mismatch: expected {entry.checksum}, got {actual_checksum}"
                )

            if final_dir.exists():
                self.store._assert_safe_model_path(final_dir)
                shutil.rmtree(final_dir)
            staging_dir.rename(final_dir)
            self.store.upsert_model_installation(
                model_id=entry.model_id,
                status="installed",
                installed_path=final_dir,
                downloaded_bytes=downloaded_bytes,
                total_bytes=entry.download_size_bytes,
                checksum=entry.checksum,
                error_message=None,
                installed=True,
            )
        except Exception as exc:
            if staging_dir.exists():
                shutil.rmtree(staging_dir)
            self.store.upsert_model_installation(
                model_id=entry.model_id,
                status="failed",
                installed_path=None,
                downloaded_bytes=0,
                total_bytes=entry.download_size_bytes,
                checksum=entry.checksum,
                error_message=str(exc),
            )
        finally:
            with self._lock:
                self._cancel_tokens.pop(model_id, None)

    def _download_to_staging(
        self,
        entry: ModelRegistryEntry,
        staging_dir: Path,
        token: ModelCancelToken,
    ) -> int:
        hf_source = parse_hf_snapshot_source_url(entry.source_url)
        if hf_source is not None:
            return self._download_hf_snapshot(entry, hf_source, staging_dir, token)

        source_path = self._source_path(entry.source_url)
        if source_path is not None:
            target = staging_dir / source_path.name
            target.write_bytes(source_path.read_bytes())
            return target.stat().st_size

        parsed = urllib.parse.urlparse(entry.source_url)
        filename = Path(parsed.path).name or "model.bin"
        target = staging_dir / filename
        downloaded = 0
        with urllib.request.urlopen(entry.source_url, timeout=30) as response:
            with target.open("wb") as handle:
                while True:
                    if token.is_cancel_requested():
                        break
                    chunk = response.read(1024 * 256)
                    if not chunk:
                        break
                    handle.write(chunk)
                    downloaded += len(chunk)
                    self.store.upsert_model_installation(
                        model_id=entry.model_id,
                        status="downloading",
                        installed_path=None,
                        downloaded_bytes=downloaded,
                        total_bytes=entry.download_size_bytes,
                        checksum=entry.checksum,
                        error_message=None,
                    )
        return downloaded

    def _download_hf_snapshot(
        self,
        entry: ModelRegistryEntry,
        source: HfSnapshotSource,
        staging_dir: Path,
        token: ModelCancelToken,
    ) -> int:
        if token.is_cancel_requested():
            return 0

        expected_checksum = self._hf_remote_manifest_checksum(source)
        if expected_checksum != entry.checksum:
            raise ValueError(
                f"Model manifest checksum mismatch: expected {entry.checksum}, got {expected_checksum}"
            )

        try:
            from huggingface_hub import snapshot_download
        except ImportError as exc:
            raise RuntimeError(
                "huggingface-hub is required for curated model downloads. "
                "Install the Worker dependencies before downloading models."
            ) from exc

        snapshot_download(
            repo_id=source.repo_id,
            revision=source.revision,
            local_dir=str(staging_dir),
            local_dir_use_symlinks=False,
        )
        if token.is_cancel_requested():
            return sum(item.stat().st_size for item in staging_dir.rglob("*") if item.is_file())
        return sum(item.stat().st_size for item in staging_dir.rglob("*") if item.is_file())

    def _hf_remote_manifest_checksum(self, source: HfSnapshotSource) -> str:
        url = (
            "https://huggingface.co/api/models/"
            f"{source.repo_id}/revision/{source.revision}?blobs=true"
        )
        with urllib.request.urlopen(url, timeout=30) as response:
            payload = json.load(response)

        files = []
        for sibling in payload.get("siblings") or []:
            lfs = sibling.get("lfs") or {}
            files.append(
                {
                    "path": sibling["rfilename"],
                    "size": sibling.get("size") or lfs.get("size") or 0,
                    "sha": lfs.get("sha256") or sibling.get("blobId") or "",
                }
            )
        return hf_manifest_checksum(
            repo_id=source.repo_id,
            revision=source.revision,
            files=files,
        )

    def _source_path(self, source_url: str) -> Path | None:
        parsed = urllib.parse.urlparse(source_url)
        if parsed.scheme == "file":
            path = Path(urllib.parse.unquote(parsed.path))
            return path if path.is_file() else None
        candidate = Path(source_url)
        return candidate if candidate.is_file() else None

    def _sha256_path(self, path: Path) -> str:
        digest = hashlib.sha256()
        files = [path] if path.is_file() else sorted(item for item in path.rglob("*") if item.is_file())
        if len(files) == 1:
            digest.update(files[0].read_bytes())
            return digest.hexdigest()
        for item in files:
            if item != path:
                digest.update(str(item.relative_to(path)).replace("\\", "/").encode("utf-8"))
            digest.update(item.read_bytes())
        return digest.hexdigest()

    def _availability(
        self,
        entry: ModelRegistryEntry,
        installation: ModelInstallationRecord,
    ) -> ModelAvailability:
        if installation.status == "installed":
            if installation.installed_path is None or not installation.installed_path.exists():
                return ModelAvailability(usable=False, reason="Installed model files are missing.")
            return ModelAvailability(usable=True, reason=None)
        if installation.status == "failed":
            return ModelAvailability(usable=False, reason=installation.error_message or "Model install failed.")
        if installation.status == "canceled":
            return ModelAvailability(usable=False, reason="Model download was canceled.")
        if installation.status in {"queued", "downloading", "verifying"}:
            return ModelAvailability(usable=False, reason="Model download is in progress.")
        development_availability = self._development_availability(entry)
        if development_availability is not None:
            return development_availability
        return ModelAvailability(usable=False, reason="Model is not installed.")

    def _development_availability(self, entry: ModelRegistryEntry) -> ModelAvailability | None:
        try:
            manifest = get_development_manifest(entry.model_id, root=self.development_model_root)
        except KeyError:
            return None

        readiness = development_readiness(manifest, self.development_model_root)
        return ModelAvailability(usable=readiness.usable, reason=readiness.reason)

    def _development_installation(
        self,
        entry: ModelRegistryEntry,
        installation: ModelInstallationRecord,
    ) -> ModelInstallationRecord | None:
        if installation.status in {"installed", "queued", "downloading", "verifying"}:
            return None

        try:
            manifest = get_development_manifest(entry.model_id, root=self.development_model_root)
        except KeyError:
            return None

        readiness = development_readiness(manifest, self.development_model_root)
        if not readiness.usable:
            return None

        return ModelInstallationRecord(
            model_id=entry.model_id,
            status="installed",
            installed_path=development_model_path(manifest, self.development_model_root),
            downloaded_bytes=entry.download_size_bytes,
            total_bytes=entry.download_size_bytes,
            checksum=entry.checksum,
            error_message=None,
            created_at=installation.created_at,
            updated_at=installation.updated_at,
            installed_at=installation.installed_at or installation.updated_at,
        )

    def _download_response(
        self,
        installation: ModelInstallationRecord,
        message: str,
    ) -> ModelDownloadResponse:
        return ModelDownloadResponse(
            model_id=installation.model_id,
            status=installation.status,
            downloaded_bytes=installation.downloaded_bytes,
            total_bytes=installation.total_bytes,
            message=message,
        )
