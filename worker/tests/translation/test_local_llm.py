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
        self.chat_template_calls = []
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

    def apply_chat_template(
        self,
        messages,
        tokenize: bool,
        add_generation_prompt: bool,
        return_tensors: str,
    ):
        self.chat_template_calls.append(
            {
                "messages": messages,
                "tokenize": tokenize,
                "add_generation_prompt": add_generation_prompt,
                "return_tensors": return_tensors,
            }
        )
        self.last_prompt = messages[0]["content"]
        return FakeTensor("tokenized-chat")

    def decode(self, tokens, skip_special_tokens: bool):
        if self.chat_template_calls:
            return f"user\n{self.last_prompt}\nassistant\nTranslation: Hello world"
        return f"{self.last_prompt}\nTranslation: Hello world"


class FakeTensor:
    def __init__(self, value: str) -> None:
        self.value = value
        self.device = None

    def to(self, device: str):
        self.device = device
        return self


class FakeModel:
    instances = []

    def __init__(self) -> None:
        self.generate_calls = []
        self.device = "cuda:0"
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
    monkeypatch.setitem(
        sys.modules,
        "torch",
        SimpleNamespace(
            float16="float16",
            bfloat16="bfloat16",
            cuda=SimpleNamespace(is_available=lambda: True, empty_cache=lambda: None),
        ),
    )


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


def test_hunyuan_provider_uses_chat_template_and_recommended_generation(
    monkeypatch,
    tmp_path: Path,
) -> None:
    install_fake_llm_modules(monkeypatch)
    monkeypatch.setattr("importlib.util.find_spec", lambda name: object() if name == "compressed_tensors" else object())
    model_path = tmp_path / "hunyuan"
    model_path.mkdir()

    provider = LocalLlmTranslationProvider(
        model_path=str(model_path),
        model_label="translation.tencent.hunyuan-mt-7b-fp8",
        device="cuda",
        compute_type="bfloat16",
        max_new_tokens=512,
    )

    result = provider.translate(
        TranslationRequest(
            line_id="line-1",
            source_text="深度学习课程",
            source_language="zh",
            target_language="en",
        )
    )

    tokenizer = FakeTokenizer.instances[0]
    model = FakeModel.instances[0]
    chat_call = tokenizer.chat_template_calls[0]
    assert chat_call["tokenize"] is True
    assert chat_call["add_generation_prompt"] is False
    assert chat_call["return_tensors"] == "pt"
    assert chat_call["messages"] == [
        {
            "role": "user",
            "content": "把下面的文本翻译成英语，不要额外解释。\n\n深度学习课程",
        }
    ]
    assert model.kwargs["torch_dtype"] == "bfloat16"
    assert model.kwargs["device_map"] == "auto"
    assert model.generate_calls[0]["max_new_tokens"] == 512
    assert model.generate_calls[0]["top_k"] == 20
    assert model.generate_calls[0]["top_p"] == 0.6
    assert model.generate_calls[0]["repetition_penalty"] == 1.05
    assert model.generate_calls[0]["temperature"] == 0.7
    assert result.translated_text == "Hello world"


def test_hunyuan_provider_requires_compressed_tensors_for_fp8(monkeypatch, tmp_path: Path) -> None:
    install_fake_llm_modules(monkeypatch)
    monkeypatch.setattr("importlib.util.find_spec", lambda name: None if name == "compressed_tensors" else object())
    model_path = tmp_path / "hunyuan"
    model_path.mkdir()
    provider = LocalLlmTranslationProvider(
        model_path=str(model_path),
        model_label="translation.tencent.hunyuan-mt-7b-fp8",
        device="cuda",
        compute_type="bfloat16",
    )

    with pytest.raises(RuntimeError, match="compressed-tensors"):
        provider.translate(
            TranslationRequest(
                line_id="line-1",
                source_text="Hello",
                source_language="en",
                target_language="zh",
            )
        )


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
