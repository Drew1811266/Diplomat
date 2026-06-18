import builtins

from diplomat_worker.runtime.resources import release_runtime_resources


class ClosableResource:
    def __init__(self) -> None:
        self.closed = False

    def close(self) -> None:
        self.closed = True


class FailingCloseResource:
    def close(self) -> None:
        raise RuntimeError("close failed")


def test_release_runtime_resources_calls_close() -> None:
    resource = ClosableResource()

    report = release_runtime_resources(resource)

    assert resource.closed is True
    assert report.closed is True
    assert "Closed runtime resource." in report.messages


def test_release_runtime_resources_allows_missing_close() -> None:
    report = release_runtime_resources(object())

    assert report.closed is False
    assert "Runtime resource has no close hook." in report.messages


def test_release_runtime_resources_captures_close_errors() -> None:
    report = release_runtime_resources(FailingCloseResource())

    assert report.closed is False
    assert "Runtime resource close failed: close failed" in report.messages


def test_release_runtime_resources_skips_accelerator_cleanup_when_torch_missing(monkeypatch) -> None:
    original_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "torch":
            raise ImportError("torch missing")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)

    report = release_runtime_resources(None)

    assert report.accelerator_cache_cleared is False
    assert "Torch is not installed; accelerator cache cleanup skipped." in report.messages
