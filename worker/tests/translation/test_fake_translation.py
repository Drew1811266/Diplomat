from diplomat_worker.translation.base import TranslationRequest
from diplomat_worker.translation.fake import FakeTranslationProvider


def test_fake_translation_provider_is_deterministic_en_to_zh() -> None:
    provider = FakeTranslationProvider()

    result = provider.translate(
        TranslationRequest(
            line_id="line-1",
            source_text="Hello world",
            source_language="en",
            target_language="zh",
        )
    )

    assert result.line_id == "line-1"
    assert result.translated_text == "[zh] Hello world"
    assert result.provider == "fake"
    assert result.model == "fake-v1"


def test_fake_translation_provider_is_deterministic_zh_to_en() -> None:
    provider = FakeTranslationProvider()

    result = provider.translate(
        TranslationRequest(
            line_id="line-2",
            source_text="你好世界",
            source_language="zh",
            target_language="en",
        )
    )

    assert result.translated_text == "[en] 你好世界"
