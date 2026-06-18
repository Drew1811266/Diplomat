from pathlib import Path

from diplomat_worker.asr.base import AsrCanceled, AsrResult, AsrSegment, AsrWord, CancelToken, ProgressCallback
from diplomat_worker.media.audio import AudioChunk


def _normalize_timestamp_ms(value_seconds: float, chunk: AudioChunk | None) -> int:
    value_ms = int(value_seconds * 1000)
    if chunk is None or chunk.start_ms == 0:
        return value_ms
    chunk_duration_ms = chunk.end_ms - chunk.start_ms
    if value_ms <= chunk_duration_ms + 1000:
        return value_ms + chunk.start_ms
    return value_ms


class FasterWhisperTranscriber:
    def __init__(
        self,
        model_name: str,
        model_label: str | None = None,
        device: str = "cpu",
        compute_type: str = "int8",
        language: str = "zh",
        initial_prompt: str | None = None,
    ) -> None:
        self.model_name = model_name
        self.model_label = model_label
        self.device = device
        self.compute_type = compute_type
        self.language = language
        self.initial_prompt = initial_prompt
        self._model = None

    def warmup(self, cancel_token: CancelToken | None = None) -> None:
        if cancel_token is not None and cancel_token.is_cancel_requested():
            raise AsrCanceled("Analysis canceled")
        self._load_model()

    def _load_model(self):
        if self._model is not None:
            return self._model
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise RuntimeError(
                "faster-whisper is not installed. Install the Worker ASR extras before running local ASR."
            ) from exc
        self._model = WhisperModel(self.model_name, device=self.device, compute_type=self.compute_type)
        return self._model

    def close(self) -> None:
        self._model = None

    def transcribe(
        self,
        audio_path: Path,
        chunks: list[AudioChunk],
        progress_callback: ProgressCallback | None = None,
        cancel_token: CancelToken | None = None,
    ) -> AsrResult:
        if cancel_token is not None and cancel_token.is_cancel_requested():
            raise AsrCanceled("Analysis canceled")
        if progress_callback is not None:
            progress_callback(0.05, "Loading faster-whisper model")

        model = self._load_model()
        active_chunk = chunks[0] if len(chunks) == 1 else None
        transcribe_kwargs = {
            "language": self.language,
            "word_timestamps": True,
            "condition_on_previous_text": False,
        }
        if active_chunk is not None:
            transcribe_kwargs["clip_timestamps"] = [
                active_chunk.start_ms / 1000,
                active_chunk.end_ms / 1000,
            ]
        if self.initial_prompt:
            transcribe_kwargs["initial_prompt"] = self.initial_prompt
        if progress_callback is not None:
            progress_callback(0.2, "Running faster-whisper transcription")
        raw_segments, _info = model.transcribe(
            str(audio_path),
            **transcribe_kwargs,
        )
        segments: list[AsrSegment] = []
        for index, segment in enumerate(raw_segments):
            if cancel_token is not None and cancel_token.is_cancel_requested():
                raise AsrCanceled("Analysis canceled")
            words = [
                AsrWord(
                    text=word.word,
                    start_ms=_normalize_timestamp_ms(word.start, active_chunk),
                    end_ms=_normalize_timestamp_ms(word.end, active_chunk),
                    confidence=getattr(word, "probability", None),
                )
                for word in (segment.words or [])
            ]
            segments.append(
                AsrSegment(
                    id=f"segment-{index}",
                    start_ms=_normalize_timestamp_ms(segment.start, active_chunk),
                    end_ms=_normalize_timestamp_ms(segment.end, active_chunk),
                    text=segment.text.strip(),
                    words=words,
                )
            )
            if progress_callback is not None:
                progress_callback(0.2, f"Captured faster-whisper segment {index + 1}")
        if progress_callback is not None:
            progress_callback(1.0, "Faster-whisper transcription completed")
        return AsrResult(
            engine="faster-whisper",
            model=self.model_label or self.model_name,
            language=self.language,
            segments=segments,
        )
