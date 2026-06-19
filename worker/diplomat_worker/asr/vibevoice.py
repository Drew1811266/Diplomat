from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from diplomat_worker.asr.base import AsrCanceled, AsrResult, AsrSegment, CancelToken, ProgressCallback
from diplomat_worker.media.audio import AudioChunk


def _parse_timestamp_ms(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(float(value) * 1000)
    text = str(value).strip()
    if not text:
        return None
    if re.fullmatch(r"\d+(\.\d+)?", text):
        return int(float(text) * 1000)
    parts = text.split(":")
    if len(parts) not in {2, 3}:
        return None
    try:
        seconds = float(parts[-1])
        minutes = int(parts[-2])
        hours = int(parts[-3]) if len(parts) == 3 else 0
    except ValueError:
        return None
    return int(((hours * 60 + minutes) * 60 + seconds) * 1000)


def _normalize_timestamp_ms(value: Any, chunk: AudioChunk | None, fallback_ms: int) -> int:
    parsed = _parse_timestamp_ms(value)
    if parsed is None:
        return fallback_ms
    if chunk is None or chunk.start_ms == 0:
        return parsed
    chunk_duration_ms = chunk.end_ms - chunk.start_ms
    if parsed <= chunk_duration_ms + 1000:
        return chunk.start_ms + parsed
    return parsed


class VibeVoiceTranscriber:
    def __init__(
        self,
        model_name: str,
        model_label: str | None = None,
        device: str = "cuda",
        compute_type: str = "bfloat16",
        language: str = "zh",
        initial_prompt: str | None = None,
        tokenizer_name: str | None = None,
        max_new_tokens: int = 4096,
        attn_implementation: str = "sdpa",
    ) -> None:
        self.model_name = model_name
        self.model_label = model_label
        self.device = device
        self.compute_type = compute_type
        self.language = language
        self.initial_prompt = initial_prompt
        self.tokenizer_name = tokenizer_name
        self.max_new_tokens = max_new_tokens
        self.attn_implementation = attn_implementation
        self._model = None
        self._processor = None
        self._runtime_device = device

    def warmup(self, cancel_token: CancelToken | None = None) -> None:
        if cancel_token is not None and cancel_token.is_cancel_requested():
            raise AsrCanceled("Analysis canceled")
        self._load_model()

    def _load_model(self):
        if self._model is not None and self._processor is not None:
            return self._model, self._processor
        try:
            import torch
            from vibevoice.modular.modeling_vibevoice_asr import VibeVoiceASRForConditionalGeneration
            from vibevoice.processor.vibevoice_asr_processor import VibeVoiceASRProcessor
        except ImportError as exc:
            raise RuntimeError(
                "VibeVoice ASR is not installed. Install the Worker ASR extras before running VibeVoice."
            ) from exc

        model_path = Path(self.model_name)
        tokenizer_path = Path(self.tokenizer_name) if self.tokenizer_name else model_path / "qwen-tokenizer"
        if not tokenizer_path.exists():
            raise RuntimeError(f"VibeVoice tokenizer files are missing: {tokenizer_path}")

        processor = VibeVoiceASRProcessor.from_pretrained(
            str(model_path),
            language_model_pretrained_name=str(tokenizer_path),
            local_files_only=True,
        )
        dtype = self._torch_dtype(torch)
        model = VibeVoiceASRForConditionalGeneration.from_pretrained(
            str(model_path),
            dtype=dtype,
            attn_implementation=self.attn_implementation,
            trust_remote_code=True,
            local_files_only=True,
        )
        if self.device != "auto":
            model = model.to(self.device)
            self._runtime_device = self.device
        else:
            self._runtime_device = str(next(model.parameters()).device)
        model.eval()
        self._model = model
        self._processor = processor
        return model, processor

    def _torch_dtype(self, torch):
        if self.compute_type in {"bfloat16", "bf16"}:
            return torch.bfloat16
        if self.compute_type == "float16":
            return torch.float16
        return torch.float32

    def close(self) -> None:
        self._model = None
        self._processor = None
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            return

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
            progress_callback(0.05, "Loading VibeVoice ASR model")

        model, processor = self._load_model()
        chunk = chunks[0] if len(chunks) == 1 else None
        audio_array, sampling_rate = self._read_audio(audio_path, chunk)
        if progress_callback is not None:
            progress_callback(0.2, "Running VibeVoice ASR transcription")

        import torch

        inputs = processor(
            audio=[audio_array],
            sampling_rate=sampling_rate,
            return_tensors="pt",
            padding=True,
            add_generation_prompt=True,
            context_info=self.initial_prompt,
        )
        inputs = {
            key: value.to(self._runtime_device) if isinstance(value, torch.Tensor) else value
            for key, value in inputs.items()
        }
        generation_config = {
            "max_new_tokens": self.max_new_tokens,
            "pad_token_id": processor.pad_id,
            "eos_token_id": processor.tokenizer.eos_token_id,
            "do_sample": False,
        }
        if cancel_token is not None and cancel_token.is_cancel_requested():
            raise AsrCanceled("Analysis canceled")
        with torch.no_grad():
            output_ids = model.generate(**inputs, **generation_config)

        input_length = inputs["input_ids"].shape[1]
        generated_ids = output_ids[0, input_length:]
        eos_positions = (generated_ids == processor.tokenizer.eos_token_id).nonzero(as_tuple=True)[0]
        if len(eos_positions) > 0:
            generated_ids = generated_ids[: eos_positions[0] + 1]
        raw_text = processor.decode(generated_ids, skip_special_tokens=True)
        parsed_segments = processor.post_process_transcription(raw_text)
        segments = self._convert_segments(parsed_segments, chunk, raw_text)

        if progress_callback is not None:
            progress_callback(1.0, "VibeVoice ASR transcription completed")
        return AsrResult(
            engine="vibevoice-asr",
            model=self.model_label or self.model_name,
            language=self.language,
            segments=segments,
        )

    def _read_audio(self, audio_path: Path, chunk: AudioChunk | None):
        try:
            import numpy as np
            import soundfile as sf
        except ImportError as exc:
            raise RuntimeError("soundfile and numpy are required for VibeVoice ASR audio loading.") from exc

        info = sf.info(str(audio_path))
        start_frame = int((chunk.start_ms / 1000) * info.samplerate) if chunk is not None else 0
        stop_frame = int((chunk.end_ms / 1000) * info.samplerate) if chunk is not None else -1
        audio_array, sampling_rate = sf.read(
            str(audio_path),
            start=start_frame,
            stop=stop_frame,
            dtype="float32",
            always_2d=False,
        )
        if getattr(audio_array, "ndim", 1) > 1:
            audio_array = np.mean(audio_array, axis=1)
        return audio_array, int(sampling_rate)

    def _convert_segments(
        self,
        parsed_segments: list[dict[str, Any]],
        chunk: AudioChunk | None,
        raw_text: str,
    ) -> list[AsrSegment]:
        converted: list[AsrSegment] = []
        fallback_start = chunk.start_ms if chunk is not None else 0
        fallback_end = chunk.end_ms if chunk is not None else max(fallback_start + 1000, fallback_start)
        for index, item in enumerate(parsed_segments):
            text = str(item.get("text") or "").strip()
            if not text:
                continue
            start_ms = _normalize_timestamp_ms(item.get("start_time"), chunk, fallback_start)
            end_ms = _normalize_timestamp_ms(item.get("end_time"), chunk, fallback_end)
            if end_ms <= start_ms:
                end_ms = min(fallback_end, start_ms + 1000) if fallback_end > start_ms else start_ms + 1000
            converted.append(
                AsrSegment(
                    id=f"segment-{index}",
                    start_ms=start_ms,
                    end_ms=end_ms,
                    text=text,
                    words=[],
                )
            )
        if converted:
            return converted
        fallback_text = raw_text.strip()
        if not fallback_text:
            return []
        return [
            AsrSegment(
                id="segment-0",
                start_ms=fallback_start,
                end_ms=fallback_end,
                text=fallback_text,
                words=[],
            )
        ]
