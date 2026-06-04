# Diplomat M0/M1 Foundation Core Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the repository foundation and the first local core pipeline that turns a video into a persisted internal subtitle document through FFmpeg preprocessing and a pluggable ASR backend.

**Architecture:** Use a monorepo with a React/Vite workbench shell, a Tauri v2 desktop shell, shared TypeScript schemas, and a Python Worker. The M0/M1 implementation keeps heavy AI behind Python interfaces so tests can use deterministic fake transcribers while production can load faster-whisper when installed.

**Tech Stack:** Tauri v2, React, Vite, TypeScript, Zod, Vitest, Python 3.12, Pydantic v2, FastAPI, pytest, FFmpeg, optional faster-whisper.

---

## Scope

This plan implements only M0 and M1 from the approved design:

- Repository foundation.
- MIT licensing and developer scripts.
- Shared subtitle/task schemas.
- Python Worker package.
- SQLite project store.
- FFmpeg preflight, audio extraction, and chunk planning.
- Pluggable ASR adapters with deterministic tests.
- Core pipeline that writes a Diplomat subtitle document.
- Minimal local Worker API.
- Minimal React and Tauri shells that prove the app boundary exists.

The following confirmed spec features require separate implementation plans after this one:

- Full professional workbench UI.
- Translation backends.
- Speaker diarization.
- Waveform rendering.
- Timeline editing.
- SRT/VTT/ASS export.
- Burned-in video export.
- Model manager UI.
- Windows installer and bundled dependency strategy.

## File Structure

Create or modify these paths:

```text
D:\Software Project\Diplomat\
  LICENSE
  README.md
  package.json
  pnpm-workspace.yaml
  pyproject.toml
  scripts/
    check.ps1
  packages/
    shared/
      package.json
      tsconfig.json
      vitest.config.ts
      src/
        index.ts
        subtitle.ts
        task.ts
      tests/
        subtitle.test.ts
        task.test.ts
  worker/
    pyproject.toml
    diplomat_worker/
      __init__.py
      api/
        __init__.py
        app.py
      asr/
        __init__.py
        base.py
        fake.py
        faster_whisper.py
      media/
        __init__.py
        audio.py
        ffmpeg.py
      pipeline/
        __init__.py
        core.py
      schemas/
        __init__.py
        subtitle.py
        task.py
      storage/
        __init__.py
        project_store.py
    tests/
      api/
        test_app.py
      asr/
        test_fake.py
      media/
        test_audio.py
        test_ffmpeg.py
      pipeline/
        test_core.py
      schemas/
        test_subtitle.py
      storage/
        test_project_store.py
  apps/
    web/
      package.json
      tsconfig.json
      vite.config.ts
      index.html
      src/
        App.tsx
        api.ts
        main.tsx
      tests/
        App.test.tsx
    desktop/
      package.json
      src-tauri/
        Cargo.toml
        build.rs
        tauri.conf.json
        src/
          main.rs
```

Each unit has a clear responsibility:

- `packages/shared`: TypeScript data contract for frontend and desktop code.
- `worker/diplomat_worker/schemas`: Python mirror of the shared data contract.
- `worker/diplomat_worker/media`: FFmpeg and audio chunking helpers.
- `worker/diplomat_worker/asr`: ASR interface and implementations.
- `worker/diplomat_worker/storage`: local SQLite project store.
- `worker/diplomat_worker/pipeline`: orchestration from media to subtitle document.
- `worker/diplomat_worker/api`: minimal local HTTP API for the desktop/frontend boundary.
- `apps/web`: React app shell that can call the Worker API health endpoint.
- `apps/desktop`: Tauri v2 desktop shell that points at the web app.

## Task 1: Root Repository Foundation

**Files:**
- Create: `LICENSE`
- Create: `README.md`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `pyproject.toml`
- Create: `scripts/check.ps1`
- Modify: `.gitignore`

- [ ] **Step 1: Write repository metadata files**

Create `LICENSE`:

```text
MIT License

Copyright (c) 2026 Drew1811266

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Create `README.md`:

```markdown
# Diplomat

Diplomat is a Windows-first local AI subtitle editor. It imports video files, runs local speech analysis, creates editable subtitle drafts, and prepares the project for subtitle export workflows.

This repository contains the MIT-licensed application source code. AI model weights are not part of this repository and keep their upstream licenses.

## M0/M1 Development Targets

- Monorepo foundation.
- Shared subtitle and task schemas.
- Python Worker core pipeline.
- FFmpeg preflight and audio extraction helpers.
- Pluggable ASR interface with deterministic fake tests.
- Minimal Worker API.
- Minimal React and Tauri shells.

## Requirements

- Windows 11 or a current Windows development environment.
- Node.js 24 or newer.
- pnpm via Corepack.
- Python 3.12.
- Rust stable toolchain for Tauri.
- FFmpeg available on PATH for media integration tests.

## Setup

```powershell
corepack enable
pnpm install
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e .\worker[dev]
```

## Verify

