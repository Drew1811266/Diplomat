from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_serializer,
    model_validator,
)


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class WordTiming(CamelModel):
    text: str
    start_ms: int = Field(alias="startMs", ge=0)
    end_ms: int = Field(alias="endMs", ge=0)
    confidence: float | None = Field(default=None, ge=0, le=1)

    @model_validator(mode="after")
    def validate_timing(self) -> "WordTiming":
        if self.end_ms < self.start_ms:
            raise ValueError("word end_ms must be greater than or equal to start_ms")
        return self


class AiOrigin(CamelModel):
    engine: str
    model: str


class TranslationOrigin(CamelModel):
    provider: str = Field(min_length=1)
    model: str = Field(min_length=1)


TranslationStatus = Literal["not_requested", "queued", "translated", "edited", "failed"]


class Speaker(CamelModel):
    id: str = Field(min_length=1)
    display_name: str = Field(alias="displayName", min_length=1)
    color: str = Field(min_length=1)
    style_id: str = Field(alias="styleId", min_length=1)
    merged_into: str | None = Field(default=None, alias="mergedInto")


class SubtitleStyle(CamelModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    font_family: str = Field(alias="fontFamily", min_length=1)
    font_size: float = Field(alias="fontSize", gt=0)
    primary_color: str = Field(alias="primaryColor", min_length=1)
    secondary_color: str = Field(alias="secondaryColor", min_length=1)
    stroke_width: float = Field(alias="strokeWidth", ge=0)
    shadow: float = Field(ge=0)
    position: str = Field(min_length=1)
    margin_v: int = Field(alias="marginV", ge=0)
    alignment: str = Field(min_length=1)
    bilingual_layout: str = Field(alias="bilingualLayout", min_length=1)
    line_spacing: float = Field(alias="lineSpacing", gt=0)
    background_bar: bool = Field(default=False, alias="backgroundBar")
    background_color: str = Field(default="#000000cc", alias="backgroundColor", min_length=1)
    safe_area_margin: int = Field(default=32, alias="safeAreaMargin", ge=0)


class StyleOverrides(CamelModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    font_size: float | None = Field(default=None, alias="fontSize", gt=0)
    position: str | None = None
    primary_color: str | None = Field(default=None, alias="primaryColor")
    secondary_color: str | None = Field(default=None, alias="secondaryColor")
    stroke_width: float | None = Field(default=None, alias="strokeWidth", ge=0)

    @model_serializer(mode="wrap")
    def serialize_model(self, handler):
        return {key: value for key, value in handler(self).items() if value is not None}


class SubtitleLine(CamelModel):
    id: str = Field(min_length=1)
    start_ms: int = Field(alias="startMs", ge=0)
    end_ms: int = Field(alias="endMs", ge=0)
    speaker_id: str | None = Field(default=None, alias="speakerId")
    source_language: str = Field(alias="sourceLanguage", min_length=2, max_length=12)
    target_language: str | None = Field(default=None, alias="targetLanguage")
    source_text: str = Field(alias="sourceText")
    translated_text: str = Field(default="", alias="translatedText")
    words: list[WordTiming] = Field(default_factory=list)
    style_overrides: StyleOverrides = Field(default_factory=StyleOverrides, alias="styleOverrides")
    review_status: Literal["draft", "reviewed", "approved"] = Field(
        default="draft",
        alias="reviewStatus",
    )
    ai_origin: AiOrigin = Field(alias="aiOrigin")
    translation_status: TranslationStatus = Field(
        default="not_requested",
        alias="translationStatus",
    )
    translation_origin: TranslationOrigin | None = Field(
        default=None,
        alias="translationOrigin",
    )
    translation_error: str | None = Field(default=None, alias="translationError")
    notes: str = ""

    @field_validator("target_language")
    @classmethod
    def validate_target_language(cls, value: str | None) -> str | None:
        if value is not None and not (2 <= len(value) <= 12):
            raise ValueError("target_language must be between 2 and 12 characters")
        return value

    @model_validator(mode="after")
    def validate_timing(self) -> "SubtitleLine":
        if self.end_ms <= self.start_ms:
            raise ValueError("line end_ms must be greater than start_ms")
        return self


class SubtitleDocument(CamelModel):
    schema_version: Literal["diplomat.subtitle.v1"] = Field(
        default="diplomat.subtitle.v1",
        alias="schemaVersion",
    )
    project_id: str = Field(alias="projectId", min_length=1)
    media_id: str = Field(alias="mediaId", min_length=1)
    duration_ms: int = Field(alias="durationMs", ge=0)
    speakers: list[Speaker] = Field(default_factory=list)
    styles: list[SubtitleStyle] = Field(default_factory=list)
    lines: list[SubtitleLine] = Field(default_factory=list)
