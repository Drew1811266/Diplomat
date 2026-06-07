from pathlib import Path

from diplomat_worker.asr.base import AsrCanceled, AsrResult, AsrSegment, AsrWord, CancelToken, ProgressCallback
from diplomat_worker.media.audio import AudioChunk


class FakeTranscriber:
    def __init__(self, language: str = "zh") -> None:
        self.language = language

    def transcribe(
        self,
        audio_path: Path,
        chunks: list[AudioChunk],
        progress_callback: ProgressCallback | None = None,
        cancel_token: CancelToken | None = None,
    ) -> AsrResult:
        segments = []
        total_chunks = len(chunks)
        for position, chunk in enumerate(chunks, start=1):
            if cancel_token is not None and cancel_token.is_cancel_requested():
                raise AsrCanceled("Analysis canceled")

            segments.append(
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
            )
            if progress_callback is not None and total_chunks > 0:
                progress_callback(
                    position / total_chunks,
                    f"Fake ASR completed chunk {position} of {total_chunks}",
                )

        if progress_callback is not None and total_chunks == 0:
            progress_callback(1.0, "Fake ASR completed")

        return AsrResult(engine="fake-asr", model="fake-v1", language=self.language, segments=segments)
