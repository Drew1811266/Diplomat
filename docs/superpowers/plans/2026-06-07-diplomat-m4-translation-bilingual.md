# Diplomat M4 Translation And Bilingual Subtitles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Worker-owned translation jobs so a project can move from source transcription to editable translated subtitles and reliable source, target, and bilingual SRT export.

**Architecture:** Keep translation as a background Worker task, mirroring M3 analysis jobs. The Worker owns provider execution and subtitle document mutation; shared schemas define task/request/document contracts; the Web workbench starts, polls, cancels, retries, filters, edits, saves, and exports translated subtitles.

**Tech Stack:** Python 3.12, FastAPI, SQLite, Pydantic, thread-based local jobs, deterministic fake translation provider, optional LibreTranslate HTTP provider, React, TypeScript, Zod, Vitest, pytest.

---

## Stage Scope

M4 includes:

- Subtitle line translation metadata: `translationStatus`, `translationOrigin`, and `translationError`.
- Backward-compatible load behavior for existing M2a/M3 subtitle documents that do not contain translation metadata.
- Translation provider interface.
- `FakeTranslationProvider` for deterministic tests and offline demos.
- Optional `LibreTranslateProvider` that calls a configured `/translate` HTTP endpoint.
- Translation settings storage per project.
- Worker translation endpoints:
  - `POST /projects/{project_id}/translation-jobs`
  - `GET /projects/{project_id}/translation-settings`
  - `PUT /projects/{project_id}/translation-settings`
- Translation task progress, cancel, failure, and retry behavior using the M3 task model.
- Web translation panel with provider, language, mode, progress, cancel, retry, and failure diagnostics.
- Line list visibility for source/target snippets and translation state.
- Editor behavior that marks generated translations as edited when the user changes target text.
- Missing-translation filter.
- End-to-end export verification for source, target, and bilingual SRT after translation save/reopen.
- Development docs and M4 stage gate review.

M4 does not include glossary management, translation memory, team review workflows, waveform/timeline editing, style authoring, or burned-in video export.

## External Provider Decision

M4 implements two providers:

- `fake`: deterministic local provider used by tests and default development workflows.
- `libretranslate`: optional HTTP provider configured by local settings or environment variables.

LibreTranslate is selected because its official API exposes `POST /translate` with `q`, `source`, `target`, optional `format`, optional `alternatives`, and optional `api_key`, and returns `translatedText`. Its docs state API keys are optional for self-hosted instances but may be required on configured public instances:

- https://docs.libretranslate.com/api/operations/translate/
- https://docs.libretranslate.com/guides/api_usage/

CI tests must mock LibreTranslate calls and must never call a public translation service.

## File Structure

Worker:

- Modify `worker/diplomat_worker/schemas/subtitle.py`: translation metadata fields and defaults.
- Modify `worker/diplomat_worker/storage/project_store.py`: schema v4 translation settings table and CRUD.
- Create `worker/diplomat_worker/translation/base.py`: provider protocol, request/result dataclasses, cancellation exception.
- Create `worker/diplomat_worker/translation/fake.py`: deterministic provider.
- Create `worker/diplomat_worker/translation/libretranslate.py`: optional HTTP provider using `urllib.request`.
- Create `worker/diplomat_worker/translation/config.py`: config model and provider factory.
- Create `worker/diplomat_worker/tasks/translation.py`: background translation job manager.
- Modify `worker/diplomat_worker/api/runtime.py`: translation provider factory hook.
- Modify `worker/diplomat_worker/api/schemas.py`: translation job/settings schemas.
- Modify `worker/diplomat_worker/api/app.py`: translation settings and job endpoints.
- Modify `worker/diplomat_worker/export/srt.py` only if M4 tests expose export behavior gaps.

Worker tests:

- Modify `worker/tests/schemas/test_subtitle.py`.
- Modify `worker/tests/storage/test_project_store.py`.
- Create `worker/tests/translation/test_fake.py`.
- Create `worker/tests/translation/test_libretranslate.py`.
- Create `worker/tests/tasks/test_translation_jobs.py`.
- Modify `worker/tests/api/test_app.py`.
- Modify `worker/tests/export/test_srt.py`.

Shared/Web:

- Modify `packages/shared/src/subtitle.ts`: translation metadata schemas.
- Modify `packages/shared/src/task.ts`: translation settings/job request schemas.
- Modify `packages/shared/tests/subtitle.test.ts`.
- Modify `packages/shared/tests/task.test.ts`.
- Modify `apps/web/src/api.ts`: translation settings/job helpers.
- Create `apps/web/src/components/TranslationJobPanel.tsx`.
- Modify `apps/web/src/components/SubtitleLineList.tsx`.
- Modify `apps/web/src/components/SubtitleEditor.tsx`.
- Modify `apps/web/src/App.tsx`.
- Modify `apps/web/src/App.css`.
- Modify `apps/web/tests/api.test.ts`.
- Modify `apps/web/tests/App.test.tsx`.

Docs:

- Create `docs/development/m4-translation-bilingual.md`.
- Create `docs/development/m4-stage-gate-review.md`.
- Modify `README.md`.

---

## Task 1: Subtitle Translation Metadata Schemas

**Files:**

- Modify: `worker/diplomat_worker/schemas/subtitle.py`
- Modify: `worker/tests/schemas/test_subtitle.py`
- Modify: `packages/shared/src/subtitle.ts`
- Modify: `packages/shared/tests/subtitle.test.ts`

- [ ] **Step 1: Write failing Python schema tests**

Add these tests to `worker/tests/schemas/test_subtitle.py`:

```python
from diplomat_worker.schemas.subtitle import AiOrigin, SubtitleLine, TranslationOrigin


def make_line(**overrides) -> SubtitleLine:
    payload = {
        "id": "line-1",
        "startMs": 0,
        "endMs": 1200,
        "speakerId": "speaker-1",
        "sourceLanguage": "en",
        "targetLanguage": "zh",
        "sourceText": "Hello world",
        "translatedText": "",
        "words": [],
        "styleOverrides": {},
        "reviewStatus": "draft",
        "aiOrigin": {"engine": "fake-asr", "model": "fake-v1"},
        "notes": "",
    }
    payload.update(overrides)
    return SubtitleLine.model_validate(payload)


def test_subtitle_line_defaults_translation_metadata() -> None:
    line = make_line()

    assert line.translation_status == "not_requested"
    assert line.translation_origin is None
    assert line.translation_error is None

    payload = line.model_dump(by_alias=True)
    assert payload["translationStatus"] == "not_requested"
    assert payload["translationOrigin"] is None
    assert payload["translationError"] is None


def test_subtitle_line_accepts_generated_translation_metadata() -> None:
    line = make_line(
        translatedText="你好，世界",
        translationStatus="translated",
        translationOrigin={"provider": "fake", "model": "fake-v1"},
        translationError=None,
    )

    assert line.translation_status == "translated"
    assert line.translation_origin == TranslationOrigin(provider="fake", model="fake-v1")
```

