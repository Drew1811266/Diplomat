import os
from dataclasses import dataclass
from typing import Literal

from diplomat_worker.translation.fake import FakeTranslationProvider
from diplomat_worker.translation.libretranslate import LibreTranslateProvider
from diplomat_worker.translation.ct2_marian import CTranslate2MarianProvider
from diplomat_worker.translation.local_llm import LocalLlmTranslationProvider

TranslationProviderName = Literal["fake", "libretranslate", "ct2-marian", "local-llm"]


@dataclass(frozen=True)
class TranslationProviderConfig:
    provider: TranslationProviderName = "fake"
    model_id: str | None = None
    model_name_or_path: str | None = None
    device: str = "cpu"
    compute_type: str = "int8"
    endpoint: str | None = None
    api_key_env: str | None = None

    def to_request_payload(self) -> dict[str, str]:
        payload = {"provider": self.provider}
        if self.model_id:
            payload["modelId"] = self.model_id
        if self.model_name_or_path:
            payload["modelNameOrPath"] = self.model_name_or_path
        if self.provider != "fake" or self.device != "cpu":
            payload["device"] = self.device
        if self.provider != "fake" or self.compute_type != "int8":
            payload["computeType"] = self.compute_type
        if self.endpoint:
            payload["endpoint"] = self.endpoint
        if self.api_key_env:
            payload["apiKeyEnv"] = self.api_key_env
        return payload

    @classmethod
    def from_request_payload(cls, payload: dict) -> "TranslationProviderConfig":
        return cls(
            provider=payload.get("provider", "fake"),
            model_id=payload.get("modelId") or payload.get("model_id"),
            model_name_or_path=payload.get("modelNameOrPath") or payload.get("model_name_or_path"),
            device=payload.get("device", "cpu"),
            compute_type=payload.get("computeType") or payload.get("compute_type", "int8"),
            endpoint=payload.get("endpoint"),
            api_key_env=payload.get("apiKeyEnv") or payload.get("api_key_env"),
        )


def create_translation_provider(config: TranslationProviderConfig):
    if config.provider == "fake":
        return FakeTranslationProvider()
    if config.provider == "libretranslate":
        endpoint = config.endpoint or os.environ.get("DIPLOMAT_LIBRETRANSLATE_ENDPOINT")
        if not endpoint:
            raise ValueError("LibreTranslate endpoint is required")
        api_key = os.environ.get(config.api_key_env) if config.api_key_env else None
        return LibreTranslateProvider(endpoint=endpoint, api_key=api_key)
    if config.provider == "ct2-marian":
        if not config.model_name_or_path:
            raise ValueError("CTranslate2 Marian model path is required")
        return CTranslate2MarianProvider(
            model_path=config.model_name_or_path,
            model_label=config.model_id,
            device=config.device,
            compute_type=config.compute_type,
        )
    if config.provider == "local-llm":
        if not config.model_name_or_path:
            raise ValueError("Local LLM model path is required")
        return LocalLlmTranslationProvider(
            model_path=config.model_name_or_path,
            model_label=config.model_id,
            device=config.device,
            compute_type=config.compute_type,
        )
    raise ValueError(f"Unsupported translation provider: {config.provider}")
