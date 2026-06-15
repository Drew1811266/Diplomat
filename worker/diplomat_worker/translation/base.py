from dataclasses import dataclass
from typing import Protocol

from diplomat_worker.asr.base import CancelToken


class TranslationCanceled(RuntimeError):
    pass


@dataclass(frozen=True)
class TranslationRequest:
    line_id: str
    source_text: str
    source_language: str
    target_language: str


@dataclass(frozen=True)
class TranslationResult:
    line_id: str
    translated_text: str
    provider: str
    model: str


class TranslationProvider(Protocol):
    def translate(
        self,
        request: TranslationRequest,
        cancel_token: CancelToken | None = None,
    ) -> TranslationResult:
        raise NotImplementedError


class BatchTranslationProvider(Protocol):
    def translate_batch(
        self,
        requests: list[TranslationRequest],
        cancel_token: CancelToken | None = None,
    ) -> list[TranslationResult]:
        raise NotImplementedError
