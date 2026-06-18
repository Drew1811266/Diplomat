import builtins
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from diplomat_worker.translation.base import TranslationCanceled, TranslationRequest
from diplomat_worker.translation.local_llm import LocalLlmTranslationProvider


class FakeTokenizer:
    instances = []

    def __init__(self) -> None:
        self.last_prompt = ""
        FakeTokenizer.instances.append(self)

    @classmethod
    def from_pretrained(cls, model_path: str, **kwargs):
        instance = cls()
        instance.model_path = model_path
        instance.kwargs = kwargs
        return instance

    def __call__(self, prompt: str, return_tensors: str):
        self.last_prompt = prompt
        return {"input_ids": [[1, 2, 3]]}

    def decode(self, tokens, skip_special_tokens: bool):
        return f"{self.last_prompt}\nTranslation: Hello world"


class FakeModel:
    instances = []

    def __init__(self) -> None:
        self.generate_calls = []
        FakeModel.instances.append(self)

    @classmethod
    def from_pretrained(cls, model_path: str, **kwargs):
        instance = cls()
        instance.model_path = model_path
        instance.kwargs = kwargs
        return instance

    def generate(self, **kwargs):
        self.generate_calls.append(kwargs)
        return [["generated"]]


def install_fake_llm_modules(monkeypatch) -> None:
    FakeTokenizer.instances.clear()
    FakeModel.instances.clear()
    monkeypatch.setitem(
        sys.modules,
        "transformers",
        SimpleNamespace(AutoTokenizer=FakeTokenizer, AutoModelForCausalLM=FakeModel),
    )
    monkeypatch.setitem(sys.modules, "torch", SimpleNamespace(float16="float16"))


def test_local_llm_provider_generates_translation_with_local_files(monkeypatch, tmp_path: Path) -> None:
    install_fake_llm_modules(monkeypatch)
    model_path = tmp_path / "qwen3-4b"
    model_path.mkdir()

    provider = LocalLlmTranslationProvider(
        model_path=str(model_path),
        model_label="translation.qwen3.4b",
        device="cuda",
        compute_type="float16",
        max_new_tokens=64,
    )

    result = provider.translate(
        TranslationRequest(
            line_id="line-1",
            source_text="你好世界",
            source_language="zh",
            target_language="en",
        )
    )

    tokenizer = FakeTokenizer.instances[0]
    model = FakeModel.instances[0]
    assert tokenizer.model_path == str(model_path)
    assert tokenizer.kwargs["local_files_only"] is True
    assert model.model_path == str(model_path)
    assert model.kwargs["local_files_only"] is True
    assert model.kwargs["torch_dtype"] == "float16"
    assert model.kwargs["device_map"] == "auto"
    assert "Translate this subtitle from zh to en" in tokenizer.last_prompt
    assert model.generate_calls[0]["max_new_tokens"] == 64
    assert model.generate_calls[0]["do_sample"] is False
    assert result.line_id == "line-1"
    assert result.translated_text == "Hello world"
    assert result.provider == "local-llm"
    assert result.model == "translation.qwen3.4b"


def test_local_llm_close_drops_loaded_runtime(monkeypatch, tmp_path: Path) -> None:
    install_fake_llm_modules(monkeypatch)
    model_path = tmp_path / "qwen3-4b"
    model_path.mkdir()
    provider = LocalLlmTranslationProvider(model_path=str(model_path), device="cuda")

    provider.translate(
        TranslationRequest(
            line_id="line-1",
            source_text="你好世界",
            source_language="zh",
            target_language="en",
        )
    )
    assert provider._model is not None
    assert provider._tokenizer is not None

    provider.close()

    assert provider._model is None
    assert provider._tokenizer is None


def test_local_llm_provider_stops_before_loading_when_canceled(tmp_path: Path) -> None:
    class AlreadyCanceled:
        def is_cancel_requested(self) -> bool:
            return True

    provider = LocalLlmTranslationProvider(model_path=str(tmp_path / "model"))

    with pytest.raises(TranslationCanceled):
        provider.translate(
            TranslationRequest(
                line_id="line-1",
                source_text="Hello",
                source_language="en",
                target_language="zh",
            ),
            cancel_token=AlreadyCanceled(),
        )


def test_local_llm_provider_reports_missing_optional_dependencies(monkeypatch, tmp_path: Path) -> None:
    original_import = builtins.__import__

    def fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "transformers":
            raise ImportError("missing transformers")
        return original_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    provider = LocalLlmTranslationProvider(model_path=str(tmp_path / "model"))

    with pytest.raises(RuntimeError, match="Local LLM translation dependencies are not installed"):
        provider.translate(
            TranslationRequest(
                line_id="line-1",
                source_text="Hello",
                source_language="en",
                target_language="zh",
            )
        )