Run:

```powershell
python -m pytest worker/tests/schemas/test_subtitle.py -q
```

Expected: FAIL because the metadata fields and `TranslationOrigin` do not exist.

- [ ] **Step 2: Implement Python metadata fields**

In `worker/diplomat_worker/schemas/subtitle.py`, add:

```python
class TranslationOrigin(CamelModel):
    provider: str = Field(min_length=1)
    model: str = Field(min_length=1)


TranslationStatus = Literal["not_requested", "queued", "translated", "edited", "failed"]
```

Extend `SubtitleLine`:

```python
translation_status: TranslationStatus = Field(
    default="not_requested",
    alias="translationStatus",
)
translation_origin: TranslationOrigin | None = Field(
    default=None,
    alias="translationOrigin",
)
translation_error: str | None = Field(default=None, alias="translationError")
```

- [ ] **Step 3: Verify Python schema tests pass**

Run:

```powershell
python -m pytest worker/tests/schemas/test_subtitle.py -q
```

Expected: PASS.

- [ ] **Step 4: Write failing shared schema tests**

Add to `packages/shared/tests/subtitle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SubtitleLineSchema } from "../src/subtitle";

describe("translation metadata", () => {
  it("defaults M4 translation metadata for older subtitle lines", () => {
    const parsed = SubtitleLineSchema.parse({
      id: "line-1",
      startMs: 0,
      endMs: 1000,
      speakerId: "speaker-1",
      sourceLanguage: "en",
      targetLanguage: "zh",
      sourceText: "Hello",
      translatedText: "",
      words: [],
      styleOverrides: {},
      reviewStatus: "draft",
      aiOrigin: { engine: "fake-asr", model: "fake-v1" },
      notes: ""
    });

    expect(parsed.translationStatus).toBe("not_requested");
    expect(parsed.translationOrigin).toBeNull();
    expect(parsed.translationError).toBeNull();
  });

  it("accepts generated translation metadata", () => {
    const parsed = SubtitleLineSchema.parse({
      id: "line-1",
      startMs: 0,
      endMs: 1000,
      speakerId: "speaker-1",
      sourceLanguage: "en",
      targetLanguage: "zh",
      sourceText: "Hello",
      translatedText: "你好",
      words: [],
      styleOverrides: {},
      reviewStatus: "draft",
      aiOrigin: { engine: "fake-asr", model: "fake-v1" },
      notes: "",
      translationStatus: "translated",
      translationOrigin: { provider: "fake", model: "fake-v1" },
      translationError: null
    });

    expect(parsed.translationOrigin?.provider).toBe("fake");
  });
});
```

Run:

```powershell
corepack pnpm --filter @diplomat/shared test -- subtitle.test.ts
```

Expected: FAIL because shared schemas do not expose M4 metadata.

- [ ] **Step 5: Implement shared metadata schemas**

In `packages/shared/src/subtitle.ts`, add:

```ts
export const TranslationStatusSchema = z.enum([
  "not_requested",
  "queued",
  "translated",
  "edited",
  "failed"
]);

export const TranslationOriginSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1)
});
```

Extend `SubtitleLineSchema`:

```ts
translationStatus: TranslationStatusSchema.default("not_requested"),
translationOrigin: TranslationOriginSchema.nullable().default(null),
translationError: z.string().nullable().default(null)
```

Export inferred types:

```ts
export type TranslationStatus = z.infer<typeof TranslationStatusSchema>;
export type TranslationOrigin = z.infer<typeof TranslationOriginSchema>;
```

- [ ] **Step 6: Verify schema tests and commit**

Run:

```powershell
python -m pytest worker/tests/schemas/test_subtitle.py -q
corepack pnpm --filter @diplomat/shared test -- subtitle.test.ts
corepack pnpm --filter @diplomat/shared typecheck
```

Expected: PASS.

Commit:

```powershell
git add worker/diplomat_worker/schemas/subtitle.py worker/tests/schemas/test_subtitle.py packages/shared/src/subtitle.ts packages/shared/tests/subtitle.test.ts
git commit -m "feat(shared): add subtitle translation metadata"
```

---

## Task 2: Translation Provider Interface And Providers

**Files:**

- Create: `worker/diplomat_worker/translation/__init__.py`
- Create: `worker/diplomat_worker/translation/base.py`
- Create: `worker/diplomat_worker/translation/fake.py`
- Create: `worker/diplomat_worker/translation/libretranslate.py`
- Create: `worker/diplomat_worker/translation/config.py`
- Create: `worker/tests/translation/test_fake.py`
- Create: `worker/tests/translation/test_libretranslate.py`

- [ ] **Step 1: Write failing fake provider tests**

Create `worker/tests/translation/test_fake.py`:

```python
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
```

Run:

```powershell
python -m pytest worker/tests/translation/test_fake.py -q
```

Expected: FAIL because translation package does not exist.

- [ ] **Step 2: Implement base and fake provider**

Create `worker/diplomat_worker/translation/base.py`:

```python
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
```

Create `worker/diplomat_worker/translation/fake.py`:

```python
from diplomat_worker.translation.base import (
    TranslationCanceled,
    TranslationRequest,
    TranslationResult,
)
from diplomat_worker.asr.base import CancelToken


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
```

Create `worker/diplomat_worker/translation/__init__.py`:

```python
from diplomat_worker.translation.base import TranslationProvider, TranslationRequest, TranslationResult
from diplomat_worker.translation.fake import FakeTranslationProvider

__all__ = [
    "FakeTranslationProvider",
    "TranslationProvider",
    "TranslationRequest",
    "TranslationResult",
]
```

- [ ] **Step 3: Verify fake provider tests pass**

Run:

```powershell
python -m pytest worker/tests/translation/test_fake.py -q
```

Expected: PASS.

- [ ] **Step 4: Write failing LibreTranslate provider tests**

Create `worker/tests/translation/test_libretranslate.py`:

```python
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
```

Run:

```powershell
python -m pytest worker/tests/translation/test_libretranslate.py -q
```

