import builtins
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from diplomat_worker.asr.base import AsrCanceled
from diplomat_worker.asr.faster_whisper import FasterWhisperTranscriber
from diplomat_worker.media.audio import AudioChunk


class FakeWhisperModel:
    instances = []

    def __init__(self, model_name: str, device: str, compute_type: str) -> None:
        self.model_name = model_name
        self.device = device
        self.compute_type = compute_type
        self.transcribe_calls = []
        FakeWhisperModel.instances.append(self)

    def transcribe(self, audio_path: str, **kwargs):
        self.transcribe_calls.append((audio_path, kwargs))
        segments = [
            SimpleNamespace(
                start=0.25,
                end=1.75,
                text="  你好 world  ",
                words=[
                    SimpleNamespace(word="你好", start=0.25, end=0.75, probability=0.91),
                    SimpleNamespace(word="world", start=0.9, end=1.7, probability=0.82),
                ],
            )
        ]
        return iter(segments), SimpleNamespace(language="zh")


def install_fake_faster_whisper(monkeypatch) -> None:
    FakeWhisperModel.instances.clear()
    monkeypatch.setitem(
        sys.modules,
        "faster_whisper",
        SimpleNamespace(WhisperModel=FakeWhisperModel),
    )


def test_faster_whisper_transcriber_converts_segments_and_words(monkeypatch, tmp_path: Path) -> None:
    install_fake_faster_whisper(monkeypatch)
    progress: list[tuple[float, str]] = []
    audio_path = tmp_path / "audio.wav"
    audio_path.write_bytes(b"audio")

    transcriber = FasterWhisperTranscriber(
        model_name=str(tmp_path / "models" / "asr.fixture.small"),
        model_label="asr.fixture.small",
        device="cuda",
        compute_type="float16",
        language="zh",
        initial_prompt="Use subtitle punctuation",
    )

    result = transcriber.transcribe(
        audio_path=audio_path,
        chunks=[AudioChunk(index=0, start_ms=0, end_ms=2000)],
        progress_callback=lambda value, message: progress.append((value, message)),
    )

    model = FakeWhisperModel.instances[0]
    assert model.model_name.endswith("asr.fixture.small")
    assert model.device == "cuda"
    assert model.compute_type == "float16"
    assert model.transcribe_calls == [
        (
            str(audio_path),
            {
                "language": "zh",
                "word_timestamps": True,
                "condition_on_previous_text": False,
                "clip_timestamps": [0.0, 2.0],
                "initial_prompt": "Use subtitle punctuation",
            },
        )
    ]
    assert result.engine == "faster-whisper"
    assert result.model == "asr.fixture.small"
    assert result.language == "zh"
    assert result.segments[0].start_ms == 250
    assert result.segments[0].end_ms == 1750
    assert result.segments[0].text == "你好 world"
    assert result.segments[0].words[0].text == "你好"
    assert result.segments[0].words[0].confidence == 0.91
    assert progress[0] == (0.05, "Loading faster-whisper model")
    assert progress[-1] == (1.0, "Faster-whisper transcription completed")


def test_faster_whisper_transcriber_clips_single_chunk(monkeypatch, tmp_path: Path) -> None:
    install_fake_faster_whisper(monkeypatch)
    audio_path = tmp_path / "audio.wav"
    audio_path.write_bytes(b"audio")
    transcriber = FasterWhisperTranscriber(model_name="small", language="zh")

    result = transcriber.transcribe(
        audio_path=audio_path,
        chunks=[AudioChunk(index=2, start_ms=60_000, end_ms=90_000)],
    )

    model = FakeWhisperModel.instances[0]
    assert model.transcribe_calls[0][1]["clip_timestamps"] == [60.0, 90.0]
    assert model.transcribe_calls[0][1]["condition_on_previous_text"] is False
    assert result.segments[0].start_ms == 60_250
    assert result.segments[0].end_ms == 61_750


def test_faster_whisper_transcriber_stops_before_loading_when_canceled(tmp_path: Path) -> None:
    class AlreadyCanceled:
        def is_cancel_requested(self) -> bool:
            return True

    transcriber = FasterWhisperTranscriber(model_name=str(tmp_path / "model"))

    with pytest.raises(AsrCanceled):
        transcriber.transcribe(
            audio_path=tmp_path / "audio.wav",
            chunks=[AudioChunk(index=0, start_ms=0, end_ms=1000)],
            cancel_token=AlreadyCanceled(),
        )


def test_faster_whisper_transcriber_reports_missing_optional_dependency(monkeypatch, tmp_path: Path) -> None:
    original_import = builtins.__import__

    def fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "faster_whisper":
            raise ImportError("missing faster-whisper")
        return original_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    transcriber = FasterWhisperTranscriber(model_name=str(tmp_path / "model"))

    with pytest.raises(RuntimeError, match="faster-whisper is not installed"):
        transcriber.transcribe(
            audio_path=tmp_path / "audio.wav",
            chunks=[AudioChunk(index=0, start_ms=0, end_ms=1000)],
        )
