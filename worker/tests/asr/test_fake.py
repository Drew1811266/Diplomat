from pathlib import Path

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