```powershell
.\scripts\check.ps1
```
```

Create `package.json`:

```json
{
  "name": "diplomat",
  "version": "0.1.0",
  "private": true,
  "license": "MIT",
  "packageManager": "pnpm@10.13.1",
  "scripts": {
    "check": "pnpm -r check",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {}
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Create root `pyproject.toml`:

```toml
[tool.pytest.ini_options]
pythonpath = ["worker"]
testpaths = ["worker/tests"]
addopts = "-q"
```

Create `scripts/check.ps1`:

```powershell
$ErrorActionPreference = "Stop"

Write-Host "Running TypeScript checks"
pnpm -r test
pnpm -r typecheck

Write-Host "Running Python tests"
python -m pytest
```

Append these lines to `.gitignore` if they are missing:

```text
.pytest_cache/
.ruff_cache/
coverage/
htmlcov/
.mypy_cache/
.pnpm-store/
```

- [ ] **Step 2: Verify the metadata files exist**

Run:

```powershell
Test-Path LICENSE
Test-Path README.md
Test-Path package.json
Test-Path pnpm-workspace.yaml
Test-Path pyproject.toml
Test-Path scripts/check.ps1
```

Expected: each command prints `True`.

- [ ] **Step 3: Commit**

```powershell
git add LICENSE README.md package.json pnpm-workspace.yaml pyproject.toml scripts/check.ps1 .gitignore
git commit -m "chore: add repository foundation"
```

## Task 2: Shared TypeScript Subtitle And Task Schemas

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/subtitle.ts`
- Create: `packages/shared/src/task.ts`
- Create: `packages/shared/tests/subtitle.test.ts`
- Create: `packages/shared/tests/task.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `packages/shared/tests/subtitle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SubtitleDocumentSchema } from "../src/subtitle";

const validDocument = {
  schemaVersion: "diplomat.subtitle.v1",
  projectId: "project-1",
  mediaId: "media-1",
  durationMs: 10_000,
  speakers: [
    {
      id: "speaker-1",
      displayName: "Speaker 1",
      color: "#0D9488",
      styleId: "default",
      mergedInto: null
    }
  ],
  styles: [
    {
      id: "default",
      name: "Default",
      fontFamily: "Arial",
      fontSize: 36,
      primaryColor: "#FFFFFF",
      secondaryColor: "#14B8A6",
      strokeWidth: 3,
      shadow: 1,
      position: "bottom-center",
      marginV: 48,
      alignment: "center",
      bilingualLayout: "source-above-target",
      lineSpacing: 1.15
    }
  ],
  lines: [
    {
      id: "line-1",
      startMs: 1000,
      endMs: 2500,
      speakerId: "speaker-1",
      sourceLanguage: "zh",
      targetLanguage: "en",
      sourceText: "你好",
      translatedText: "Hello",
      words: [{ text: "你好", startMs: 1000, endMs: 2500, confidence: 0.94 }],
      styleOverrides: {},
      reviewStatus: "draft",
      aiOrigin: { engine: "fake-asr", model: "fake-v1" },
      notes: ""
    }
  ]
};

describe("SubtitleDocumentSchema", () => {
  it("accepts a valid Diplomat subtitle document", () => {
    const parsed = SubtitleDocumentSchema.parse(validDocument);
    expect(parsed.lines[0].sourceText).toBe("你好");
  });

  it("rejects a subtitle line whose end time is before the start time", () => {
    const invalid = structuredClone(validDocument);
    invalid.lines[0].endMs = 900;
    expect(() => SubtitleDocumentSchema.parse(invalid)).toThrow();
  });
});
```

Create `packages/shared/tests/task.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TaskEventSchema } from "../src/task";

describe("TaskEventSchema", () => {
  it("accepts a running task progress event", () => {
    const event = TaskEventSchema.parse({
      taskId: "task-1",
      type: "transcribe_chunks",
      status: "running",
      progress: 0.5,
      message: "Transcribing chunk 3 of 6",
      errorCode: null,
      diagnosticLogPath: null
    });

    expect(event.status).toBe("running");
    expect(event.progress).toBe(0.5);
  });

  it("rejects progress outside 0..1", () => {
    expect(() =>
      TaskEventSchema.parse({
        taskId: "task-1",
        type: "transcribe_chunks",
        status: "running",
        progress: 1.5,
        message: "bad progress",
        errorCode: null,
        diagnosticLogPath: null
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Add shared package implementation**

Create `packages/shared/package.json`:

```json
{
  "name": "@diplomat/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "check": "pnpm test && pnpm typecheck",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.2.0"
  }
}
```

Create `packages/shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests", "vitest.config.ts"]
}
```

Create `packages/shared/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node"
  }
});
```

Create `packages/shared/src/subtitle.ts`:

```ts
import { z } from "zod";

export const LanguageCodeSchema = z.string().min(2).max(12);

export const ReviewStatusSchema = z.enum(["draft", "reviewed", "approved"]);

export const WordTimingSchema = z
  .object({
    text: z.string(),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
    confidence: z.number().min(0).max(1).nullable()
  })
  .refine((word) => word.endMs >= word.startMs, {
    message: "word endMs must be greater than or equal to startMs"
  });

export const StyleOverridesSchema = z.object({
  fontSize: z.number().positive().optional(),
  position: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  strokeWidth: z.number().nonnegative().optional()
});

export const AiOriginSchema = z.object({
  engine: z.string(),
  model: z.string()
});

export const SpeakerSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  color: z.string().min(1),
  styleId: z.string().min(1),
  mergedInto: z.string().nullable()
});

export const SubtitleStyleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  fontFamily: z.string().min(1),
  fontSize: z.number().positive(),
  primaryColor: z.string().min(1),
  secondaryColor: z.string().min(1),
  strokeWidth: z.number().nonnegative(),
  shadow: z.number().nonnegative(),
  position: z.string().min(1),
  marginV: z.number().int().nonnegative(),
  alignment: z.string().min(1),
  bilingualLayout: z.string().min(1),
  lineSpacing: z.number().positive()
});

export const SubtitleLineSchema = z
  .object({
    id: z.string().min(1),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
    speakerId: z.string().nullable(),
    sourceLanguage: LanguageCodeSchema,
    targetLanguage: LanguageCodeSchema.nullable(),
    sourceText: z.string(),
    translatedText: z.string(),
    words: z.array(WordTimingSchema),
    styleOverrides: StyleOverridesSchema,
    reviewStatus: ReviewStatusSchema,
    aiOrigin: AiOriginSchema,
    notes: z.string()
  })
  .refine((line) => line.endMs > line.startMs, {
    message: "line endMs must be greater than startMs"
  });

export const SubtitleDocumentSchema = z.object({
  schemaVersion: z.literal("diplomat.subtitle.v1"),
  projectId: z.string().min(1),
  mediaId: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  speakers: z.array(SpeakerSchema),
  styles: z.array(SubtitleStyleSchema),
  lines: z.array(SubtitleLineSchema)
});

export type SubtitleDocument = z.infer<typeof SubtitleDocumentSchema>;
export type SubtitleLine = z.infer<typeof SubtitleLineSchema>;
export type SubtitleStyle = z.infer<typeof SubtitleStyleSchema>;
export type Speaker = z.infer<typeof SpeakerSchema>;
```

Create `packages/shared/src/task.ts`:

```ts
import { z } from "zod";

export const TaskStatusSchema = z.enum([
  "queued",
  "running",
  "paused",
  "failed",
  "completed",
  "canceled"
]);

export const TaskTypeSchema = z.enum([
  "preflight",
  "extract_audio",
  "chunk_audio",
  "transcribe_chunks",
  "diarize",
  "translate",
  "build_subtitle_draft",
  "export"
]);

export const TaskEventSchema = z.object({
  taskId: z.string().min(1),
  type: TaskTypeSchema,
  status: TaskStatusSchema,
  progress: z.number().min(0).max(1),
  message: z.string(),
  errorCode: z.string().nullable(),
  diagnosticLogPath: z.string().nullable()
});

