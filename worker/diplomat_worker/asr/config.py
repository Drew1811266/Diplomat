from dataclasses import dataclass
from typing import Literal

from diplomat_worker.asr.fake import FakeTranscriber
from diplomat_worker.asr.faster_whisper import FasterWhisperTranscriber

AsrProvider = Literal["fake", "faster-whisper"]


@dataclass(frozen=True)
class AsrModelConfig:
    provider: AsrProvider = "fake"
    model_name_or_path: str | None = None
    device: str = "cpu"
    compute_type: str = "int8"
    source_language: str | None = None
    initial_prompt: str | None = None

    def to_request_payload(self) -> dict[str, str]:
        payload: dict[str, str] = {"provider": self.provider}
        if self.model_name_or_path:
            payload["modelNameOrPath"] = self.model_name_or_path
        if self.provider != "fake" or self.device != "cpu":
            payload["device"] = self.device
        if self.provider != "fake" or self.compute_type != "int8":
            payload["computeType"] = self.compute_type
        if self.source_language:
            payload["sourceLanguage"] = self.source_language
        if self.initial_prompt:
            payload["initialPrompt"] = self.initial_prompt
        return payload

    @classmethod
    def from_request_payload(cls, payload: dict) -> "AsrModelConfig":
        return cls(
            provider=payload.get("provider", "fake"),
            model_name_or_path=payload.get("modelNameOrPath") or payload.get("model_name_or_path"),
            device=payload.get("device", "cpu"),
            compute_type=payload.get("computeType") or payload.get("compute_type", "int8"),
            source_language=payload.get("sourceLanguage") or payload.get("source_language"),
            initial_prompt=payload.get("initialPrompt") or payload.get("initial_prompt"),
        )


def create_transcriber(config: AsrModelConfig, fallback_language: str):
    language = config.source_language or fallback_language
    if config.provider == "fake":
        return FakeTranscriber(language=language)
    if config.provider == "faster-whisper":
        return FasterWhisperTranscriber(
            model_name=config.model_name_or_path or "base",
            device=config.device,
            compute_type=config.compute_type,
            language=language,
            initial_prompt=config.initial_prompt,
        )
    raise ValueError(f"Unsupported ASR provider: {config.provider}")
