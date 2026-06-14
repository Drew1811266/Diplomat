import hashlib
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
        auto_start: bool = True,
        max_workers: int = 1,
    ) -> None:
        self.store = store
        self.registry = registry or built_in_model_registry()
        self.auto_start = auto_start
        self._executor = ThreadPoolExecutor(max_workers=max_workers) if auto_start else None
        self._pending: list[str] = []
        self._cancel_tokens: dict[str, ModelCancelToken] = {}
        self._lock = Lock()

    def list_catalog(self) -> list[ModelCatalogEntry]:
        return [self.get_catalog_entry(entry.model_id) for entry in self.registry]

    def get_catalog_entry(self, model_id: str) -> ModelCatalogEntry:
        entry = get_model_entry(model_id, self.registry)
        installation = self.store.get_model_installation(
            entry.model_id,
            checksum=entry.checksum,
            total_bytes=entry.download_size_bytes,
        )
        return ModelCatalogEntry(
            registry=entry,
            installation=installation,
            availability=self._availability(installation),
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

    def _availability(self, installation: ModelInstallationRecord) -> ModelAvailability:
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
        return ModelAvailability(usable=False, reason="Model is not installed.")

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