export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type TaskType = z.infer<typeof TaskTypeSchema>;
export type TaskEvent = z.infer<typeof TaskEventSchema>;
```

Create `packages/shared/src/index.ts`:

```ts
export * from "./subtitle";
export * from "./task";
```

- [ ] **Step 3: Run shared package tests**

Run:

```powershell
corepack enable
pnpm install
pnpm --filter @diplomat/shared test
pnpm --filter @diplomat/shared typecheck
```

Expected: both shared tests pass and TypeScript reports no errors.

- [ ] **Step 4: Commit**

```powershell
git add packages/shared package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat: add shared subtitle and task schemas"
```

## Task 3: Python Worker Schema Models

**Files:**
- Create: `worker/pyproject.toml`
- Create: `worker/diplomat_worker/__init__.py`
- Create: `worker/diplomat_worker/schemas/__init__.py`
- Create: `worker/diplomat_worker/schemas/subtitle.py`
- Create: `worker/diplomat_worker/schemas/task.py`
- Create: `worker/tests/schemas/test_subtitle.py`

- [ ] **Step 1: Write failing Python schema tests**

Create `worker/tests/schemas/test_subtitle.py`:

```python
import pytest
from pydantic import ValidationError

from diplomat_worker.schemas.subtitle import (
    AiOrigin,
    Speaker,
    SubtitleDocument,
    SubtitleLine,
    SubtitleStyle,
    WordTiming,
)


def make_document() -> SubtitleDocument:
    return SubtitleDocument(
        project_id="project-1",
        media_id="media-1",
        duration_ms=10_000,
        speakers=[
            Speaker(
                id="speaker-1",
                display_name="Speaker 1",
                color="#0D9488",
                style_id="default",
                merged_into=None,
            )
        ],
        styles=[
            SubtitleStyle(
                id="default",
                name="Default",
                font_family="Arial",
                font_size=36,
                primary_color="#FFFFFF",
                secondary_color="#14B8A6",
                stroke_width=3,
                shadow=1,
                position="bottom-center",
                margin_v=48,
                alignment="center",
                bilingual_layout="source-above-target",
                line_spacing=1.15,
            )
        ],
        lines=[
            SubtitleLine(
                id="line-1",
                start_ms=1000,
                end_ms=2500,
                speaker_id="speaker-1",
                source_language="zh",
                target_language="en",
                source_text="你好",
                translated_text="Hello",
                words=[WordTiming(text="你好", start_ms=1000, end_ms=2500, confidence=0.94)],
                style_overrides={},
                review_status="draft",
                ai_origin=AiOrigin(engine="fake-asr", model="fake-v1"),
                notes="",
            )
        ],
    )


def test_subtitle_document_serializes_with_camel_case_aliases() -> None:
    payload = make_document().model_dump(by_alias=True)

    assert payload["schemaVersion"] == "diplomat.subtitle.v1"
    assert payload["projectId"] == "project-1"
    assert payload["lines"][0]["startMs"] == 1000


def test_subtitle_line_rejects_invalid_timing() -> None:
    with pytest.raises(ValidationError):
        SubtitleLine(
            id="line-1",
            start_ms=3000,
            end_ms=2500,
            speaker_id=None,
            source_language="zh",
            target_language="en",
            source_text="bad",
            translated_text="bad",
            words=[],
            style_overrides={},
            review_status="draft",
            ai_origin=AiOrigin(engine="fake-asr", model="fake-v1"),
            notes="",
        )
```

- [ ] **Step 2: Add worker package and schemas**

Create `worker/pyproject.toml`:

```toml
[project]
name = "diplomat-worker"
version = "0.1.0"
description = "Local AI and media worker for Diplomat"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115.0",
  "pydantic>=2.10.0",
  "uvicorn>=0.34.0"
]

[project.optional-dependencies]
asr = [
  "faster-whisper>=1.1.0"
]
dev = [
  "httpx>=0.28.0",
  "pytest>=8.3.0"
]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
addopts = "-q"
```

Create `worker/diplomat_worker/__init__.py`:

```python
__all__ = ["__version__"]

__version__ = "0.1.0"
```

Create `worker/diplomat_worker/schemas/__init__.py`:

```python
from diplomat_worker.schemas.subtitle import (
    AiOrigin,
    Speaker,
    SubtitleDocument,
    SubtitleLine,
    SubtitleStyle,
    WordTiming,
)
from diplomat_worker.schemas.task import TaskEvent, TaskStatus, TaskType

__all__ = [
    "AiOrigin",
    "Speaker",
    "SubtitleDocument",
    "SubtitleLine",
    "SubtitleStyle",
    "TaskEvent",
    "TaskStatus",
    "TaskType",
    "WordTiming",
]
```

Create `worker/diplomat_worker/schemas/subtitle.py`:

```python
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
```

Create `worker/diplomat_worker/schemas/task.py`:

```python
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TaskStatus = Literal["queued", "running", "paused", "failed", "completed", "canceled"]
TaskType = Literal[
    "preflight",
    "extract_audio",
    "chunk_audio",
    "transcribe_chunks",
    "diarize",
    "translate",
    "build_subtitle_draft",
    "export",
]


class TaskEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    task_id: str = Field(alias="taskId")
    type: TaskType
    status: TaskStatus
    progress: float = Field(ge=0, le=1)
    message: str
    error_code: str | None = Field(default=None, alias="errorCode")
    diagnostic_log_path: str | None = Field(default=None, alias="diagnosticLogPath")
```

- [ ] **Step 3: Run Python schema tests**

Run:

```powershell
python -m pip install -e .\worker[dev]
python -m pytest worker/tests/schemas/test_subtitle.py -q
```

Expected: schema tests pass.

- [ ] **Step 4: Commit**

```powershell
git add worker/pyproject.toml worker/diplomat_worker worker/tests/schemas
git commit -m "feat: add worker subtitle schemas"
```

## Task 4: SQLite Project Store

**Files:**
- Create: `worker/diplomat_worker/storage/__init__.py`
- Create: `worker/diplomat_worker/storage/project_store.py`
- Create: `worker/tests/storage/test_project_store.py`

- [ ] **Step 1: Write failing storage tests**

Create `worker/tests/storage/test_project_store.py`:

```python
from pathlib import Path

from diplomat_worker.schemas.subtitle import AiOrigin, SubtitleDocument, SubtitleLine
from diplomat_worker.storage.project_store import ProjectStore