Expected: FAIL because provider is not implemented.

- [ ] **Step 5: Implement LibreTranslate provider**

Create `worker/diplomat_worker/translation/libretranslate.py`:

```python
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
```

- [ ] **Step 6: Implement translation config factory**

Create `worker/diplomat_worker/translation/config.py`:

```python
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
```

- [ ] **Step 7: Verify provider tests and commit**

Run:

```powershell
python -m pytest worker/tests/translation/test_fake.py worker/tests/translation/test_libretranslate.py -q
```

Expected: PASS.

Commit:

```powershell
git add worker/diplomat_worker/translation worker/tests/translation
git commit -m "feat(worker): add translation providers"
```

---

## Task 3: Translation Settings Storage

**Files:**

- Modify: `worker/diplomat_worker/storage/project_store.py`
- Modify: `worker/tests/storage/test_project_store.py`

- [ ] **Step 1: Write failing storage tests**

Add to `worker/tests/storage/test_project_store.py`:

```python
def test_translation_settings_default_to_project_languages(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project(
        name="Demo",
        source_video_path=tmp_path / "demo.mp4",
        duration_ms=1000,
        source_language="zh",
        target_language="en",
    )

    settings = store.get_translation_settings(project.project_id)

    assert settings.project_id == project.project_id
    assert settings.provider == "fake"
    assert settings.source_language == "zh"
    assert settings.target_language == "en"
    assert settings.mode == "missing_only"


def test_translation_settings_can_be_saved_and_reopened(tmp_path: Path) -> None:
    database_path = tmp_path / "diplomat.db"
    store = ProjectStore(database_path)
    project = store.create_project(
        name="Demo",
        source_video_path=tmp_path / "demo.mp4",
        duration_ms=1000,
        source_language="en",
        target_language="zh",
    )

    saved = store.save_translation_settings(
        project.project_id,
        provider="libretranslate",
        source_language="en",
        target_language="zh",
        mode="overwrite_all",
        endpoint="http://localhost:5000",
        api_key_env="LIBRETRANSLATE_API_KEY",
    )
    reopened = ProjectStore(database_path).get_translation_settings(project.project_id)

    assert saved.provider == "libretranslate"
    assert reopened.endpoint == "http://localhost:5000"
    assert reopened.api_key_env == "LIBRETRANSLATE_API_KEY"
```

Run:

```powershell
python -m pytest worker/tests/storage/test_project_store.py -q
```

Expected: FAIL because settings storage does not exist.

- [ ] **Step 2: Implement schema v4 settings table**

In `worker/diplomat_worker/storage/project_store.py`:

- Change `SCHEMA_VERSION = 4`.
- Add:

```python
@dataclass(frozen=True)
class TranslationSettingsRecord:
    project_id: str
    provider: str
    source_language: str
    target_language: str
    mode: str
    endpoint: str | None
    api_key_env: str | None
    updated_at: str
```

- Add `_ensure_translation_settings_table`:

```python
def _ensure_translation_settings_table(self, connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS translation_settings (
            project_id TEXT PRIMARY KEY,
            provider TEXT NOT NULL,
            source_language TEXT NOT NULL,
            target_language TEXT NOT NULL,
            mode TEXT NOT NULL,
            endpoint TEXT,
            api_key_env TEXT,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(project_id)
        )
        """
    )
```

Call `_ensure_translation_settings_table(connection)` in `_initialize` after `_ensure_tasks_table`.

- [ ] **Step 3: Implement settings CRUD**

Add methods:

```python
def get_translation_settings(self, project_id: str) -> TranslationSettingsRecord:
    project = self.get_project(project_id)
    with self._connect() as connection:
        row = connection.execute(
            "SELECT * FROM translation_settings WHERE project_id = ?",
            (project_id,),
        ).fetchone()
    if row is not None:
        return self._translation_settings_from_row(row)
    return TranslationSettingsRecord(
        project_id=project.project_id,
        provider="fake",
        source_language=project.source_language,
        target_language=project.target_language or "en",
        mode="missing_only",
        endpoint=None,
        api_key_env=None,
        updated_at=project.updated_at,
    )


def save_translation_settings(
    self,
    project_id: str,
    provider: str,
    source_language: str,
    target_language: str,
    mode: str,
    endpoint: str | None = None,
    api_key_env: str | None = None,
) -> TranslationSettingsRecord:
    self.get_project(project_id)
    if mode not in {"missing_only", "overwrite_all"}:
        raise ValueError("Unsupported translation mode")
    now = self._utc_now()
    with self._connect() as connection:
        connection.execute(
            """
            INSERT INTO translation_settings (
                project_id, provider, source_language, target_language,
                mode, endpoint, api_key_env, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
                provider = excluded.provider,
                source_language = excluded.source_language,
                target_language = excluded.target_language,
                mode = excluded.mode,
                endpoint = excluded.endpoint,
                api_key_env = excluded.api_key_env,
                updated_at = excluded.updated_at
            """,
            (project_id, provider, source_language, target_language, mode, endpoint, api_key_env, now),
        )
        connection.commit()
    return self.get_translation_settings(project_id)
```

Add `_translation_settings_from_row`.

- [ ] **Step 4: Verify storage tests and commit**

Run:

```powershell
python -m pytest worker/tests/storage/test_project_store.py -q
```

Expected: PASS.

Commit:

```powershell
git add worker/diplomat_worker/storage/project_store.py worker/tests/storage/test_project_store.py
git commit -m "feat(worker): store translation settings"
```

---

## Task 4: Translation Job Manager

**Files:**

- Create: `worker/diplomat_worker/tasks/translation.py`
- Create: `worker/tests/tasks/test_translation_jobs.py`
- Modify: `worker/diplomat_worker/api/runtime.py`

- [ ] **Step 1: Write failing translation job tests**

Create `worker/tests/tasks/test_translation_jobs.py`:

```python
from pathlib import Path

import pytest

from diplomat_worker.api.runtime import WorkerRuntime
from diplomat_worker.schemas.subtitle import AiOrigin, SubtitleDocument, SubtitleLine
from diplomat_worker.storage.project_store import ProjectStore
from diplomat_worker.tasks.translation import TranslationJobManager
from diplomat_worker.translation.config import TranslationProviderConfig


def make_runtime(tmp_path: Path) -> WorkerRuntime:
    return WorkerRuntime(store=ProjectStore(tmp_path / "diplomat.db"), transcriber=None)


def create_project_with_document(runtime: WorkerRuntime, tmp_path: Path) -> str:
    project = runtime.store.create_project(
        name="Demo",
        source_video_path=tmp_path / "demo.mp4",
        duration_ms=2000,
        source_language="en",
        target_language="zh",
    )
    document = SubtitleDocument(
        project_id=project.project_id,
        media_id="media-1",
        duration_ms=2000,
        speakers=[],
        styles=[],
        lines=[
            SubtitleLine(
                id="line-1",
                start_ms=0,
                end_ms=1000,
                speaker_id=None,
                source_language="en",
                target_language="zh",
                source_text="Hello world",
                translated_text="",
                words=[],
                style_overrides={},
                review_status="draft",
                ai_origin=AiOrigin(engine="fake-asr", model="fake-v1"),
                notes="",
            )
        ],
    )
    runtime.store.save_subtitle_document(project.project_id, document)
    return project.project_id


def test_translation_job_updates_missing_translations(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project_with_document(runtime, tmp_path)
    manager = TranslationJobManager(runtime, auto_start=False)

    task = manager.create_translation_job(
        project_id,
        source_language="en",
        target_language="zh",
        mode="missing_only",
        provider_config=TranslationProviderConfig(provider="fake"),
    )
    manager.run_pending_once()

    completed = runtime.store.get_task(task.task_id)
    document = runtime.store.load_subtitle_document(project_id)
    line = document.lines[0]

    assert completed.status == "completed"
    assert line.translated_text == "[zh] Hello world"
    assert line.translation_status == "translated"
    assert line.translation_origin.provider == "fake"


def test_missing_only_preserves_edited_translation(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project_with_document(runtime, tmp_path)
    document = runtime.store.load_subtitle_document(project_id)
    runtime.store.save_subtitle_document(
        project_id,
        document.model_copy(
            update={
                "lines": [
                    document.lines[0].model_copy(
                        update={
                            "translated_text": "Manual translation",
                            "translation_status": "edited",
                        }
                    )
                ]
            }
        ),
    )
    manager = TranslationJobManager(runtime, auto_start=False)

    task = manager.create_translation_job(
        project_id,
        source_language="en",
        target_language="zh",
        mode="missing_only",
        provider_config=TranslationProviderConfig(provider="fake"),
    )
    manager.run_pending_once()

    line = runtime.store.load_subtitle_document(project_id).lines[0]
    assert runtime.store.get_task(task.task_id).status == "completed"
    assert line.translated_text == "Manual translation"
    assert line.translation_status == "edited"


def test_overwrite_all_replaces_existing_translation(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project_with_document(runtime, tmp_path)
    document = runtime.store.load_subtitle_document(project_id)
    runtime.store.save_subtitle_document(
        project_id,
        document.model_copy(
            update={
                "lines": [
                    document.lines[0].model_copy(
                        update={"translated_text": "Old", "translation_status": "edited"}
                    )
                ]
            }
        ),
    )
    manager = TranslationJobManager(runtime, auto_start=False)

    task = manager.create_translation_job(
        project_id,
        source_language="en",
        target_language="zh",
        mode="overwrite_all",
        provider_config=TranslationProviderConfig(provider="fake"),
    )
    manager.run_pending_once()

    line = runtime.store.load_subtitle_document(project_id).lines[0]
    assert runtime.store.get_task(task.task_id).status == "completed"
    assert line.translated_text == "[zh] Hello world"
    assert line.translation_status == "translated"


def test_retry_failed_translation_job_uses_replacement_config(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project_with_document(runtime, tmp_path)
    manager = TranslationJobManager(runtime, auto_start=False)
    task = runtime.store.create_task(
        project_id=project_id,
        task_type="translation",
        message="Failed",
        request_payload={
            "sourceLanguage": "en",
            "targetLanguage": "zh",
            "mode": "missing_only",
            "provider": "libretranslate",
        },
    )
    runtime.store.update_task(task.task_id, status="failed", completed=True)

    retry = manager.retry_task(
        task.task_id,
        provider_config=TranslationProviderConfig(provider="fake"),
    )

    assert retry.task_id != task.task_id
    assert retry.request_payload["provider"] == "fake"
```

Run:

```powershell
python -m pytest worker/tests/tasks/test_translation_jobs.py -q
```

Expected: FAIL because `TranslationJobManager` does not exist.

- [ ] **Step 2: Add runtime provider factory hook**

In `worker/diplomat_worker/api/runtime.py`, add:

```python
from diplomat_worker.translation.config import TranslationProviderConfig, create_translation_provider

TranslationProviderFactory = Callable[[TranslationProviderConfig], TranslationProvider]
```

Extend `WorkerRuntime`:

```python
translation_provider_factory: TranslationProviderFactory = create_translation_provider
```

Keep `transcriber` typed as `Transcriber | None` if tests need a translation-only runtime.

- [ ] **Step 3: Implement translation job manager**

Create `worker/diplomat_worker/tasks/translation.py` using the M3 job manager shape:

```python
import traceback
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Lock
from typing import TYPE_CHECKING

from diplomat_worker.asr.base import AsrCanceled
from diplomat_worker.schemas.subtitle import TranslationOrigin
from diplomat_worker.storage.project_store import TaskRecord
from diplomat_worker.tasks.analysis import ThreadCancelToken
from diplomat_worker.translation.base import TranslationCanceled, TranslationRequest
from diplomat_worker.translation.config import TranslationProviderConfig

if TYPE_CHECKING:
    from diplomat_worker.api.runtime import WorkerRuntime


class TranslationJobManager:
    def __init__(self, runtime: "WorkerRuntime", auto_start: bool = True, max_workers: int = 1) -> None:
        self.runtime = runtime
        self.auto_start = auto_start
        self._executor = ThreadPoolExecutor(max_workers=max_workers) if auto_start else None
        self._pending: list[str] = []
        self._cancel_tokens: dict[str, ThreadCancelToken] = {}
        self._lock = Lock()

    def create_translation_job(
        self,
        project_id: str,
        source_language: str,
        target_language: str,
        mode: str,
        provider_config: TranslationProviderConfig,
    ) -> TaskRecord:
        self.runtime.store.get_project(project_id)
        task = self.runtime.store.create_task(
            project_id=project_id,
            task_type="translation",
            message="Queued translation",
            request_payload={
                "sourceLanguage": source_language,
                "targetLanguage": target_language,
                "mode": mode,
                **provider_config.to_request_payload(),
            },
        )
        token = ThreadCancelToken()
        with self._lock:
            self._cancel_tokens[task.task_id] = token
            if self.auto_start:
                assert self._executor is not None
                self._executor.submit(self._run_task, task.task_id)
            else:
                self._pending.append(task.task_id)
        return task
```

