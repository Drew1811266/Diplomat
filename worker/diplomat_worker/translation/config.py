import os
from dataclasses import dataclass
from typing import Literal

from diplomat_worker.translation.fake import FakeTranslationProvider
from diplomat_worker.translation.libretranslate import LibreTranslateProvider

TranslationProviderName = Literal["fake", "libretranslate"]


@dataclass(frozen=True)
class TranslationProviderConfig:
    provider: TranslationProviderName = "fake"
    endpoint: str | None = None
    api_key_env: str | None = None

    def to_request_payload(self) -> dict[str, str]:
        payload = {"provider": self.provider}
        if self.endpoint:
            payload["endpoint"] = self.endpoint
        if self.api_key_env:
            payload["apiKeyEnv"] = self.api_key_env
        return payload

    @classmethod
    def from_request_payload(cls, payload: dict) -> "TranslationProviderConfig":
        return cls(
            provider=payload.get("provider", "fake"),
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
    raise ValueError(f"Unsupported translation provider: {config.provider}")
