import json
from urllib.error import HTTPError

import pytest

from diplomat_worker.translation.base import TranslationRequest
from diplomat_worker.translation.libretranslate import LibreTranslateProvider


class FakeResponse:
    def __init__(self, payload: dict) -> None:
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps(self.payload).encode("utf-8")


def test_libretranslate_provider_posts_json_request() -> None:
    calls = []

    def opener(request, timeout):
        calls.append((request, timeout))
        return FakeResponse({"translatedText": "你好"})

    provider = LibreTranslateProvider(
        endpoint="http://translate.local",
        api_key="secret",
        opener=opener,
    )

    result = provider.translate(
        TranslationRequest(
            line_id="line-1",
            source_text="Hello",
            source_language="en",
            target_language="zh",
        )
    )

    assert result.translated_text == "你好"
    assert result.provider == "libretranslate"
    assert result.model == "http://translate.local"
    body = json.loads(calls[0][0].data.decode("utf-8"))
    assert body == {
        "q": "Hello",
        "source": "en",
        "target": "zh",
        "format": "text",
        "api_key": "secret",
    }
    assert calls[0][0].full_url == "http://translate.local/translate"


def test_libretranslate_provider_reports_http_errors() -> None:
    def opener(request, timeout):
        raise HTTPError(request.full_url, 500, "broken", {}, None)

    provider = LibreTranslateProvider(endpoint="http://translate.local", opener=opener)

    with pytest.raises(RuntimeError, match="LibreTranslate request failed"):
        provider.translate(
            TranslationRequest(
                line_id="line-1",
                source_text="Hello",
                source_language="en",
                target_language="zh",
            )
        )