Implement `get_task`, `cancel_task`, `retry_task`, `run_pending_once`, and `_run_task`. `_run_task` must:

- Load the subtitle document.
- Select lines according to mode:
  - `missing_only`: translate lines where `translated_text.strip()` is empty or `translation_status in {"not_requested", "failed"}`.
  - `overwrite_all`: translate every line with non-empty source text.
- Mark selected lines `queued` before provider calls.
- Update task progress after each line.
- On success, set `translated_text`, `translation_status="translated"`, `translation_origin=TranslationOrigin(provider=result.provider, model=result.model)`, `translation_error=None`, and `target_language=target_language`.
- On provider failure, mark the failed line `translation_status="failed"` and `translation_error=str(exc)`, then fail the task.
- Preserve source text.
- Save the subtitle document after success and after line-level failure marking.

- [ ] **Step 4: Verify translation job tests pass**

Run:

```powershell
python -m pytest worker/tests/tasks/test_translation_jobs.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add worker/diplomat_worker/api/runtime.py worker/diplomat_worker/tasks/translation.py worker/tests/tasks/test_translation_jobs.py
git commit -m "feat(worker): add translation jobs"
```

---

## Task 5: Worker Translation API

**Files:**

- Modify: `worker/diplomat_worker/api/schemas.py`
- Modify: `worker/diplomat_worker/api/app.py`
- Modify: `worker/tests/api/test_app.py`

- [ ] **Step 1: Write failing API tests**

Add to `worker/tests/api/test_app.py`:

```python
def test_translation_settings_round_trip(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    project_id = client.post(
        "/projects",
        json={
            "name": "Episode 1",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "en",
            "targetLanguage": "zh",
        },
    ).json()["projectId"]

    default_response = client.get(f"/projects/{project_id}/translation-settings")
    save_response = client.put(
        f"/projects/{project_id}/translation-settings",
        json={
            "provider": "fake",
            "sourceLanguage": "en",
            "targetLanguage": "zh",
            "mode": "overwrite_all",
            "endpoint": None,
            "apiKeyEnv": None,
        },
    )

    assert default_response.status_code == 200
    assert default_response.json()["mode"] == "missing_only"
    assert save_response.status_code == 200
    assert save_response.json()["mode"] == "overwrite_all"


def test_create_translation_job_returns_accepted_task(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    manager = TranslationJobManager(runtime, auto_start=False)
    client = TestClient(app_module.create_app(runtime, translation_jobs=manager))
    project_id = create_project_with_saved_subtitle(client, tmp_path)

    response = client.post(
        f"/projects/{project_id}/translation-jobs",
        json={
            "provider": "fake",
            "sourceLanguage": "en",
            "targetLanguage": "zh",
            "mode": "missing_only",
        },
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["type"] == "translation"
    assert payload["status"] == "queued"
```

Add a small helper `create_project_with_saved_subtitle` in the test file using the existing subtitle PUT endpoint.

Run:

```powershell
python -m pytest worker/tests/api/test_app.py -q
```

Expected: FAIL because API schemas/endpoints do not exist.

- [ ] **Step 2: Add API schemas**

In `worker/diplomat_worker/api/schemas.py`, add:

```python
TranslationMode = Literal["missing_only", "overwrite_all"]
TranslationProviderName = Literal["fake", "libretranslate"]


class TranslationSettingsRequest(CamelModel):
    provider: TranslationProviderName = "fake"
    source_language: str = Field(alias="sourceLanguage", min_length=2, max_length=12)
    target_language: str = Field(alias="targetLanguage", min_length=2, max_length=12)
    mode: TranslationMode = "missing_only"
    endpoint: str | None = None
    api_key_env: str | None = Field(default=None, alias="apiKeyEnv")


class TranslationSettingsResponse(TranslationSettingsRequest):
    project_id: str = Field(alias="projectId", min_length=1)
    updated_at: str = Field(alias="updatedAt")


class TranslationJobRequest(TranslationSettingsRequest):
    pass
```

- [ ] **Step 3: Add API endpoints**

In `worker/diplomat_worker/api/app.py`:

- Accept `translation_jobs: TranslationJobManager | None = None` in `create_app`.
- Store it in app state and lazy-create it like `analysis_jobs`.
- Add response conversion for settings.
- Add:

```python
@app.get("/projects/{project_id}/translation-settings", response_model=TranslationSettingsResponse)
def get_translation_settings(project_id: str) -> TranslationSettingsResponse:
    try:
        settings = get_runtime().store.get_translation_settings(project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc
    return translation_settings_response(settings)

@app.put("/projects/{project_id}/translation-settings", response_model=TranslationSettingsResponse)
def put_translation_settings(
    project_id: str,
    request: TranslationSettingsRequest,
) -> TranslationSettingsResponse:
    try:
        settings = get_runtime().store.save_translation_settings(
            project_id,
            provider=request.provider,
            source_language=request.source_language,
            target_language=request.target_language,
            mode=request.mode,
            endpoint=request.endpoint,
            api_key_env=request.api_key_env,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return translation_settings_response(settings)

@app.post(
    "/projects/{project_id}/translation-jobs",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_translation_job(project_id: str, request: TranslationJobRequest) -> TaskResponse:
    try:
        get_runtime().store.save_translation_settings(
            project_id,
            provider=request.provider,
            source_language=request.source_language,
            target_language=request.target_language,
            mode=request.mode,
            endpoint=request.endpoint,
            api_key_env=request.api_key_env,
        )
        task = get_translation_jobs().create_translation_job(
            project_id,
            source_language=request.source_language,
            target_language=request.target_language,
            mode=request.mode,
            provider_config=TranslationProviderConfig(
                provider=request.provider,
                endpoint=request.endpoint,
                api_key_env=request.api_key_env,
            ),
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return task_response(task)
```

Use `TranslationProviderConfig(provider=request.provider, endpoint=request.endpoint, api_key_env=request.api_key_env)`.

- [ ] **Step 4: Wire cancel/retry**

Update existing `/tasks/{task_id}/cancel` and `/tasks/{task_id}/retry` to route by task type:

```python
task = get_runtime().store.get_task(task_id)
if task.type == "translation":
    return task_response(get_translation_jobs().cancel_task(task_id))
return task_response(get_analysis_jobs().cancel_task(task_id))
```

