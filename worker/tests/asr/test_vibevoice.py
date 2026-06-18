import sys
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest
import torch

from diplomat_worker.asr.base import AsrCanceled
from diplomat_worker.asr.vibevoice import VibeVoiceTranscriber
from diplomat_worker.media.audio import AudioChunk


class FakeVibeVoiceModel:
    instances = []

    def __init__(self, model_path: str, **kwargs) -> None:
        self.model_path = model_path
        self.kwargs = kwargs
        self.device = None
        FakeVibeVoiceModel.instances.append(self)

    @classmethod
    def from_pretrained(cls, model_path: str, **kwargs):
        return cls(model_path, **kwargs)

    def to(self, device: str):
        self.device = device
        return self

    def eval(self):
        return self

    def generate(self, **kwargs):
        self.generate_kwargs = kwargs
        return torch.tensor([[10, 11, 20, 21, 99]])


class FakeVibeVoiceProcessor:
    instances = []
    pad_id = 0

    def __init__(self, model_path: str, **kwargs) -> None:
        self.model_path = model_path
        self.kwargs = kwargs
        self.tokenizer = SimpleNamespace(eos_token_id=99)
        FakeVibeVoiceProcessor.instances.append(self)

    @classmethod
    def from_pretrained(cls, model_path: str, **kwargs):
        return cls(model_path, **kwargs)

    def __call__(self, **kwargs):
        self.call_kwargs = kwargs
        return {
            "input_ids": torch.tensor([[10, 11]]),
            "attention_mask": torch.tensor([[1, 1]]),
        }

    def decode(self, generated_ids, skip_special_tokens: bool = True):
        self.decoded_ids = generated_ids.tolist()
        return "structured transcript"

    def post_process_transcription(self, text: str):
        return [
            {
                "start_time": "00:00:00.250",
                "end_time": "00:00:01.500",
                "text": "Segment text",
            }
        ]


def install_fake_vibevoice(monkeypatch) -> None:
    FakeVibeVoiceModel.instances.clear()
    FakeVibeVoiceProcessor.instances.clear()
    monkeypatch.setitem(
        sys.modules,
        "vibevoice.modular.modeling_vibevoice_asr",
        SimpleNamespace(VibeVoiceASRForConditionalGeneration=FakeVibeVoiceModel),
    )
    monkeypatch.setitem(
        sys.modules,
        "vibevoice.processor.vibevoice_asr_processor",
        SimpleNamespace(VibeVoiceASRProcessor=FakeVibeVoiceProcessor),
    )


def install_fake_soundfile(monkeypatch) -> None:
    calls = []

    def read(path, start=0, stop=-1, dtype="float32", always_2d=False):
        calls.append(
            {
                "path": path,
                "start": start,
                "stop": stop,
                "dtype": dtype,
                "always_2d": always_2d,
            }
        )
        return np.linspace(-0.1, 0.1, num=1600, dtype=np.float32), 16000

    monkeypatch.setitem(
        sys.modules,
        "soundfile",
        SimpleNamespace(info=lambda path: SimpleNamespace(samplerate=16000), read=read),
    )
    return calls


def test_vibevoice_transcriber_converts_structured_segments(monkeypatch, tmp_path: Path) -> None:
    install_fake_vibevoice(monkeypatch)
    soundfile_calls = install_fake_soundfile(monkeypatch)
    model_dir = tmp_path / "vibevoice"
    (model_dir / "qwen-tokenizer").mkdir(parents=True)
    audio_path = tmp_path / "audio.wav"
    audio_path.write_bytes(b"audio")
    progress: list[tuple[float, str]] = []

    transcriber = VibeVoiceTranscriber(
        model_name=str(model_dir),
        model_label="asr.microsoft.vibevoice-asr",
        device="cpu",
        compute_type="bfloat16",
        language="zh",
        initial_prompt="Course terms",
    )

    result = transcriber.transcribe(
        audio_path,
        [AudioChunk(index=2, start_ms=60_000, end_ms=90_000)],
        progress_callback=lambda value, message: progress.append((value, message)),
    )

    model = FakeVibeVoiceModel.instances[0]
    processor = FakeVibeVoiceProcessor.instances[0]
    assert model.model_path == str(model_dir)
    assert model.kwargs["local_files_only"] is True
    assert model.kwargs["attn_implementation"] == "sdpa"
    assert model.device == "cpu"
    assert processor.kwargs["language_model_pretrained_name"] == str(model_dir / "qwen-tokenizer")
    assert processor.call_kwargs["sampling_rate"] == 16000
    assert processor.call_kwargs["context_info"] == "Course terms"
    assert soundfile_calls[0]["start"] == 960_000
    assert soundfile_calls[0]["stop"] == 1_440_000
    assert result.engine == "vibevoice-asr"
    assert result.model == "asr.microsoft.vibevoice-asr"
    assert result.language == "zh"
    assert result.segments[0].start_ms == 60_250
    assert result.segments[0].end_ms == 61_500
    assert result.segments[0].text == "Segment text"
    assert progress[0] == (0.05, "Loading VibeVoice ASR model")
    assert progress[-1] == (1.0, "VibeVoice ASR transcription completed")


def test_vibevoice_transcriber_falls_back_to_raw_text(monkeypatch, tmp_path: Path) -> None:
    install_fake_vibevoice(monkeypatch)
    install_fake_soundfile(monkeypatch)

    def empty_post_process(self, text: str):
        return []

    monkeypatch.setattr(FakeVibeVoiceProcessor, "post_process_transcription", empty_post_process)
    model_dir = tmp_path / "vibevoice"
    (model_dir / "qwen-tokenizer").mkdir(parents=True)
    transcriber = VibeVoiceTranscriber(model_name=str(model_dir), device="cpu")

    result = transcriber.transcribe(
        tmp_path / "audio.wav",
        [AudioChunk(index=0, start_ms=0, end_ms=10_000)],
    )

    assert result.segments[0].start_ms == 0
    assert result.segments[0].end_ms == 10_000
    assert result.segments[0].text == "structured transcript"


def test_vibevoice_transcriber_stops_before_loading_when_canceled(tmp_path: Path) -> None:
    class AlreadyCanceled:
        def is_cancel_requested(self) -> bool:
            return True

    transcriber = VibeVoiceTranscriber(model_name=str(tmp_path / "model"))

    with pytest.raises(AsrCanceled):
        transcriber.transcribe(
            audio_path=tmp_path / "audio.wav",
            chunks=[AudioChunk(index=0, start_ms=0, end_ms=1000)],
            cancel_token=AlreadyCanceled(),
        )
