import builtins
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from diplomat_worker.translation.base import TranslationCanceled, TranslationRequest
from diplomat_worker.translation.ct2_marian import CTranslate2MarianProvider


class FakeTranslator:
    instances = []

    def __init__(self, model_path: str, device: str, compute_type: str) -> None:
        self.model_path = model_path
        self.device = device
        self.compute_type = compute_type
        self.translate_calls = []
        FakeTranslator.instances.append(self)

    def translate_batch(self, batches):
        self.translate_calls.append(batches)
        return [SimpleNamespace(hypotheses=[["Hello", "world"]]) for _batch in batches]


class FakeSentencePieceProcessor:
    instances = []

    def __init__(self, model_file: str) -> None:
        self.model_file = model_file
        FakeSentencePieceProcessor.instances.append(self)

    def EncodeAsPieces(self, text: str):
        return ["▁" + text]

    def DecodePieces(self, pieces):
        return " ".join(pieces)


def install_fake_ct2_modules(monkeypatch) -> None:
    FakeTranslator.instances.clear()
    FakeSentencePieceProcessor.instances.clear()
    monkeypatch.setitem(sys.modules, "ctranslate2", SimpleNamespace(Translator=FakeTranslator))
    monkeypatch.setitem(
        sys.modules,
        "sentencepiece",
        SimpleNamespace(SentencePieceProcessor=FakeSentencePieceProcessor),
    )


def test_ct2_marian_provider_translates_with_sentencepiece_and_ctranslate2(
    monkeypatch,
    tmp_path: Path,
) -> None:
    install_fake_ct2_modules(monkeypatch)
    model_path = tmp_path / "translation-model"
    model_path.mkdir()
    (model_path / "source.spm").write_bytes(b"source tokenizer")
    (model_path / "target.spm").write_bytes(b"target tokenizer")

    provider = CTranslate2MarianProvider(
        model_path=str(model_path),
        model_label="translation.opus-mt.zh-en",
        device="cuda",
        compute_type="float16",
    )

    result = provider.translate(
        TranslationRequest(
            line_id="line-1",
            source_text="你好世界",
            source_language="zh",
            target_language="en",
        )
    )

    translator = FakeTranslator.instances[0]
    assert translator.model_path == str(model_path)
    assert translator.device == "cuda"
    assert translator.compute_type == "float16"
    assert translator.translate_calls == [[["▁你好世界"]]]
    assert FakeSentencePieceProcessor.instances[0].model_file == str(model_path / "source.spm")
    assert FakeSentencePieceProcessor.instances[1].model_file == str(model_path / "target.spm")
    assert result.line_id == "line-1"
    assert result.translated_text == "Hello world"
    assert result.provider == "ct2-marian"
    assert result.model == "translation.opus-mt.zh-en"


def test_ct2_marian_provider_translates_batch(monkeypatch, tmp_path: Path) -> None:
    install_fake_ct2_modules(monkeypatch)
    model_path = tmp_path / "translation-model"
    model_path.mkdir()
    (model_path / "source.spm").write_bytes(b"source tokenizer")
    (model_path / "target.spm").write_bytes(b"target tokenizer")
    provider = CTranslate2MarianProvider(
        model_path=str(model_path),
        model_label="translation.opus",
    )

    results = provider.translate_batch(
        [
            TranslationRequest("line-1", "你好", "zh", "en"),
            TranslationRequest("line-2", "世界", "zh", "en"),
        ]
    )

    translator = FakeTranslator.instances[0]
    assert translator.translate_calls == [[["▁你好"], ["▁世界"]]]
    assert [result.line_id for result in results] == ["line-1", "line-2"]


def test_ct2_marian_close_drops_loaded_runtime(monkeypatch, tmp_path: Path) -> None:
    install_fake_ct2_modules(monkeypatch)
    model_path = tmp_path / "translation-model"
    model_path.mkdir()
    (model_path / "source.spm").write_bytes(b"source tokenizer")
    (model_path / "target.spm").write_bytes(b"target tokenizer")
    provider = CTranslate2MarianProvider(model_path=str(model_path))

    provider.translate(TranslationRequest("line-1", "你好", "zh", "en"))
    assert provider._translator is not None
    assert provider._source_tokenizer is not None
    assert provider._target_tokenizer is not None

    provider.close()

    assert provider._translator is None
    assert provider._source_tokenizer is None
    assert provider._target_tokenizer is None


def test_ct2_marian_provider_stops_before_loading_when_canceled(tmp_path: Path) -> None:
    class AlreadyCanceled:
        def is_cancel_requested(self) -> bool:
            return True

    provider = CTranslate2MarianProvider(model_path=str(tmp_path / "model"))

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


def test_ct2_marian_provider_reports_missing_optional_dependencies(monkeypatch, tmp_path: Path) -> None:
    original_import = builtins.__import__

    def fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "ctranslate2":
            raise ImportError("missing ctranslate2")
        return original_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    provider = CTranslate2MarianProvider(model_path=str(tmp_path / "model"))

    with pytest.raises(RuntimeError, match="CTranslate2 Marian translation dependencies are not installed"):
        provider.translate(
            TranslationRequest(
                line_id="line-1",
                source_text="Hello",
                source_language="en",
                target_language="zh",
            )
        )