For retry, translation tasks should parse the optional body as `TranslationJobRequest`; analysis tasks keep the M3 behavior.

- [ ] **Step 5: Verify API tests and commit**

Run:

```powershell
python -m pytest worker/tests/api/test_app.py worker/tests/tasks/test_translation_jobs.py -q
```

Expected: PASS.

Commit:

```powershell
git add worker/diplomat_worker/api/schemas.py worker/diplomat_worker/api/app.py worker/tests/api/test_app.py
git commit -m "feat(worker): expose translation job api"
```

---

## Task 6: Shared And Web API Contracts

**Files:**

- Modify: `packages/shared/src/task.ts`
- Modify: `packages/shared/tests/task.test.ts`
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/tests/api.test.ts`

- [ ] **Step 1: Write failing shared schema tests**

Add to `packages/shared/tests/task.test.ts`:

```ts
import { TranslationJobRequestSchema, TranslationSettingsResponseSchema } from "../src/task";

it("parses translation job requests with defaults", () => {
  expect(
    TranslationJobRequestSchema.parse({
      sourceLanguage: "en",
      targetLanguage: "zh"
    })
  ).toEqual({
    provider: "fake",
    sourceLanguage: "en",
    targetLanguage: "zh",
    mode: "missing_only",
    endpoint: null,
    apiKeyEnv: null
  });
});

it("parses translation settings responses", () => {
  expect(
    TranslationSettingsResponseSchema.parse({
      projectId: "project-1",
      provider: "fake",
      sourceLanguage: "en",
      targetLanguage: "zh",
      mode: "overwrite_all",
      endpoint: null,
      apiKeyEnv: null,
      updatedAt: "2026-06-07T00:00:00+00:00"
    }).projectId
  ).toBe("project-1");
});
```

Run:

```powershell
corepack pnpm --filter @diplomat/shared test -- task.test.ts
```

Expected: FAIL because schemas do not exist.

- [ ] **Step 2: Implement shared translation schemas**

In `packages/shared/src/task.ts`, add:

```ts
export const TranslationModeSchema = z.enum(["missing_only", "overwrite_all"]);
export const TranslationProviderSchema = z.enum(["fake", "libretranslate"]);

export const TranslationJobRequestSchema = z.object({
  provider: TranslationProviderSchema.default("fake"),
  sourceLanguage: z.string().min(2).max(12),
  targetLanguage: z.string().min(2).max(12),
  mode: TranslationModeSchema.default("missing_only"),
  endpoint: z.string().nullable().default(null),
  apiKeyEnv: z.string().nullable().default(null)
});

export const TranslationSettingsResponseSchema =
  TranslationJobRequestSchema.extend({
    projectId: z.string().min(1),
    updatedAt: z.string().min(1)
  });
```

Export types.

- [ ] **Step 3: Write failing Web API helper tests**

Add to `apps/web/tests/api.test.ts`:

```ts
import {
  createTranslationJob,
  fetchTranslationSettings,
  saveTranslationSettings
} from "../src/api";

it("fetchTranslationSettings gets settings", async () => {
  const response = {
    projectId: "project-1",
    provider: "fake",
    sourceLanguage: "en",
    targetLanguage: "zh",
    mode: "missing_only",
    endpoint: null,
    apiKeyEnv: null,
    updatedAt: "2026-06-07T00:00:00+00:00"
  };
  const fetchMock = stubJsonResponse(response);

  await expect(fetchTranslationSettings("project-1", baseUrl)).resolves.toEqual(response);
  expect(fetchMock).toHaveBeenCalledWith(
    `${baseUrl}/projects/project-1/translation-settings`,
    undefined
  );
});

it("createTranslationJob posts request body", async () => {
  const response = { ...taskResponse, type: "translation", status: "queued" };
  const fetchMock = stubJsonResponse(response);

  await expect(
    createTranslationJob(
      "project-1",
      { sourceLanguage: "en", targetLanguage: "zh" },
      baseUrl
    )
  ).resolves.toEqual(response);

  expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/translation-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "fake",
      sourceLanguage: "en",
      targetLanguage: "zh",
      mode: "missing_only",
      endpoint: null,
      apiKeyEnv: null
    })
  });
});
```

Run:

```powershell
corepack pnpm --filter @diplomat/web test -- api.test.ts
```

Expected: FAIL because helpers do not exist.

- [ ] **Step 4: Implement Web API helpers**

In `apps/web/src/api.ts`, import schemas/types and add:

```ts
export async function fetchTranslationSettings(
  projectId: string,
  baseUrl = DEFAULT_WORKER_BASE_URL
): Promise<TranslationSettingsResponse> {
  return requestJson(
    `${baseUrl}/projects/${projectId}/translation-settings`,
    undefined,
    (payload) => TranslationSettingsResponseSchema.parse(payload)
  );
}

export async function saveTranslationSettings(
  projectId: string,
  input: TranslationJobRequestInput,
  baseUrl = DEFAULT_WORKER_BASE_URL
): Promise<TranslationSettingsResponse> {
  const request = TranslationJobRequestSchema.parse(input);
  return requestJson(
    `${baseUrl}/projects/${projectId}/translation-settings`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    },
    (payload) => TranslationSettingsResponseSchema.parse(payload)
  );
}