def test_project_store_creates_project_and_saves_subtitle_document(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project(name="Demo", source_video_path=tmp_path / "demo.mp4")

    document = SubtitleDocument(
        project_id=project.project_id,
        media_id="media-1",
        duration_ms=2500,
        lines=[
            SubtitleLine(
                id="line-1",
                start_ms=0,
                end_ms=2500,
                speaker_id=None,
                source_language="zh",
                target_language="en",
                source_text="你好",
                translated_text="Hello",
                words=[],
                style_overrides={},
                review_status="draft",
                ai_origin=AiOrigin(engine="fake-asr", model="fake-v1"),
                notes="",
            )
        ],
    )

    document_path = store.save_subtitle_document(project.project_id, document)
    loaded = store.load_subtitle_document(project.project_id)

    assert document_path.exists()
    assert loaded.project_id == project.project_id
    assert loaded.lines[0].source_text == "你好"
```

- [ ] **Step 2: Add ProjectStore implementation**

Create `worker/diplomat_worker/storage/__init__.py`:

```python
from diplomat_worker.storage.project_store import ProjectRecord, ProjectStore

__all__ = ["ProjectRecord", "ProjectStore"]
```

Create `worker/diplomat_worker/storage/project_store.py`:

```python
import json
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from diplomat_worker.schemas.subtitle import SubtitleDocument


@dataclass(frozen=True)
class ProjectRecord:
    project_id: str
    name: str
    source_video_path: Path
    project_dir: Path


class ProjectStore:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path
        self.root_dir = database_path.parent
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS projects (
                    project_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    source_video_path TEXT NOT NULL,
                    project_dir TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.commit()

    def create_project(self, name: str, source_video_path: Path) -> ProjectRecord:
        project_id = f"project-{uuid.uuid4().hex}"
        project_dir = self.root_dir / "projects" / project_id
        project_dir.mkdir(parents=True, exist_ok=True)

        record = ProjectRecord(
            project_id=project_id,
            name=name,
            source_video_path=source_video_path,
            project_dir=project_dir,
        )
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO projects (project_id, name, source_video_path, project_dir, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    record.project_id,
                    record.name,
                    str(record.source_video_path),
                    str(record.project_dir),
                    datetime.now(UTC).isoformat(),
                ),
            )
            connection.commit()
        return record

    def get_project(self, project_id: str) -> ProjectRecord:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT project_id, name, source_video_path, project_dir FROM projects WHERE project_id = ?",
                (project_id,),
            ).fetchone()
        if row is None:
            raise KeyError(f"Project not found: {project_id}")
        return ProjectRecord(
            project_id=row["project_id"],
            name=row["name"],
            source_video_path=Path(row["source_video_path"]),
            project_dir=Path(row["project_dir"]),
        )

    def save_subtitle_document(self, project_id: str, document: SubtitleDocument) -> Path:
        project = self.get_project(project_id)
        path = project.project_dir / "subtitle.diplomat.json"
        payload = document.model_dump(by_alias=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return path

    def load_subtitle_document(self, project_id: str) -> SubtitleDocument:
        project = self.get_project(project_id)
        path = project.project_dir / "subtitle.diplomat.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        return SubtitleDocument.model_validate(payload)
```

- [ ] **Step 3: Run storage tests**

Run:

```powershell
python -m pytest worker/tests/storage/test_project_store.py -q
```

Expected: storage test passes.

- [ ] **Step 4: Commit**

```powershell
git add worker/diplomat_worker/storage worker/tests/storage
git commit -m "feat: add local project store"
```

## Task 5: FFmpeg Preflight And Media Probing

**Files:**
- Create: `worker/diplomat_worker/media/__init__.py`
- Create: `worker/diplomat_worker/media/ffmpeg.py`
- Create: `worker/tests/media/test_ffmpeg.py`

- [ ] **Step 1: Write failing FFmpeg tests**

Create `worker/tests/media/test_ffmpeg.py`:

```python
import json
import subprocess
from pathlib import Path

from diplomat_worker.media.ffmpeg import FfmpegCheck, probe_video


def test_probe_video_parses_duration_and_audio_stream(monkeypatch, tmp_path: Path) -> None:
    source = tmp_path / "demo.mp4"
    source.write_bytes(b"fake")

    def fake_run(command, capture_output, text, check):
        assert "ffprobe" in command[0]
        return subprocess.CompletedProcess(
            command,
            0,
            stdout=json.dumps(
                {
                    "format": {"duration": "12.5"},
                    "streams": [
                        {"codec_type": "video", "codec_name": "h264"},
                        {"codec_type": "audio", "codec_name": "aac"},
                    ],
                }
            ),
            stderr="",
        )

    monkeypatch.setattr(subprocess, "run", fake_run)

    probe = probe_video(source, ffprobe_path="ffprobe")

    assert probe.duration_ms == 12_500
    assert probe.has_audio is True


def test_ffmpeg_check_reports_missing_source(tmp_path: Path) -> None:
    check = FfmpegCheck.for_source(tmp_path / "missing.mp4", ffmpeg_path="ffmpeg", ffprobe_path="ffprobe")

    assert check.ok is False
    assert check.error_code == "SOURCE_NOT_FOUND"
```

- [ ] **Step 2: Add FFmpeg implementation**

Create `worker/diplomat_worker/media/__init__.py`:

```python
from diplomat_worker.media.ffmpeg import FfmpegCheck, VideoProbe, probe_video

__all__ = ["FfmpegCheck", "VideoProbe", "probe_video"]
```

Create `worker/diplomat_worker/media/ffmpeg.py`:

```python
import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class VideoProbe:
    duration_ms: int
    has_audio: bool
    audio_codec: str | None
    video_codec: str | None


@dataclass(frozen=True)
class FfmpegCheck:
    ok: bool
    error_code: str | None
    message: str

    @staticmethod
    def for_source(source_video: Path, ffmpeg_path: str, ffprobe_path: str) -> "FfmpegCheck":
        if not source_video.exists():
            return FfmpegCheck(False, "SOURCE_NOT_FOUND", f"Source video does not exist: {source_video}")
        if shutil.which(ffmpeg_path) is None and not Path(ffmpeg_path).exists():
            return FfmpegCheck(False, "FFMPEG_NOT_FOUND", f"FFmpeg executable not found: {ffmpeg_path}")
        if shutil.which(ffprobe_path) is None and not Path(ffprobe_path).exists():
            return FfmpegCheck(False, "FFPROBE_NOT_FOUND", f"FFprobe executable not found: {ffprobe_path}")
        return FfmpegCheck(True, None, "FFmpeg preflight passed")


def probe_video(source_video: Path, ffprobe_path: str = "ffprobe") -> VideoProbe:
    command = [
        ffprobe_path,
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(source_video),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=True)
    payload = json.loads(result.stdout)
    duration_seconds = float(payload.get("format", {}).get("duration", 0))
    audio_codec = None
    video_codec = None
    for stream in payload.get("streams", []):
        if stream.get("codec_type") == "audio" and audio_codec is None:
            audio_codec = stream.get("codec_name")
        if stream.get("codec_type") == "video" and video_codec is None:
            video_codec = stream.get("codec_name")
    return VideoProbe(
        duration_ms=int(duration_seconds * 1000),
        has_audio=audio_codec is not None,
        audio_codec=audio_codec,
        video_codec=video_codec,
    )
```

- [ ] **Step 3: Run FFmpeg tests**

Run:

```powershell
python -m pytest worker/tests/media/test_ffmpeg.py -q
```

Expected: FFmpeg tests pass without requiring a real media file.

- [ ] **Step 4: Commit**

```powershell
git add worker/diplomat_worker/media worker/tests/media/test_ffmpeg.py
git commit -m "feat: add ffmpeg preflight and probing"
```

## Task 6: Audio Extraction And Chunk Planning

**Files:**
- Create: `worker/diplomat_worker/media/audio.py`
- Create: `worker/tests/media/test_audio.py`

- [ ] **Step 1: Write failing audio tests**

Create `worker/tests/media/test_audio.py`:

```python
import subprocess
from pathlib import Path

from diplomat_worker.media.audio import AudioChunk, build_fixed_chunks, extract_audio


def test_build_fixed_chunks_covers_duration_with_overlap() -> None:
    chunks = build_fixed_chunks(duration_ms=65_000, chunk_ms=30_000, overlap_ms=500)

    assert chunks == [
        AudioChunk(index=0, start_ms=0, end_ms=30_000),
        AudioChunk(index=1, start_ms=29_500, end_ms=59_500),
        AudioChunk(index=2, start_ms=59_000, end_ms=65_000),
    ]


def test_extract_audio_builds_expected_ffmpeg_command(monkeypatch, tmp_path: Path) -> None:
    source = tmp_path / "source.mp4"
    target = tmp_path / "audio.wav"
    source.write_bytes(b"fake")
    commands = []

    def fake_run(command, capture_output, text, check):
        commands.append(command)
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    monkeypatch.setattr(subprocess, "run", fake_run)

    extract_audio(source, target, ffmpeg_path="ffmpeg")

    assert commands[0] == [
        "ffmpeg",
        "-y",
        "-i",
        str(source),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        str(target),
    ]
```

- [ ] **Step 2: Add audio implementation**

Create `worker/diplomat_worker/media/audio.py`:

```python
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AudioChunk:
    index: int
    start_ms: int
    end_ms: int


def build_fixed_chunks(duration_ms: int, chunk_ms: int = 30_000, overlap_ms: int = 500) -> list[AudioChunk]:
    if duration_ms <= 0:
        return []
    if chunk_ms <= overlap_ms:
        raise ValueError("chunk_ms must be greater than overlap_ms")

    chunks: list[AudioChunk] = []
    start = 0
    index = 0
    while start < duration_ms:
        end = min(start + chunk_ms, duration_ms)
        chunks.append(AudioChunk(index=index, start_ms=start, end_ms=end))
        if end >= duration_ms:
            break
        start = end - overlap_ms
        index += 1
    return chunks


def extract_audio(source_video: Path, target_wav: Path, ffmpeg_path: str = "ffmpeg") -> Path:
    target_wav.parent.mkdir(parents=True, exist_ok=True)
    command = [
        ffmpeg_path,
        "-y",
        "-i",
        str(source_video),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        str(target_wav),
    ]
    subprocess.run(command, capture_output=True, text=True, check=True)
    return target_wav
```

Modify `worker/diplomat_worker/media/__init__.py`:

```python
from diplomat_worker.media.audio import AudioChunk, build_fixed_chunks, extract_audio
from diplomat_worker.media.ffmpeg import FfmpegCheck, VideoProbe, probe_video

__all__ = [
    "AudioChunk",
    "FfmpegCheck",
    "VideoProbe",
    "build_fixed_chunks",
    "extract_audio",
    "probe_video",
]
```

- [ ] **Step 3: Run audio tests**

Run:

```powershell
python -m pytest worker/tests/media/test_audio.py -q
```

Expected: audio tests pass.

- [ ] **Step 4: Commit**

```powershell
git add worker/diplomat_worker/media worker/tests/media/test_audio.py
git commit -m "feat: add audio extraction and chunk planning"
```

## Task 7: ASR Interface, Fake Adapter, And faster-whisper Adapter

**Files:**
- Create: `worker/diplomat_worker/asr/__init__.py`
- Create: `worker/diplomat_worker/asr/base.py`
- Create: `worker/diplomat_worker/asr/fake.py`
- Create: `worker/diplomat_worker/asr/faster_whisper.py`
- Create: `worker/tests/asr/test_fake.py`

- [ ] **Step 1: Write failing ASR tests**

Create `worker/tests/asr/test_fake.py`:

```python
from pathlib import Path

from diplomat_worker.asr.fake import FakeTranscriber
from diplomat_worker.media.audio import AudioChunk


def test_fake_transcriber_returns_deterministic_segments(tmp_path: Path) -> None:
    transcriber = FakeTranscriber(language="zh")
    chunks = [AudioChunk(index=0, start_ms=0, end_ms=2000)]

    result = transcriber.transcribe(audio_path=tmp_path / "audio.wav", chunks=chunks)

    assert result.engine == "fake-asr"
    assert result.model == "fake-v1"
    assert result.segments[0].start_ms == 0
    assert result.segments[0].end_ms == 2000
    assert result.segments[0].text == "Fake transcript chunk 0"
```

- [ ] **Step 2: Add ASR implementation**

Create `worker/diplomat_worker/asr/base.py`:

```python
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from diplomat_worker.media.audio import AudioChunk


@dataclass(frozen=True)
class AsrWord:
    text: str
    start_ms: int
    end_ms: int
    confidence: float | None


@dataclass(frozen=True)
class AsrSegment:
    id: str
    start_ms: int
    end_ms: int
    text: str
    words: list[AsrWord]


@dataclass(frozen=True)
class AsrResult:
    engine: str
    model: str
    language: str
    segments: list[AsrSegment]


class Transcriber(Protocol):
    def transcribe(self, audio_path: Path, chunks: list[AudioChunk]) -> AsrResult:
        raise NotImplementedError
```

Create `worker/diplomat_worker/asr/fake.py`:

```python
from pathlib import Path

from diplomat_worker.asr.base import AsrResult, AsrSegment, AsrWord
from diplomat_worker.media.audio import AudioChunk


class FakeTranscriber:
    def __init__(self, language: str = "zh") -> None:
        self.language = language

    def transcribe(self, audio_path: Path, chunks: list[AudioChunk]) -> AsrResult:
        segments = [
            AsrSegment(
                id=f"segment-{chunk.index}",
                start_ms=chunk.start_ms,
                end_ms=chunk.end_ms,
                text=f"Fake transcript chunk {chunk.index}",
                words=[
                    AsrWord(
                        text=f"chunk-{chunk.index}",
                        start_ms=chunk.start_ms,
                        end_ms=chunk.end_ms,
                        confidence=1.0,
                    )
                ],
            )
            for chunk in chunks
        ]
        return AsrResult(engine="fake-asr", model="fake-v1", language=self.language, segments=segments)
```

Create `worker/diplomat_worker/asr/faster_whisper.py`:

```python
from pathlib import Path

from diplomat_worker.asr.base import AsrResult, AsrSegment, AsrWord
from diplomat_worker.media.audio import AudioChunk


class FasterWhisperTranscriber:
    def __init__(self, model_name: str, device: str = "cuda", compute_type: str = "float16", language: str = "zh") -> None:
        self.model_name = model_name
        self.device = device
        self.compute_type = compute_type
        self.language = language

    def transcribe(self, audio_path: Path, chunks: list[AudioChunk]) -> AsrResult:
        from faster_whisper import WhisperModel

        model = WhisperModel(self.model_name, device=self.device, compute_type=self.compute_type)
        raw_segments, _info = model.transcribe(
            str(audio_path),
            language=self.language,
            word_timestamps=True,
        )
        segments: list[AsrSegment] = []
        for index, segment in enumerate(raw_segments):
            words = [
                AsrWord(
                    text=word.word,
                    start_ms=int(word.start * 1000),
                    end_ms=int(word.end * 1000),
                    confidence=getattr(word, "probability", None),
                )
                for word in (segment.words or [])
            ]
            segments.append(
                AsrSegment(
                    id=f"segment-{index}",
                    start_ms=int(segment.start * 1000),
                    end_ms=int(segment.end * 1000),
                    text=segment.text.strip(),
                    words=words,
                )
            )
        return AsrResult(
            engine="faster-whisper",
            model=self.model_name,
            language=self.language,
            segments=segments,
        )
```

Create `worker/diplomat_worker/asr/__init__.py`:

```python
from diplomat_worker.asr.base import AsrResult, AsrSegment, AsrWord, Transcriber
from diplomat_worker.asr.fake import FakeTranscriber
from diplomat_worker.asr.faster_whisper import FasterWhisperTranscriber

__all__ = [
    "AsrResult",
    "AsrSegment",
    "AsrWord",
    "FakeTranscriber",
    "FasterWhisperTranscriber",
    "Transcriber",
]
```

- [ ] **Step 3: Run ASR tests**

Run:

```powershell
python -m pytest worker/tests/asr/test_fake.py -q
```

Expected: fake ASR test passes without installing faster-whisper.

- [ ] **Step 4: Commit**

```powershell
git add worker/diplomat_worker/asr worker/tests/asr
git commit -m "feat: add pluggable asr adapters"
```

## Task 8: Core Pipeline Orchestration

**Files:**
- Create: `worker/diplomat_worker/pipeline/__init__.py`
- Create: `worker/diplomat_worker/pipeline/core.py`
- Create: `worker/tests/pipeline/test_core.py`

- [ ] **Step 1: Write failing core pipeline test**

Create `worker/tests/pipeline/test_core.py`:

```python
from pathlib import Path

from diplomat_worker.asr.fake import FakeTranscriber
from diplomat_worker.pipeline.core import CorePipelineInput, run_core_pipeline


def test_core_pipeline_builds_subtitle_document_from_fake_asr(tmp_path: Path) -> None:
    source_video = tmp_path / "demo.mp4"
    source_video.write_bytes(b"fake-video")
    project_dir = tmp_path / "project"

    result = run_core_pipeline(
        CorePipelineInput(
            project_id="project-1",
            media_id="media-1",
            source_video=source_video,
            project_dir=project_dir,
            duration_ms=65_000,
            source_language="zh",
            target_language="en",
        ),
        transcriber=FakeTranscriber(language="zh"),
        extract_audio_fn=lambda source, target: target.write_bytes(b"fake-audio") or target,
    )

    assert result.subtitle_document.project_id == "project-1"
    assert len(result.subtitle_document.lines) == 3
    assert result.subtitle_document.lines[0].source_text == "Fake transcript chunk 0"
    assert result.subtitle_path.exists()
    assert result.audio_path.exists()
```

- [ ] **Step 2: Add core pipeline implementation**

Create `worker/diplomat_worker/pipeline/core.py`:

```python
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from diplomat_worker.asr.base import Transcriber
from diplomat_worker.media.audio import build_fixed_chunks, extract_audio
from diplomat_worker.schemas.subtitle import AiOrigin, Speaker, SubtitleDocument, SubtitleLine, SubtitleStyle, WordTiming


@dataclass(frozen=True)
class CorePipelineInput:
    project_id: str
    media_id: str
    source_video: Path
    project_dir: Path
    duration_ms: int
    source_language: str
    target_language: str | None


@dataclass(frozen=True)
class CorePipelineResult:
    subtitle_document: SubtitleDocument
    subtitle_path: Path
    audio_path: Path


def default_style() -> SubtitleStyle:
    return SubtitleStyle(
        id="default",
        name="Default",
        font_family="Arial",
        font_size=36,
        primary_color="#FFFFFF",
        secondary_color="#14B8A6",
        stroke_width=3,
        shadow=1,
        position="bottom-center",
        margin_v=48,
        alignment="center",
        bilingual_layout="source-above-target",
        line_spacing=1.15,
    )


def default_speaker() -> Speaker:
    return Speaker(
        id="speaker-unknown",
        display_name="Unknown Speaker",
        color="#0D9488",
        style_id="default",
        merged_into=None,
    )


def run_core_pipeline(
    request: CorePipelineInput,
    transcriber: Transcriber,
    extract_audio_fn: Callable[[Path, Path], Path] | None = None,
) -> CorePipelineResult:
    request.project_dir.mkdir(parents=True, exist_ok=True)
    cache_dir = request.project_dir / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    audio_path = cache_dir / "audio-16000-mono.wav"

    extractor = extract_audio_fn or (lambda source, target: extract_audio(source, target))
    extractor(request.source_video, audio_path)

    chunks = build_fixed_chunks(request.duration_ms)
    asr_result = transcriber.transcribe(audio_path=audio_path, chunks=chunks)
    origin = AiOrigin(engine=asr_result.engine, model=asr_result.model)

    lines = [
        SubtitleLine(
            id=f"line-{index + 1}",
            start_ms=segment.start_ms,
            end_ms=segment.end_ms,
            speaker_id="speaker-unknown",
            source_language=asr_result.language,
            target_language=request.target_language,
            source_text=segment.text,
            translated_text="",
            words=[
                WordTiming(
                    text=word.text,
                    start_ms=word.start_ms,
                    end_ms=word.end_ms,
                    confidence=word.confidence,
                )
                for word in segment.words
            ],
            style_overrides={},
            review_status="draft",
            ai_origin=origin,
            notes="",
        )
        for index, segment in enumerate(asr_result.segments)
    ]

    document = SubtitleDocument(
        project_id=request.project_id,
        media_id=request.media_id,
        duration_ms=request.duration_ms,
        speakers=[default_speaker()],
        styles=[default_style()],
        lines=lines,
    )
    subtitle_path = request.project_dir / "subtitle.diplomat.json"
    subtitle_path.write_text(
        json.dumps(document.model_dump(by_alias=True), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return CorePipelineResult(
        subtitle_document=document,
        subtitle_path=subtitle_path,
        audio_path=audio_path,
    )
```

Create `worker/diplomat_worker/pipeline/__init__.py`:

```python
from diplomat_worker.pipeline.core import CorePipelineInput, CorePipelineResult, run_core_pipeline

__all__ = ["CorePipelineInput", "CorePipelineResult", "run_core_pipeline"]
```

- [ ] **Step 3: Run core pipeline tests**

Run:

```powershell
python -m pytest worker/tests/pipeline/test_core.py -q
```

Expected: core pipeline test passes and writes an internal subtitle document in the temp project directory.

- [ ] **Step 4: Commit**

```powershell
git add worker/diplomat_worker/pipeline worker/tests/pipeline
git commit -m "feat: add core subtitle pipeline"
```

## Task 9: Minimal Worker API

**Files:**
- Create: `worker/diplomat_worker/api/__init__.py`
- Create: `worker/diplomat_worker/api/app.py`
- Create: `worker/tests/api/test_app.py`

- [ ] **Step 1: Write failing API tests**

Create `worker/tests/api/test_app.py`:

```python
from fastapi.testclient import TestClient

from diplomat_worker.api.app import create_app


def test_health_endpoint_returns_worker_status() -> None:
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"name": "diplomat-worker", "status": "ok", "version": "0.1.0"}
```

- [ ] **Step 2: Add FastAPI app**

Create `worker/diplomat_worker/api/app.py`:

```python
from fastapi import FastAPI

from diplomat_worker import __version__


def create_app() -> FastAPI:
    app = FastAPI(title="Diplomat Worker", version=__version__)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"name": "diplomat-worker", "status": "ok", "version": __version__}

    return app


app = create_app()
```

Create `worker/diplomat_worker/api/__init__.py`:

```python
from diplomat_worker.api.app import app, create_app

__all__ = ["app", "create_app"]
```

- [ ] **Step 3: Run API tests**

Run:

```powershell
python -m pytest worker/tests/api/test_app.py -q
```

Expected: API health test passes.

- [ ] **Step 4: Manually start the worker API**

Run:

```powershell
python -m uvicorn diplomat_worker.api.app:app --app-dir worker --host 127.0.0.1 --port 8765
```

Expected: Uvicorn starts and logs that it is serving on `http://127.0.0.1:8765`.

Stop it with `Ctrl+C`.

- [ ] **Step 5: Commit**

```powershell
git add worker/diplomat_worker/api worker/tests/api
git commit -m "feat: add worker health api"
```

## Task 10: Minimal React Workbench Shell

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/api.ts`
- Create: `apps/web/tests/App.test.tsx`

- [ ] **Step 1: Write failing React test**

Create `apps/web/tests/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

describe("App", () => {
  it("renders the M0 workbench shell", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ name: "diplomat-worker", status: "ok", version: "0.1.0" })
      }))
    );

    render(<App />);

    expect(screen.getByRole("heading", { name: "Diplomat" })).toBeInTheDocument();
    expect(await screen.findByText("Worker: ok")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Add React shell implementation**

Create `apps/web/package.json`:

```json
{
  "name": "@diplomat/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "scripts": {
    "check": "pnpm test && pnpm typecheck",
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@diplomat/shared": "workspace:*",
    "@vitejs/plugin-react": "^4.5.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.3.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "jsdom": "^26.1.0",
    "typescript": "^5.8.0",
    "vite": "^6.3.0",
    "vitest": "^3.2.0"
  }
}
```

Create `apps/web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

Create `apps/web/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1420,
    strictPort: true
  },
  test: {
    environment: "jsdom",
    setupFiles: ["@testing-library/jest-dom/vitest"]
  }
});
```

Create `apps/web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Diplomat</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `apps/web/src/api.ts`:

```ts
export type WorkerHealth = {
  name: string;
  status: string;
  version: string;
};

export async function fetchWorkerHealth(baseUrl = "http://127.0.0.1:8765"): Promise<WorkerHealth> {
  const response = await fetch(`${baseUrl}/health`);
  if (!response.ok) {
    throw new Error(`Worker health request failed: ${response.status}`);
  }
  return response.json() as Promise<WorkerHealth>;
}
```

Create `apps/web/src/App.tsx`:

```tsx
import { useEffect, useState } from "react";
import { fetchWorkerHealth, type WorkerHealth } from "./api";

export function App() {
  const [health, setHealth] = useState<WorkerHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    fetchWorkerHealth()
      .then((result) => {
        if (!canceled) {
          setHealth(result);
        }
      })
      .catch((err: unknown) => {
        if (!canceled) {
          setError(err instanceof Error ? err.message : "Unknown worker error");
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1>Diplomat</h1>
      <p>Local AI subtitle editor foundation.</p>
      <section aria-live="polite">
        {health ? <strong>Worker: {health.status}</strong> : <strong>Worker: checking</strong>}
        {error ? <p role="alert">Worker error: {error}</p> : null}
      </section>
    </main>
  );
}
```

Create `apps/web/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 3: Run React tests**

Run:

```powershell
pnpm install
pnpm --filter @diplomat/web test
pnpm --filter @diplomat/web typecheck
```

Expected: React test passes and TypeScript reports no errors.

- [ ] **Step 4: Commit**

```powershell
git add apps/web package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat: add react workbench shell"
```

## Task 11: Minimal Tauri v2 Desktop Shell

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/build.rs`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Add desktop package metadata**

