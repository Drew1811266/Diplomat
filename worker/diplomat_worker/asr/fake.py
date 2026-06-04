from pathlib import Path

from diplomat_worker.asr.base import AsrResult, AsrSegment, AsrWord
from diplomat_worker.media.audio import AudioChunk


class FakeTranscriber:
    def __init__(self, language: str = "zh") -> None:
        self.language = language

    def transcribe(self, audio_path: Path, chunks: list[AudioChunk]) -> AsrResult:
        segments = [
            AsrSegment(
                id=f"segment-{chunk.index}",
                start_ms=chunk.start_ms,
                end_ms=chunk.end_ms,
                text=f"Fake transcript chunk {chunk.index}",
                words=[
                    AsrWord(
                        text=f"chunk-{chunk.index}",
                        start_ms=chunk.start_ms,
                        end_ms=chunk.end_ms,
                        confidence=1.0,
                    )
                ],
            )
            for chunk in chunks
        ]
        return AsrResult(engine="fake-asr", model="fake-v1", language=self.language, segments=segments)