export async function createTranslationJob(
  projectId: string,
  input: TranslationJobRequestInput,
  baseUrl = DEFAULT_WORKER_BASE_URL
): Promise<TaskResponse> {
  const request = TranslationJobRequestSchema.parse(input);
  return requestJson(
    `${baseUrl}/projects/${projectId}/translation-jobs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    },
    (payload) => TaskResponseSchema.parse(payload)
  );
}
```

Do not overload `retryTask` for translation in this task; wire App-level retry in Task 7 with the generic endpoint.

- [ ] **Step 5: Verify shared/web API tests and commit**

Run:

```powershell
corepack pnpm --filter @diplomat/shared test -- task.test.ts
corepack pnpm --filter @diplomat/shared typecheck
corepack pnpm --filter @diplomat/web test -- api.test.ts
corepack pnpm --filter @diplomat/web typecheck
```

Expected: PASS.

Commit:

```powershell
git add packages/shared/src/task.ts packages/shared/tests/task.test.ts apps/web/src/api.ts apps/web/tests/api.test.ts
git commit -m "feat(web): add translation job client contracts"
```

---

## Task 7: Web Translation Workflow

**Files:**

- Create: `apps/web/src/components/TranslationJobPanel.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/components/SubtitleEditor.tsx`
- Modify: `apps/web/src/components/SubtitleLineList.tsx`
- Modify: `apps/web/tests/App.test.tsx`

- [ ] **Step 1: Write failing React workflow tests**

Add to `apps/web/tests/App.test.tsx`:

```tsx
it("starts translation and displays generated target text", async () => {
  stubWorkbenchFetch({ includeRecentProject: true, includeSubtitleFetch: true, translationJob: "completed" });
  render(<App />);

  expect(await screen.findByText("Recent Projects")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reopen Demo" }));
  expect(await screen.findByText(/Project: Demo/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Start Translation" }));

  expect(await screen.findByDisplayValue("[en] 原始字幕文本")).toBeInTheDocument();
  expect(screen.getByText("Translation completed")).toBeInTheDocument();
});

it("marks translated text edited when the user changes it", async () => {
  stubWorkbenchFetch({ includeRecentProject: true, includeTranslatedSubtitleFetch: true });
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "Reopen Demo" }));
  const translatedText = await screen.findByLabelText("Translated text");

  fireEvent.change(translatedText, { target: { value: "Manual subtitle translation" } });

  expect(screen.getByText("Translation: edited")).toBeInTheDocument();
});

it("filters missing translations", async () => {
  stubWorkbenchFetch({ includeRecentProject: true, includeSubtitleFetch: true });
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "Reopen Demo" }));
  fireEvent.click(screen.getByRole("button", { name: "Missing translations" }));

  expect(screen.getByText("原始字幕文本")).toBeInTheDocument();
});
```

Extend `stubWorkbenchFetch` with translation settings/job/task/subtitle responses.

Run:

```powershell
corepack pnpm --filter @diplomat/web test -- App.test.tsx
```

Expected: FAIL because the UI does not exist.

- [ ] **Step 2: Create TranslationJobPanel**

Create `apps/web/src/components/TranslationJobPanel.tsx`:

```tsx
import type { TaskResponse, TranslationJobRequest } from "@diplomat/shared";

type TranslationJobPanelProps = {
  disabled: boolean;
  task: TaskResponse | null;
  config: TranslationJobRequest;
  onConfigChange: (config: TranslationJobRequest) => void;
  onStart: () => void;
  onCancel: () => void;
  onRetry: () => void;
};

function isTaskActive(task: TaskResponse | null) {
  return task?.status === "queued" || task?.status === "running" || task?.status === "canceling";
}

export function TranslationJobPanel({
  disabled,
  task,
  config,
  onConfigChange,
  onStart,
  onCancel,
  onRetry
}: TranslationJobPanelProps) {
  const active = isTaskActive(task);
  const canRetry = task?.status === "failed" || task?.status === "canceled";
  const progressPercent = Math.round((task?.progress ?? 0) * 100);

  return (
    <section className="translation-job-panel" aria-label="Translation job">
      <div className="panel-heading">
        <h2>Translation</h2>
        <span>{task ? `${task.status} ${progressPercent}%` : "idle"}</span>
      </div>
      <div className="translation-controls">
        <label>
          Translation provider
          <select
            value={config.provider}
            disabled={active}
            onChange={(event) =>
              onConfigChange({ ...config, provider: event.target.value as TranslationJobRequest["provider"] })
            }
          >
            <option value="fake">fake</option>
            <option value="libretranslate">libretranslate</option>
          </select>
        </label>
        <label>
          Source language
          <input
            value={config.sourceLanguage}
            disabled={active}
            onChange={(event) => onConfigChange({ ...config, sourceLanguage: event.target.value })}
          />
        </label>
        <label>
          Target language
          <input
            value={config.targetLanguage}
            disabled={active}
            onChange={(event) => onConfigChange({ ...config, targetLanguage: event.target.value })}
          />
        </label>
        <label>
          Translation mode
          <select
            value={config.mode}
            disabled={active}
            onChange={(event) =>
              onConfigChange({ ...config, mode: event.target.value as TranslationJobRequest["mode"] })
            }
          >
            <option value="missing_only">missing only</option>
            <option value="overwrite_all">overwrite all</option>
          </select>
        </label>
      </div>
      <div className="analysis-task-row">
        <progress value={task?.progress ?? 0} max={1} aria-label="Translation progress" />
        <span>{task?.message ?? "No translation job"}</span>
      </div>
      {task?.errorMessage ? <p className="analysis-error">{task.errorMessage}</p> : null}
      <div className="analysis-actions">
        <button type="button" onClick={onStart} disabled={disabled || active}>
          Start Translation
        </button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={!active}>
          Cancel Translation
        </button>
        <button type="button" className="secondary-button" onClick={onRetry} disabled={!canRetry}>
          Retry Translation
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Wire App state and polling**

In `apps/web/src/App.tsx`:

- Add translation config/task state.
- Add `isTranslationActive`.
- Add `finishTranslationTask` that reloads subtitle document on completion.
- Add `monitorTranslationTask` mirroring M3 analysis polling.
- On project create/reopen, set translation source/target from project languages.
- Use `createTranslationJob`, `fetchTask`, `cancelTask`, and `retryTask`.
- Disable editing/export while translation is active.

- [ ] **Step 4: Update editor and line list**

In `SubtitleEditor`, when translated text changes:

```tsx
onChangeLine({
  ...line,
  translatedText: event.target.value,
  translationStatus: "edited",
  translationError: null
})
```

Render a compact status line:

```tsx
<span>Translation: {line.translationStatus}</span>
```

In `SubtitleLineList`, show source snippet, target snippet, and status. Add props:

```ts
filter: "all" | "missing";
onFilterChange: (filter: "all" | "missing") => void;
```

Render buttons `All lines` and `Missing translations`. Missing means no `translatedText.trim()` or `translationStatus === "failed"`.

- [ ] **Step 5: Add CSS**

In `apps/web/src/App.css`, style `.translation-job-panel`, `.translation-controls`, status chips, and line target snippets using the same compact panel language as M3. Do not create nested cards.

- [ ] **Step 6: Verify Web tests and commit**

Run:

```powershell
corepack pnpm --filter @diplomat/web test -- App.test.tsx
corepack pnpm --filter @diplomat/web typecheck
```

Expected: PASS.

Commit:

```powershell
git add apps/web/src/components/TranslationJobPanel.tsx apps/web/src/App.tsx apps/web/src/App.css apps/web/src/components/SubtitleEditor.tsx apps/web/src/components/SubtitleLineList.tsx apps/web/tests/App.test.tsx
git commit -m "feat(web): add translation workflow"
```

---

## Task 8: Export Coverage, Docs, And Stage Gate

**Files:**

- Modify: `worker/tests/export/test_srt.py`
- Modify: `apps/web/tests/App.test.tsx`
- Create: `docs/development/m4-translation-bilingual.md`
- Create: `docs/development/m4-stage-gate-review.md`
- Modify: `README.md`

- [ ] **Step 1: Add export tests**

In `worker/tests/export/test_srt.py`, add:

```python
from diplomat_worker.export.srt import subtitle_document_to_srt
from diplomat_worker.schemas.subtitle import AiOrigin, SubtitleDocument, SubtitleLine, TranslationOrigin


def make_translated_document(translated_text: str) -> SubtitleDocument:
    return SubtitleDocument(
        project_id="project-1",
        media_id="media-1",
        duration_ms=2000,
        speakers=[],
        styles=[],
        lines=[
            SubtitleLine(
                id="line-1",
                start_ms=0,
                end_ms=1000,
                speaker_id=None,
                source_language="en",
                target_language="zh",
                source_text="Hello from source",
                translated_text=translated_text,
                words=[],
                style_overrides={},
                review_status="draft",
                ai_origin=AiOrigin(engine="fake-asr", model="fake-v1"),
                notes="",
                translation_status="translated" if translated_text else "not_requested",
                translation_origin=TranslationOrigin(provider="fake", model="fake-v1")
                if translated_text
                else None,
                translation_error=None,
            )
        ],
    )


def test_target_srt_uses_translated_text_after_translation() -> None:
    srt = subtitle_document_to_srt(make_translated_document("Hello from translation"), "target")

    assert "Hello from translation" in srt
    assert "Hello from source" not in srt


def test_bilingual_srt_writes_source_and_target_after_translation() -> None:
    srt = subtitle_document_to_srt(make_translated_document("Hello from translation"), "bilingual")

    assert "Hello from source\nHello from translation" in srt


def test_target_srt_falls_back_to_source_when_target_is_empty() -> None:
    srt = subtitle_document_to_srt(make_translated_document(""), "target")

    assert "Hello from source" in srt
```

Run:

```powershell
python -m pytest worker/tests/export/test_srt.py -q
```

Expected: PASS if existing export behavior already satisfies M4; otherwise patch `worker/diplomat_worker/export/srt.py` minimally.

- [ ] **Step 2: Add Web export flow test**

In `apps/web/tests/App.test.tsx`, add a workflow test:

```tsx
it("exports bilingual SRT after translation edit is saved", async () => {
  const { exportModes, savedDocuments } = stubWorkbenchFetch({
    includeRecentProject: true,
    includeTranslatedSubtitleFetch: true
  });
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "Reopen Demo" }));
  fireEvent.change(await screen.findByLabelText("Translated text"), {
    target: { value: "Manual subtitle translation" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Subtitle" }));
  await screen.findByText("Saved subtitle edits");
  fireEvent.click(screen.getByRole("button", { name: "Export SRT" }));

  expect(exportModes).toContain("bilingual");
  expect(savedDocuments.at(-1)?.lines[0].translatedText).toBe("Manual subtitle translation");
});
```

Run:

```powershell
corepack pnpm --filter @diplomat/web test -- App.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Write M4 development docs**

Create `docs/development/m4-translation-bilingual.md` with:

- Included and not included.
- Translation providers and privacy behavior.
- Fake provider workflow.
- LibreTranslate provider setup:
  - endpoint setting,
  - optional API key env var,
  - no keys committed.
- Browser and desktop workflow.
- API examples for settings and jobs.
- Manual M4 test.
- Known limitations.

- [ ] **Step 4: Write stage gate review**

Create `docs/development/m4-stage-gate-review.md` initially with:

- Gate decision.
- Automated verification evidence.
- Fake translation manual evidence.
- Optional LibreTranslate manual evidence if available.
- Export verification evidence.
- Remaining limitations.

Do not mark the gate accepted until manual M4 workflow passes.

- [ ] **Step 5: Run full verification**

Run:

```powershell
.\scripts\check.ps1
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

Expected: PASS.

- [ ] **Step 6: Manual M4 browser test**

Start Worker/Web from this M4 worktree. Use the current `.dev` FFmpeg setup if needed for ASR, or reopen a project with an existing subtitle document.

Manual steps:

1. Create or reopen a project with source subtitles.
2. Start fake translation.
3. Confirm progress and completion.
4. Confirm translated text appears line by line.
5. Edit one translated line.
6. Save subtitles.
7. Reopen the project.
8. Confirm the edited translated text persisted.
9. Export bilingual SRT.
10. Confirm exported file contains source and target lines.
11. Trigger a failed LibreTranslate config, then retry with fake provider and confirm recovery.

- [ ] **Step 7: Accept stage gate and commit docs**

Only after verification and manual workflow pass, update `docs/development/m4-stage-gate-review.md` to accepted.

Commit:

```powershell
git add worker/tests/export/test_srt.py apps/web/tests/App.test.tsx docs/development/m4-translation-bilingual.md docs/development/m4-stage-gate-review.md README.md
git commit -m "docs: add m4 translation guide and gate"
```

---

## Final M4 Completion

After all tasks are complete:

1. Run:

   ```powershell
   git status --short --branch
   .\scripts\check.ps1
   cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
   ```

2. Run browser verification against `http://localhost:1420`.
3. Confirm `docs/development/m4-stage-gate-review.md` is accepted.
4. Merge `codex/m4-translation-bilingual` into `master` only after the stage gate is accepted.
5. Do not start M5 until M4 is genuinely complete.

## Self-Review

Spec coverage:

- Translation provider interface: Task 2.
- Fake provider: Task 2.
- Configurable real provider path: Task 2 and Task 5 via LibreTranslate.
- Batch translation job: Task 4.
- Per-line translation status: Task 1 and Task 4.
- Editable translated text: Task 7.
- Source/target/bilingual export verification: Task 8.
- UI controls: Task 7.
- Progress/failure/retry: Task 4, Task 5, and Task 7.
- No paid service required in CI: Task 2 tests mock LibreTranslate; fake provider is default.

Placeholder scan:

- No `TBD`, `TODO`, "implement later", or unspecified test placeholders remain.

Type consistency:

- Worker request fields use Pydantic snake_case with camelCase aliases.
- Shared/Web request fields use camelCase.
- Task status and task type reuse M3 `TaskResponse`.
- Translation mode values are consistently `missing_only` and `overwrite_all`.