Create `apps/desktop/package.json`:

```json
{
  "name": "@diplomat/desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "scripts": {
    "check": "pnpm test && pnpm typecheck",
    "dev": "tauri dev",
    "build": "tauri build",
    "test": "node -e \"console.log('desktop shell metadata ok')\"",
    "typecheck": "node -e \"console.log('desktop shell has no TypeScript sources')\""
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.5.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Add Tauri Rust project**

Create `apps/desktop/src-tauri/Cargo.toml`:

```toml
[package]
name = "diplomat"
version = "0.1.0"
description = "Diplomat desktop shell"
authors = ["Drew1811266"]
license = "MIT"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

Create `apps/desktop/src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build()
}
```

Create `apps/desktop/src-tauri/src/main.rs`:

```rust
#[tauri::command]
fn worker_endpoint() -> &'static str {
    "http://127.0.0.1:8765"
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![worker_endpoint])
        .run(tauri::generate_context!())
        .expect("error while running Diplomat");
}
```

Create `apps/desktop/src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Diplomat",
  "version": "0.1.0",
  "identifier": "dev.diplomat.app",
  "build": {
    "beforeDevCommand": "pnpm --dir ../web dev",
    "beforeBuildCommand": "pnpm --dir ../web build",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../web/dist"
  },
  "app": {
    "windows": [
      {
        "title": "Diplomat",
        "width": 1280,
        "height": 800,
        "minWidth": 1024,
        "minHeight": 700
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": false,
    "targets": "all",
    "icon": []
  }
}
```

