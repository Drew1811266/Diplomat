from diplomat_worker.asr.base import CancelToken
from diplomat_worker.translation.base import (
    TranslationCanceled,
    TranslationRequest,
    TranslationResult,
)


class FakeTranslationProvider:
    provider = "fake"
    model = "fake-v1"

    def translate(
        self,
        request: TranslationRequest,
        cancel_token: CancelToken | None = None,
    ) -> TranslationResult:
        if cancel_token and cancel_token.is_cancel_requested():
            raise TranslationCanceled("Translation canceled")
        return TranslationResult(
            line_id=request.line_id,
            translated_text=f"[{request.target_language}] {request.source_text}",
            provider=self.provider,
            model=self.model,
        )
