from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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


class Speaker(CamelModel):
    id: str
    display_name: str = Field(alias="displayName")
    color: str
    style_id: str = Field(alias="styleId")
    merged_into: str | None = Field(default=None, alias="mergedInto")


class SubtitleStyle(CamelModel):
    id: str
    name: str
    font_family: str = Field(alias="fontFamily")
    font_size: float = Field(alias="fontSize", gt=0)
    primary_color: str = Field(alias="primaryColor")
    secondary_color: str = Field(alias="secondaryColor")
    stroke_width: float = Field(alias="strokeWidth", ge=0)
    shadow: float = Field(ge=0)
    position: str
    margin_v: int = Field(alias="marginV", ge=0)
    alignment: str
    bilingual_layout: str = Field(alias="bilingualLayout")
    line_spacing: float = Field(alias="lineSpacing", gt=0)


class SubtitleLine(CamelModel):
    id: str
    start_ms: int = Field(alias="startMs", ge=0)
    end_ms: int = Field(alias="endMs", ge=0)
    speaker_id: str | None = Field(default=None, alias="speakerId")
    source_language: str = Field(alias="sourceLanguage", min_length=2, max_length=12)
    target_language: str | None = Field(default=None, alias="targetLanguage")
    source_text: str = Field(alias="sourceText")
    translated_text: str = Field(default="", alias="translatedText")
    words: list[WordTiming] = Field(default_factory=list)
    style_overrides: dict[str, Any] = Field(default_factory=dict, alias="styleOverrides")
    review_status: Literal["draft", "reviewed", "approved"] = Field(default="draft", alias="reviewStatus")
    ai_origin: AiOrigin = Field(alias="aiOrigin")
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
    project_id: str = Field(alias="projectId")
    media_id: str = Field(alias="mediaId")
    duration_ms: int = Field(alias="durationMs", ge=0)
    speakers: list[Speaker] = Field(default_factory=list)
    styles: list[SubtitleStyle] = Field(default_factory=list)
    lines: list[SubtitleLine] = Field(default_factory=list)
