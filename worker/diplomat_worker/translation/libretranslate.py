import json
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from diplomat_worker.asr.base import CancelToken
from diplomat_worker.translation.base import (
    TranslationCanceled,
    TranslationRequest,
    TranslationResult,
)


class LibreTranslateProvider:
    provider = "libretranslate"

    def __init__(
        self,
        endpoint: str,
        api_key: str | None = None,
        timeout_seconds: float = 30,
        opener=urlopen,
    ) -> None:
        self.endpoint = endpoint.rstrip("/") + "/"
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self.opener = opener

    def translate(
        self,
        request: TranslationRequest,
        cancel_token: CancelToken | None = None,
    ) -> TranslationResult:
        if cancel_token and cancel_token.is_cancel_requested():
            raise TranslationCanceled("Translation canceled")

        payload = {
            "q": request.source_text,
            "source": request.source_language,
            "target": request.target_language,
            "format": "text",
        }
        if self.api_key:
            payload["api_key"] = self.api_key

        http_request = Request(
            urljoin(self.endpoint, "translate"),
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with self.opener(http_request, timeout=self.timeout_seconds) as response:
                data = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"LibreTranslate request failed: {exc}") from exc

        translated_text = data.get("translatedText")
        if not isinstance(translated_text, str):
            raise RuntimeError("LibreTranslate response missing translatedText")

        return TranslationResult(
            line_id=request.line_id,
            translated_text=translated_text,
            provider=self.provider,
            model=self.endpoint.rstrip("/"),
        )