This follows the Tauri v2 project/config shape documented by Tauri's official create-project and configuration references.

- [ ] **Step 3: Verify desktop metadata without building the installer**

Run:

```powershell
pnpm --filter @diplomat/desktop typecheck
```

Expected: TypeScript command exits successfully. Rust/Tauri full build can be run once Rust and platform prerequisites are installed.

- [ ] **Step 4: Commit**

```powershell
git add apps/desktop
git commit -m "feat: add tauri desktop shell"
```

## Task 12: End-To-End Verification Script

**Files:**
- Modify: `scripts/check.ps1`

- [ ] **Step 1: Update verification script**

Replace `scripts/check.ps1` with:

```powershell
$ErrorActionPreference = "Stop"

Write-Host "Installing JavaScript dependencies if needed"
pnpm install --frozen-lockfile

Write-Host "Running TypeScript package checks"
pnpm -r test
pnpm -r typecheck

Write-Host "Installing Python worker in editable mode"
python -m pip install -e .\worker[dev]

Write-Host "Running Python tests"
python -m pytest

Write-Host "All M0/M1 checks completed"
```

- [ ] **Step 2: Run full verification**

Run:

```powershell
.\scripts\check.ps1
```

Expected:

- `@diplomat/shared` tests pass.
- `@diplomat/web` tests pass.
- `@diplomat/desktop` metadata check command passes.
- TypeScript typechecks pass.
- Python worker tests pass.
- Script prints `All M0/M1 checks completed`.

