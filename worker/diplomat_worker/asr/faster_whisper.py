from pathlib import Path

from diplomat_worker.asr.base import AsrResult, AsrSegment, AsrWord
from diplomat_worker.media.audio import AudioChunk


class FasterWhisperTranscriber:
    def __init__(self, model_name: str, device: str = "cuda", compute_type: str = "float16", language: str = "zh") -> None:
        self.model_name = model_name
        self.device = device
        self.compute_type = compute_type
        self.language = language

    def transcribe(self, audio_path: Path, chunks: list[AudioChunk]) -> AsrResult:
        from faster_whisper import WhisperModel

        model = WhisperModel(self.model_name, device=self.device, compute_type=self.compute_type)
        raw_segments, _info = model.transcribe(
            str(audio_path),
            language=self.language,
            word_timestamps=True,
        )
        segments: list[AsrSegment] = []
        for index, segment in enumerate(raw_segments):
            words = [
                AsrWord(
                    text=word.word,
                    start_ms=int(word.start * 1000),
                    end_ms=int(word.end * 1000),
                    confidence=getattr(word, "probability", None),
                )
                for word in (segment.words or [])
            ]
            segments.append(
                AsrSegment(
                    id=f"segment-{index}",
                    start_ms=int(segment.start * 1000),
                    end_ms=int(segment.end * 1000),
                    text=segment.text.strip(),
                    words=words,
                )
            )
        return AsrResult(
            engine="faster-whisper",
            model=self.model_name,
            language=self.language,
            segments=segments,
        )
