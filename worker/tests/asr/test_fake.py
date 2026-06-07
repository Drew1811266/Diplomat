from pathlib import Path

import pytest

from diplomat_worker.asr.base import AsrCanceled
from diplomat_worker.asr.config import AsrModelConfig, create_transcriber
from diplomat_worker.asr.fake import FakeTranscriber
from diplomat_worker.media.audio import AudioChunk


def test_fake_transcriber_returns_deterministic_segments(tmp_path: Path) -> None:
    transcriber = FakeTranscriber(language="zh")
    chunks = [AudioChunk(index=0, start_ms=0, end_ms=2000)]

    result = transcriber.transcribe(audio_path=tmp_path / "audio.wav", chunks=chunks)

    assert result.engine == "fake-asr"
    assert result.model == "fake-v1"
    assert result.segments[0].start_ms == 0
    assert result.segments[0].end_ms == 2000
    assert result.segments[0].text == "Fake transcript chunk 0"


def test_fake_transcriber_reports_progress(tmp_path: Path) -> None:
    progress: list[tuple[float, str]] = []
    transcriber = FakeTranscriber(language="en")

    result = transcriber.transcribe(
        audio_path=tmp_path / "audio.wav",
        chunks=[
            AudioChunk(index=0, start_ms=0, end_ms=1000),
            AudioChunk(index=1, start_ms=1000, end_ms=2000),
        ],
        progress_callback=lambda value, message: progress.append((value, message)),
    )

    assert result.language == "en"
    assert result.segments[1].text == "Fake transcript chunk 1"
    assert progress[-1] == (1.0, "Fake ASR completed chunk 2 of 2")


def test_fake_transcriber_stops_when_cancel_requested(tmp_path: Path) -> None:
    class AlreadyCanceled:
        def is_cancel_requested(self) -> bool:
            return True

    with pytest.raises(AsrCanceled):
        FakeTranscriber().transcribe(
            audio_path=tmp_path / "audio.wav",
            chunks=[AudioChunk(index=0, start_ms=0, end_ms=1000)],
            cancel_token=AlreadyCanceled(),
        )


def test_asr_provider_factory_creates_fake_transcriber() -> None:
    transcriber = create_transcriber(
        AsrModelConfig(provider="fake", source_language="zh"),
        fallback_language="en",
    )

    assert isinstance(transcriber, FakeTranscriber)
    assert transcriber.language == "zh"