- [ ] **Step 3: Commit**

```powershell
git add scripts/check.ps1
git commit -m "chore: add m0 m1 verification script"
```

## Task 13: M0/M1 Documentation

**Files:**
- Modify: `README.md`
- Create: `docs/development/m0-m1-core-pipeline.md`

- [ ] **Step 1: Add development documentation**

Create `docs/development/m0-m1-core-pipeline.md`:

```markdown
# M0/M1 Core Pipeline

This document describes the first executable Diplomat path.

## Implemented In M0/M1

- Shared TypeScript subtitle and task schemas.
- Python Worker schema mirror.
- SQLite project store.
- FFmpeg source validation and media probing.
- Audio extraction command generation.
- Fixed-size recoverable chunk planning.
- Pluggable ASR interface.
- Deterministic fake ASR for tests.
- Optional faster-whisper adapter.
- Core pipeline that writes `subtitle.diplomat.json`.
- Minimal Worker health API.
- Minimal React shell.
- Minimal Tauri v2 shell.

## Running Checks

```powershell
.\scripts\check.ps1
```

## Running Worker API

```powershell
python -m uvicorn diplomat_worker.api.app:app --app-dir worker --host 127.0.0.1 --port 8765
```

## Running Web Shell

```powershell
pnpm --filter @diplomat/web dev
```

Open `http://localhost:1420`.

## Running Desktop Shell

```powershell
pnpm --filter @diplomat/desktop dev
```

This requires Rust and Tauri prerequisites.

## Current Pipeline Boundary

The M0/M1 pipeline writes Diplomat's internal subtitle document. It does not export SRT/VTT/ASS and does not burn subtitles into video. Those capabilities are covered by separate milestone plans.
```

Append to `README.md` after the existing verification section:

```markdown
## Development Docs

- [M0/M1 Core Pipeline](docs/development/m0-m1-core-pipeline.md)
- [Product Design Spec](docs/superpowers/specs/2026-06-04-diplomat-ai-subtitle-editor-design.md)
```

- [ ] **Step 2: Run documentation path check**

Run:

```powershell
Test-Path docs/development/m0-m1-core-pipeline.md
Test-Path docs/superpowers/specs/2026-06-04-diplomat-ai-subtitle-editor-design.md
```

Expected: both commands print `True`.

- [ ] **Step 3: Commit**

```powershell
git add README.md docs/development/m0-m1-core-pipeline.md
git commit -m "docs: document m0 m1 core pipeline"
```

## Final Verification

- [ ] **Step 1: Run the complete check script**

Run:

```powershell
.\scripts\check.ps1
```

Expected: all TypeScript and Python checks pass.

- [ ] **Step 2: Inspect git history**

Run:

```powershell
git log --oneline -10
```

Expected: recent commits show one commit per task:

```text
docs: document m0 m1 core pipeline
chore: add m0 m1 verification script
feat: add tauri desktop shell
feat: add react workbench shell
feat: add worker health api
feat: add core subtitle pipeline
feat: add pluggable asr adapters
feat: add audio extraction and chunk planning
feat: add ffmpeg preflight and probing
feat: add local project store
```

- [ ] **Step 3: Confirm clean working tree**

Run:

```powershell
git status --short
```

Expected: no tracked file changes. Ignored `.superpowers/` may appear only when using `git status --short --ignored`.

## Source References Used For This Plan

- Tauri v2 create-project reference: https://v2.tauri.app/start/create-project/
- Tauri v2 configuration reference: https://v2.tauri.app/reference/config/
- Approved Diplomat design spec: `docs/superpowers/specs/2026-06-04-diplomat-ai-subtitle-editor-design.md`
