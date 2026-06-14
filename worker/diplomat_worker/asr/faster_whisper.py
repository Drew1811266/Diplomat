from pathlib import Path

from diplomat_worker.asr.base import AsrCanceled, AsrResult, AsrSegment, AsrWord, CancelToken, ProgressCallback
from diplomat_worker.media.audio import AudioChunk


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

    def transcribe(
        self,
        audio_path: Path,
        chunks: list[AudioChunk],
        progress_callback: ProgressCallback | None = None,
        cancel_token: CancelToken | None = None,
    ) -> AsrResult:
        from faster_whisper import WhisperModel

        if cancel_token is not None and cancel_token.is_cancel_requested():
            raise AsrCanceled("Analysis canceled")
        if progress_callback is not None:
            progress_callback(0.05, "Loading faster-whisper model")

        model = WhisperModel(self.model_name, device=self.device, compute_type=self.compute_type)
        transcribe_kwargs = {
            "language": self.language,
            "word_timestamps": True,
        }
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
