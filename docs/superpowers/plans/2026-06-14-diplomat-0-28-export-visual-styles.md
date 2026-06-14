# Diplomat 0.28 Export Visual Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable SRT/VTT/ASS subtitle export, server-side export validation, project style presets, and live subtitle style preview.

**Architecture:** Keep the Worker authoritative for stable-document export, timing validation, and durable style preset persistence. The Web Workbench mirrors validation for immediate feedback, owns the active style draft for preview, and sends export requests to a new general subtitle export route while preserving the legacy SRT route.

**Tech Stack:** TypeScript/Zod/Vitest/React 19/Mantine/React Query, Python 3.12/FastAPI/Pydantic/pytest, existing Worker project store, subtitle schema, and Workbench inspector patterns.

---

## File Structure

- Modify `packages/shared/src/subtitle.ts`: add style fields for background bar/background color/safe area margin.
- Modify `packages/shared/src/export.ts`: add general subtitle export schemas, validation warnings, and style preset schemas while keeping `SrtExport*` aliases.
- Modify `packages/shared/tests/subtitle.test.ts`: style schema coverage.
- Modify `packages/shared/tests/export.test.ts`: export and style preset contract coverage.
- Create `worker/diplomat_worker/export/text_subtitles.py`: SRT/VTT/ASS formatting, text rendering, timing validation, and file writing.
- Modify `worker/diplomat_worker/export/__init__.py`: export new formatter functions and keep SRT compatibility exports.
- Modify `worker/diplomat_worker/export/srt.py`: delegate compatibility helpers to `text_subtitles.py`.
- Create `worker/tests/export/test_text_subtitles.py`: formatter and validation tests.
- Modify `worker/tests/export/test_srt.py`: keep legacy tests passing through delegated implementation.
- Modify `worker/diplomat_worker/schemas/subtitle.py`: add new style fields.
- Modify `worker/diplomat_worker/api/schemas.py`: add export and style preset request/response models.
- Modify `worker/diplomat_worker/storage/project_store.py`: persist project style presets and apply presets to stable subtitles.
- Modify `worker/tests/storage/test_project_store.py`: style preset storage tests.
- Modify `worker/diplomat_worker/api/app.py`: add subtitle export and style preset endpoints.
- Modify `worker/tests/api/test_app.py`: API tests and route coverage.
- Modify `apps/web/src/api.ts`: general export and style preset helpers.
- Modify `apps/web/tests/api.test.ts`: helper tests.
- Modify `apps/web/src/queries/queryKeys.ts`: style preset query keys.
- Modify `apps/web/src/queries/exportQueries.ts`: general subtitle export mutation.
- Create `apps/web/src/queries/stylePresetQueries.ts`: style preset hooks.
- Create `apps/web/src/lib/subtitleStyles.ts`: style defaults, style normalization, preview CSS, validation summary helpers.
- Create `apps/web/src/lib/subtitleStyles.test.ts`: pure style helper tests.
- Modify `apps/web/src/components/VideoPreviewPanel.tsx`: render preview using active style draft and optional safe-area overlay.
- Create `apps/web/src/components/VideoPreviewPanel.test.tsx`: preview rendering tests.
- Modify `apps/web/src/components/inspectors/ExportInspector.tsx`: format/mode selection, validation summary, style editor, preset controls, export result warnings.
- Modify `apps/web/src/components/inspectors/ExportInspector.test.tsx`: inspector behavior tests.
- Modify `apps/web/src/pages/WorkbenchPage.tsx`: wire export format/mode/style/preset state, validation blocking, preview props, and mutations.
- Modify `apps/web/src/pages/WorkbenchPage.test.tsx`: integration tests.
- Modify `apps/web/e2e/fixtures.ts`: fixture route coverage for export formats and style presets.
- Modify `apps/web/e2e/workbench.spec.ts`: e2e export copy updates.
- Modify `apps/web/src/i18n/en.ts`: 0.28 English copy.
- Modify `apps/web/src/i18n/zh.ts`: 0.28 Chinese copy.
- Create `docs/development/0-28-stage-gate-review.md`: after verification.

---

### Task 1: Shared Export And Style Contracts

**Files:**
- Modify: `packages/shared/src/subtitle.ts`
- Modify: `packages/shared/src/export.ts`
- Test: `packages/shared/tests/subtitle.test.ts`
- Test: `packages/shared/tests/export.test.ts`

- [ ] **Step 1: Write failing shared tests**

Add to `packages/shared/tests/export.test.ts`:

```ts
import {
  StylePresetCreateRequestSchema,
  StylePresetListResponseSchema,
  SubtitleExportRequestSchema,
  SubtitleExportResponseSchema
} from "../src";

const style = {
  id: "default",
  name: "Default",
  fontFamily: "Arial",
  fontSize: 42,
  primaryColor: "#ffffff",
  secondaryColor: "#14b8a6",
  strokeWidth: 2,
  shadow: 1,
  position: "bottom",
  marginV: 48,
  alignment: "center",
  bilingualLayout: "source_top",
  lineSpacing: 1.1,
  backgroundBar: true,
  backgroundColor: "#000000cc",
  safeAreaMargin: 32
};

it("parses general subtitle export requests and warning responses", () => {
  const request = SubtitleExportRequestSchema.parse({
    format: "ass",
    mode: "bilingual",
    stylePresetId: "preset-default",
    style
  });

  const response = SubtitleExportResponseSchema.parse({
    projectId: "project-demo",
    exportPath: "D:/Diplomat/projects/project-demo/exports/subtitle-bilingual.ass",
    format: request.format,
    mode: request.mode,
    warnings: [
      {
        lineId: "line-1",
        code: "too_short",
        severity: "warning",
        message: "Cue is shorter than 300ms."
      }
    ]
  });

  expect(response.format).toBe("ass");
  expect(response.warnings[0].code).toBe("too_short");
});

it("parses style preset requests and list responses", () => {
  const create = StylePresetCreateRequestSchema.parse({ name: "Broadcast", style });
  const list = StylePresetListResponseSchema.parse({
    projectId: "project-demo",
    activePresetId: "preset-default",
    presets: [
      {
        id: "preset-default",
        name: create.name,
        style,
        createdAt: "2026-06-14T00:00:00+00:00",
        updatedAt: "2026-06-14T00:00:00+00:00"
      }
    ]
  });

  expect(list.presets[0].style.backgroundBar).toBe(true);
});
```

Add to `packages/shared/tests/subtitle.test.ts`:

```ts
import { SubtitleStyleSchema } from "../src";

it("parses subtitle styles with 0.28 visual fields", () => {
  const style = SubtitleStyleSchema.parse({
    id: "default",
    name: "Default",
    fontFamily: "Arial",
    fontSize: 42,
    primaryColor: "#ffffff",
    secondaryColor: "#14b8a6",
    strokeWidth: 2,
    shadow: 1,
    position: "bottom",
    marginV: 48,
    alignment: "center",
    bilingualLayout: "source_top",
    lineSpacing: 1.1,
    backgroundBar: true,
    backgroundColor: "#000000cc",
    safeAreaMargin: 32
  });

  expect(style.safeAreaMargin).toBe(32);
});
```

- [ ] **Step 2: Run shared tests and verify failure**

```powershell
corepack pnpm --dir packages/shared test
```

Expected: fails because the new export and style preset schemas do not exist and the style schema does not accept the new fields.

- [ ] **Step 3: Implement shared contracts**

In `packages/shared/src/subtitle.ts`, extend `SubtitleStyleSchema`:

```ts
  backgroundBar: z.boolean().default(false),
  backgroundColor: z.string().min(1).default("#000000cc"),
  safeAreaMargin: z.number().int().nonnegative().default(32)
```

In `packages/shared/src/export.ts`, replace the SRT-only model with:

```ts
import { z } from "zod";
import { SubtitleStyleSchema } from "./subtitle";

export const SubtitleExportFormatSchema = z.enum(["srt", "vtt", "ass"]);
export const SubtitleExportModeSchema = z.enum(["source", "target", "bilingual"]);

export const ExportValidationCodeSchema = z.enum([
  "negative_time",
  "end_before_start",
  "too_short",
  "overlap_previous",
  "overlap_next",
  "overlong_text"
]);

export const ExportValidationIssueSchema = z.object({
  lineId: z.string().min(1),
  code: ExportValidationCodeSchema,
  severity: z.enum(["warning", "error"]),
  message: z.string().min(1)
});

export const SubtitleExportRequestSchema = z.object({
  format: SubtitleExportFormatSchema.default("srt"),
  mode: SubtitleExportModeSchema.default("bilingual"),
  stylePresetId: z.string().min(1).nullable().default(null),
  style: SubtitleStyleSchema.nullable().default(null)
});

export const SubtitleExportResponseSchema = z.object({
  projectId: z.string().min(1),
  exportPath: z.string().min(1),
  format: SubtitleExportFormatSchema,
  mode: SubtitleExportModeSchema,
  warnings: z.array(ExportValidationIssueSchema).default([])
});

export const StylePresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  style: SubtitleStyleSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const StylePresetListResponseSchema = z.object({
  projectId: z.string().min(1),
  activePresetId: z.string().min(1).nullable(),
  presets: z.array(StylePresetSchema)
});

export const StylePresetCreateRequestSchema = z.object({
  name: z.string().min(1),
  style: SubtitleStyleSchema
});

export const StylePresetUpdateRequestSchema = z.object({
  name: z.string().min(1).optional(),
  style: SubtitleStyleSchema.optional()
});

export const StylePresetApplyResponseSchema = z.object({
  projectId: z.string().min(1),
  activePresetId: z.string().min(1),
  style: SubtitleStyleSchema
});

export const SrtExportModeSchema = SubtitleExportModeSchema;
export const SrtExportRequestSchema = SubtitleExportRequestSchema.pick({ mode: true });
export const SrtExportResponseSchema = z.object({
  projectId: z.string().min(1),
  exportPath: z.string().min(1),
  mode: SubtitleExportModeSchema
});

export type SubtitleExportFormat = z.infer<typeof SubtitleExportFormatSchema>;
export type SubtitleExportMode = z.infer<typeof SubtitleExportModeSchema>;
export type ExportValidationCode = z.infer<typeof ExportValidationCodeSchema>;
export type ExportValidationIssue = z.infer<typeof ExportValidationIssueSchema>;
export type SubtitleExportRequest = z.infer<typeof SubtitleExportRequestSchema>;
export type SubtitleExportResponse = z.infer<typeof SubtitleExportResponseSchema>;
export type StylePreset = z.infer<typeof StylePresetSchema>;
export type StylePresetListResponse = z.infer<typeof StylePresetListResponseSchema>;
export type StylePresetCreateRequest = z.infer<typeof StylePresetCreateRequestSchema>;
export type StylePresetUpdateRequest = z.infer<typeof StylePresetUpdateRequestSchema>;
export type StylePresetApplyResponse = z.infer<typeof StylePresetApplyResponseSchema>;
export type SrtExportMode = z.infer<typeof SrtExportModeSchema>;
export type SrtExportRequest = z.infer<typeof SrtExportRequestSchema>;
export type SrtExportResponse = z.infer<typeof SrtExportResponseSchema>;
```

- [ ] **Step 4: Run shared tests and commit**

```powershell
corepack pnpm --dir packages/shared test
git add packages/shared/src/subtitle.ts packages/shared/src/export.ts packages/shared/tests/subtitle.test.ts packages/shared/tests/export.test.ts
git commit -m "feat(shared): add subtitle export and style contracts"
```

---

### Task 2: Worker Text Subtitle Export Engine

**Files:**
- Create: `worker/diplomat_worker/export/text_subtitles.py`
- Modify: `worker/diplomat_worker/export/__init__.py`
- Modify: `worker/diplomat_worker/export/srt.py`
- Modify: `worker/diplomat_worker/schemas/subtitle.py`
- Test: `worker/tests/export/test_text_subtitles.py`
- Test: `worker/tests/export/test_srt.py`

- [ ] **Step 1: Write failing export engine tests**

Create `worker/tests/export/test_text_subtitles.py`:

```python
from pathlib import Path

import pytest

from diplomat_worker.export.text_subtitles import (
    ExportValidationError,
    format_ass_timestamp,
    format_vtt_timestamp,
    subtitle_document_to_ass,
    subtitle_document_to_vtt,
    validate_subtitle_document_for_export,
    write_subtitle_export,
)


def test_vtt_export_writes_header_dot_timestamps_and_bilingual_text() -> None:
    vtt = subtitle_document_to_vtt(make_document(), mode="bilingual")

    assert vtt.startswith("WEBVTT\n\n")
    assert "00:00:01.000 --> 00:00:03.000" in vtt
    assert "你好\nHello" in vtt


def test_ass_export_writes_style_and_dialogue_rows() -> None:
    ass = subtitle_document_to_ass(make_document(), mode="bilingual")

    assert "[V4+ Styles]" in ass
    assert "Style: Default,Arial,42" in ass
    assert "[Events]" in ass
    assert "Dialogue: 0,0:00:01.00,0:00:03.00,Default" in ass
    assert "你好\\NHello" in ass


def test_export_validation_blocks_overlaps() -> None:
    document = make_document_with_overlap()

    with pytest.raises(ExportValidationError) as exc:
        validate_subtitle_document_for_export(document)

    assert any(issue.code == "overlap_previous" for issue in exc.value.issues)


def test_export_validation_returns_warnings_for_short_cues() -> None:
    document = make_document_with_short_cue()

    warnings = validate_subtitle_document_for_export(document)

    assert warnings[0].code == "too_short"
    assert warnings[0].severity == "warning"


def test_write_subtitle_export_uses_format_extension(tmp_path: Path) -> None:
    result = write_subtitle_export(make_document(), tmp_path / "subtitle.vtt", "vtt", "target")

    assert result.exists()
    assert result.read_text(encoding="utf-8").startswith("WEBVTT")
```

Use existing `worker/tests/export/test_srt.py` fixtures or copy their `make_document()` helper into the new file with a default style containing the 0.28 fields.

- [ ] **Step 2: Run export tests and verify failure**

```powershell
python -m pytest worker/tests/export/test_text_subtitles.py worker/tests/export/test_srt.py -q
```

Expected: fails because `text_subtitles.py` and 0.28 style fields do not exist.

- [ ] **Step 3: Implement export engine**

Create `worker/diplomat_worker/export/text_subtitles.py` with:

```python
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from diplomat_worker.schemas.subtitle import SubtitleDocument, SubtitleLine, SubtitleStyle

SubtitleExportFormat = Literal["srt", "vtt", "ass"]
SubtitleExportMode = Literal["source", "target", "bilingual"]


@dataclass(frozen=True)
class ExportValidationIssue:
    line_id: str
    code: str
    severity: Literal["warning", "error"]
    message: str


class ExportValidationError(ValueError):
    def __init__(self, issues: list[ExportValidationIssue]) -> None:
        super().__init__("Subtitle timing contains blocking export errors")
        self.issues = issues


def format_srt_timestamp(milliseconds: int) -> str:
    total_seconds, millis = divmod(milliseconds, 1000)
    total_minutes, seconds = divmod(total_seconds, 60)
    hours, minutes = divmod(total_minutes, 60)
    return f"{hours:02}:{minutes:02}:{seconds:02},{millis:03}"


def format_vtt_timestamp(milliseconds: int) -> str:
    return format_srt_timestamp(milliseconds).replace(",", ".")


def format_ass_timestamp(milliseconds: int) -> str:
    total_centiseconds = round(milliseconds / 10)
    total_seconds, centiseconds = divmod(total_centiseconds, 100)
    total_minutes, seconds = divmod(total_seconds, 60)
    hours, minutes = divmod(total_minutes, 60)
    return f"{hours}:{minutes:02}:{seconds:02}.{centiseconds:02}"


def sorted_export_lines(document: SubtitleDocument) -> list[SubtitleLine]:
    return sorted(document.lines, key=lambda line: (line.start_ms, line.end_ms, line.id))
```

Implement:

- `render_line_text(line, mode, bilingual_layout="source_top", separator="\n")`.
- `subtitle_document_to_srt(document, mode="bilingual")`.
- `subtitle_document_to_vtt(document, mode="bilingual")`.
- `subtitle_document_to_ass(document, mode="bilingual", style=None)`.
- `validate_subtitle_document_for_export(document)`.
- `write_subtitle_export(document, output_path, export_format, mode, style=None)`.

Move legacy behavior from `srt.py` into delegation:

```python
from diplomat_worker.export.text_subtitles import (
    SubtitleExportMode as SrtMode,
    format_srt_timestamp,
    subtitle_document_to_srt,
    write_srt_export,
)
```

- [ ] **Step 4: Run export tests and commit**

```powershell
python -m pytest worker/tests/export/test_text_subtitles.py worker/tests/export/test_srt.py -q
git add worker/diplomat_worker/export/text_subtitles.py worker/diplomat_worker/export/__init__.py worker/diplomat_worker/export/srt.py worker/diplomat_worker/schemas/subtitle.py worker/tests/export/test_text_subtitles.py worker/tests/export/test_srt.py
git commit -m "feat(worker): add vtt and ass subtitle export"
```

---

### Task 3: Worker Style Preset Storage And APIs

**Files:**
- Modify: `worker/diplomat_worker/storage/project_store.py`
- Modify: `worker/diplomat_worker/api/schemas.py`
- Modify: `worker/diplomat_worker/api/app.py`
- Test: `worker/tests/storage/test_project_store.py`
- Test: `worker/tests/api/test_app.py`

- [ ] **Step 1: Write failing storage and API tests**

Add storage tests:

```python
def test_style_presets_return_default_and_round_trip(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project("Demo", tmp_path / "demo.mp4", 1000, "zh", "en")
    document = translated_document(project.project_id)
    store.save_subtitle_document(project.project_id, document)

    defaults = store.list_style_presets(project.project_id)
    created = store.create_style_preset(project.project_id, "Broadcast", defaults.presets[0].style)
    renamed = store.update_style_preset(project.project_id, created.id, name="Broadcast Renamed")
    applied = store.apply_style_preset(project.project_id, renamed.id)

    assert defaults.presets[0].name == "Default"
    assert renamed.name == "Broadcast Renamed"
    assert applied.active_preset_id == renamed.id
    assert store.load_subtitle_document(project.project_id).styles[0].name == "Broadcast Renamed"


def test_delete_active_style_preset_falls_back(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project("Demo", tmp_path / "demo.mp4", 1000, "zh", "en")
    document = translated_document(project.project_id)
    store.save_subtitle_document(project.project_id, document)
    preset = store.create_style_preset(project.project_id, "Temporary", document.styles[0])
    store.apply_style_preset(project.project_id, preset.id)

    remaining = store.delete_style_preset(project.project_id, preset.id)

    assert remaining.active_preset_id is not None
```

Add API tests:

```python
def test_style_preset_routes_round_trip(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    project_id = create_project_with_saved_subtitle(client, tmp_path)
    style = client.get(f"/projects/{project_id}/subtitle").json()["styles"][0]

    created = client.post(
        f"/projects/{project_id}/style-presets",
        json={"name": "Broadcast", "style": style},
    )
    listed = client.get(f"/projects/{project_id}/style-presets")
    renamed = client.patch(
        f"/projects/{project_id}/style-presets/{created.json()['id']}",
        json={"name": "Broadcast Renamed"},
    )
    applied = client.post(
        f"/projects/{project_id}/style-presets/{created.json()['id']}/apply"
    )
    deleted = client.delete(f"/projects/{project_id}/style-presets/{created.json()['id']}")

    assert created.status_code == 201
    assert listed.json()["presets"]
    assert renamed.json()["name"] == "Broadcast Renamed"
    assert applied.json()["activePresetId"] == created.json()["id"]
    assert deleted.status_code == 200
```

- [ ] **Step 2: Run tests and verify failure**

```powershell
python -m pytest worker/tests/storage/test_project_store.py worker/tests/api/test_app.py -q
```

Expected: fails because style preset storage and routes do not exist.

- [ ] **Step 3: Implement style preset persistence and routes**

In `project_store.py`, add:

- `STYLE_PRESET_SCHEMA_VERSION = "diplomat.style-presets.v1"`.
- `StylePresetRecord`.
- `StylePresetListRecord`.
- `_style_preset_path(project)`.
- `_default_subtitle_style(project_id)`.
- `list_style_presets(project_id)`.
- `create_style_preset(project_id, name, style)`.
- `update_style_preset(project_id, preset_id, name=None, style=None)`.
- `delete_style_preset(project_id, preset_id)`.
- `apply_style_preset(project_id, preset_id)`.

Implement project-local JSON writes with safe ids `preset-<uuidhex>`, timestamps from `_utc_now()`, and project id validation.

In `api/schemas.py`, add:

```python
class StylePresetResponse(CamelModel):
    id: str
    name: str
    style: SubtitleStyle
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")

class StylePresetListResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    active_preset_id: str | None = Field(alias="activePresetId")
    presets: list[StylePresetResponse]

class StylePresetCreateRequest(CamelModel):
    name: str = Field(min_length=1)
    style: SubtitleStyle

class StylePresetUpdateRequest(CamelModel):
    name: str | None = Field(default=None, min_length=1)
    style: SubtitleStyle | None = None

class StylePresetApplyResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    active_preset_id: str = Field(alias="activePresetId")
    style: SubtitleStyle
```

Add routes:

- `GET /projects/{project_id}/style-presets`
- `POST /projects/{project_id}/style-presets`
- `PATCH /projects/{project_id}/style-presets/{preset_id}`
- `DELETE /projects/{project_id}/style-presets/{preset_id}`
- `POST /projects/{project_id}/style-presets/{preset_id}/apply`

- [ ] **Step 4: Run tests and commit**

```powershell
python -m pytest worker/tests/storage/test_project_store.py worker/tests/api/test_app.py -q
git add worker/diplomat_worker/storage/project_store.py worker/diplomat_worker/api/schemas.py worker/diplomat_worker/api/app.py worker/tests/storage/test_project_store.py worker/tests/api/test_app.py
git commit -m "feat(worker): add project style preset APIs"
```

---

### Task 4: Worker General Export API

**Files:**
- Modify: `worker/diplomat_worker/api/schemas.py`
- Modify: `worker/diplomat_worker/api/app.py`
- Test: `worker/tests/api/test_app.py`

- [ ] **Step 1: Write failing API export tests**

Add tests:

```python
def test_general_subtitle_export_writes_vtt_and_returns_warnings(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    project_id = create_project_with_saved_subtitle(client, tmp_path)

    response = client.post(
        f"/projects/{project_id}/exports/subtitles",
        json={"format": "vtt", "mode": "bilingual"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["format"] == "vtt"
    assert payload["mode"] == "bilingual"
    assert payload["exportPath"].endswith("subtitle-bilingual.vtt")
    assert Path(payload["exportPath"]).read_text(encoding="utf-8").startswith("WEBVTT")


def test_general_subtitle_export_blocks_overlap(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    project_id = create_project_with_saved_subtitle(client, tmp_path)
    document = client.get(f"/projects/{project_id}/subtitle").json()
    document["lines"].append({**document["lines"][0], "id": "line-overlap"})
    client.put(f"/projects/{project_id}/subtitle", json={"document": document})

    response = client.post(
        f"/projects/{project_id}/exports/subtitles",
        json={"format": "ass", "mode": "bilingual"},
    )

    assert response.status_code == 409
    assert "overlap" in response.json()["detail"][0]["code"]
```

Update route coverage to include `POST /projects/{project_id}/exports/subtitles`.

- [ ] **Step 2: Run API tests and verify failure**

```powershell
python -m pytest worker/tests/api/test_app.py -q
```

Expected: fails because general export route does not exist.

- [ ] **Step 3: Implement general export API**

Add Pydantic export models mirroring shared schemas. In `app.py`, import:

```python
from diplomat_worker.export.text_subtitles import (
    ExportValidationError,
    write_subtitle_export,
)
```

Add helper:

```python
def export_validation_issue_response(issue: ExportValidationIssue) -> ExportValidationIssueResponse:
    return ExportValidationIssueResponse(
        line_id=issue.line_id,
        code=issue.code,
        severity=issue.severity,
        message=issue.message,
    )
```

Add route:

```python
@app.post("/projects/{project_id}/exports/subtitles", response_model=SubtitleExportResponse)
def export_subtitles(project_id: str, request: SubtitleExportRequest) -> SubtitleExportResponse:
    active_runtime = get_runtime()
    try:
        project = active_runtime.store.get_project(project_id)
        document = active_runtime.store.load_subtitle_document(project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Subtitle document not found") from exc

    style = request.style
    if style is None and request.style_preset_id is not None:
        style = active_runtime.store.get_style_preset(project_id, request.style_preset_id).style

    export_path = project.project_dir / "exports" / f"subtitle-{request.mode}.{request.format}"
    try:
        warnings = write_subtitle_export(document, export_path, request.format, request.mode, style=style)
    except ExportValidationError as exc:
        raise HTTPException(
            status_code=409,
            detail=[export_validation_issue_response(issue).model_dump(by_alias=True) for issue in exc.issues],
        ) from exc

    active_runtime.store.touch_project(project_id)
    return SubtitleExportResponse(
        project_id=project_id,
        export_path=str(export_path),
        format=request.format,
        mode=request.mode,
        warnings=[export_validation_issue_response(issue) for issue in warnings],
    )
```

Update legacy SRT route to call the same engine and return `SrtExportResponse`.

- [ ] **Step 4: Run API tests and commit**

```powershell
python -m pytest worker/tests/export/test_text_subtitles.py worker/tests/export/test_srt.py worker/tests/api/test_app.py -q
git add worker/diplomat_worker/api/schemas.py worker/diplomat_worker/api/app.py worker/tests/api/test_app.py
git commit -m "feat(worker): expose subtitle export validation route"
```

---

### Task 5: Web API Helpers, Queries, And Style Utilities

**Files:**
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/tests/api.test.ts`
- Modify: `apps/web/src/queries/queryKeys.ts`
- Modify: `apps/web/src/queries/exportQueries.ts`
- Create: `apps/web/src/queries/stylePresetQueries.ts`
- Create: `apps/web/src/lib/subtitleStyles.ts`
- Create: `apps/web/src/lib/subtitleStyles.test.ts`

- [ ] **Step 1: Write failing web helper tests**

Add to `apps/web/tests/api.test.ts`:

```ts
it("exportSubtitles posts a general export request and parses warnings", async () => {
  const response = {
    projectId: "project-1",
    exportPath: "D:/Diplomat/projects/project-1/exports/subtitle-bilingual.ass",
    format: "ass",
    mode: "bilingual",
    warnings: []
  };
  fetchMock.mockResolvedValueOnce(jsonResponse(response));

  await expect(
    exportSubtitles("project-1", { format: "ass", mode: "bilingual" }, baseUrl)
  ).resolves.toEqual(response);

  expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/exports/subtitles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      format: "ass",
      mode: "bilingual",
      stylePresetId: null,
      style: null
    })
  });
});

it("style preset helpers use project style preset routes", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ projectId: "project-1", activePresetId: null, presets: [] }))
    .mockResolvedValueOnce(jsonResponse(stylePresetFixture));

  await listStylePresets("project-1", baseUrl);
  await createStylePreset("project-1", { name: "Broadcast", style: styleFixture }, baseUrl);

  expect(fetchMock).toHaveBeenNthCalledWith(1, `${baseUrl}/projects/project-1/style-presets`, undefined);
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    `${baseUrl}/projects/project-1/style-presets`,
    expect.objectContaining({ method: "POST" })
  );
});
```

Create `apps/web/src/lib/subtitleStyles.test.ts`:

```ts
import { previewStyleToCss, subtitleStyleWithDefaults } from "./subtitleStyles";

it("normalizes missing visual fields for existing documents", () => {
  const style = subtitleStyleWithDefaults({
    id: "default",
    name: "Default",
    fontFamily: "Arial",
    fontSize: 42,
    primaryColor: "#ffffff",
    secondaryColor: "#14b8a6",
    strokeWidth: 2,
    shadow: 1,
    position: "bottom",
    marginV: 48,
    alignment: "center",
    bilingualLayout: "source_top",
    lineSpacing: 1.1
  });

  expect(style.backgroundBar).toBe(false);
  expect(style.safeAreaMargin).toBe(32);
});

it("maps subtitle style to preview css", () => {
  const css = previewStyleToCss(subtitleStyleWithDefaults(styleFixture));

  expect(css.color).toBe(styleFixture.primaryColor);
  expect(css.fontFamily).toContain("Arial");
});
```

- [ ] **Step 2: Run tests and verify failure**

```powershell
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/lib/subtitleStyles.test.ts
```

Expected: fails because helpers and style utilities do not exist.

- [ ] **Step 3: Implement helpers, queries, and style utilities**

In `apps/web/src/api.ts`, import new schemas and add:

- `exportSubtitles(projectId, input, baseUrl)`.
- `listStylePresets(projectId, baseUrl)`.
- `createStylePreset(projectId, input, baseUrl)`.
- `updateStylePreset(projectId, presetId, input, baseUrl)`.
- `deleteStylePreset(projectId, presetId, baseUrl)`.
- `applyStylePreset(projectId, presetId, baseUrl)`.

In `apps/web/src/queries/exportQueries.ts`, add:

```ts
export function useSubtitleExportMutation(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubtitleExportRequest) => {
      if (!projectId) {
        throw new Error("Project id is required to export subtitles.");
      }
      return exportSubtitles(projectId, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}
```

Keep `useExportSrtMutation` for older tests and settings paths.

Create `stylePresetQueries.ts` hooks for list/create/update/delete/apply and invalidate `queryKeys.stylePresets(projectId)`, `queryKeys.subtitle(projectId)`, and `queryKeys.projects`.

Create `subtitleStyles.ts` with:

- `defaultSubtitleStyle`.
- `subtitleStyleWithDefaults(style)`.
- `previewStyleToCss(style)`.
- `safeAreaStyle(style)`.
- `hasBlockingTimingIssues(validation)`.
- `timingIssueSummary(validation)`.

- [ ] **Step 4: Run tests and commit**

```powershell
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/lib/subtitleStyles.test.ts
corepack pnpm --dir apps/web typecheck
git add apps/web/src/api.ts apps/web/tests/api.test.ts apps/web/src/queries/queryKeys.ts apps/web/src/queries/exportQueries.ts apps/web/src/queries/stylePresetQueries.ts apps/web/src/lib/subtitleStyles.ts apps/web/src/lib/subtitleStyles.test.ts
git commit -m "feat(web): add subtitle export and style preset helpers"
```

---

### Task 6: Export Inspector And Preview UI

**Files:**
- Modify: `apps/web/src/components/VideoPreviewPanel.tsx`
- Create: `apps/web/src/components/VideoPreviewPanel.test.tsx`
- Modify: `apps/web/src/components/inspectors/ExportInspector.tsx`
- Modify: `apps/web/src/components/inspectors/ExportInspector.test.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`

- [ ] **Step 1: Write failing component tests**

Create `apps/web/src/components/VideoPreviewPanel.test.tsx`:

```tsx
it("renders styled subtitle preview and safe area overlay", () => {
  render(
    <VideoPreviewPanel
      mediaUrl="http://worker/media.mp4"
      selectedLine={lineFixture}
      previewStyle={styleFixture}
      showSafeArea
    />
  );

  expect(screen.getByText(lineFixture.sourceText)).toHaveStyle({ color: styleFixture.primaryColor });
  expect(screen.getByTestId("subtitle-safe-area")).toBeInTheDocument();
});
```

Extend `ExportInspector.test.tsx`:

```tsx
it("changes format, edits style, and exports when validation has warnings only", async () => {
  const user = userEvent.setup();
  const onFormatChange = vi.fn();
  const onStyleChange = vi.fn();
  const onExport = vi.fn();

  render(
    <ExportInspector
      format="srt"
      mode="bilingual"
      result={null}
      canExport
      disabledReason={null}
      busy={false}
      validationIssues={[{ lineId: "line-1", code: "too_short", severity: "warning", message: "Short cue" }]}
      style={styleFixture}
      presets={[]}
      activePresetId={null}
      presetBusy={false}
      onFormatChange={onFormatChange}
      onModeChange={vi.fn()}
      onStyleChange={onStyleChange}
      onExport={onExport}
      onCreatePreset={vi.fn()}
      onUpdatePreset={vi.fn()}
      onRenamePreset={vi.fn()}
      onDeletePreset={vi.fn()}
      onApplyPreset={vi.fn()}
    />
  );

  await user.selectOptions(screen.getByLabelText("Format"), "ass");
  await user.clear(screen.getByLabelText("Font size"));
  await user.type(screen.getByLabelText("Font size"), "48");
  await user.click(screen.getByRole("button", { name: "Export" }));

  expect(onFormatChange).toHaveBeenCalledWith("ass");
  expect(onStyleChange).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 48 }));
  expect(onExport).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run component tests and verify failure**

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/VideoPreviewPanel.test.tsx src/components/inspectors/ExportInspector.test.tsx
```

Expected: fails because preview props and expanded export inspector do not exist.

- [ ] **Step 3: Implement preview and export inspector**

`VideoPreviewPanel` requirements:

- Accept `previewStyle?: SubtitleStyle | null`.
- Accept `showSafeArea?: boolean`.
- Apply font family, font size, primary/secondary colors, outline, shadow, background bar, alignment, vertical margin, line spacing, and bilingual layout.
- Render `data-testid="subtitle-safe-area"` when `showSafeArea` is true.
- Keep video controls accessible and overlay pointer events disabled.

`ExportInspector` requirements:

- Accept `format`, `mode`, `style`, `presets`, `activePresetId`, `validationIssues`, and preset callbacks.
- Select format among `srt`, `vtt`, and `ass`.
- Select mode among `source`, `target`, and `bilingual`.
- Render compact style controls with labels.
- Render preset select and save/update/rename/delete/apply controls.
- Show blocking errors in red and warnings in amber.
- Disable export when `busy || !canExport`.
- Show export result with format-specific copy.

Add i18n keys:

- `fields.exportFormat`
- `exportFormats.srt`
- `exportFormats.vtt`
- `exportFormats.ass`
- `styleEditor.*`
- `stylePresets.*`
- `validation.*`
- update `inspector.exportResult` to include format.

- [ ] **Step 4: Run component tests and commit**

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/VideoPreviewPanel.test.tsx src/components/inspectors/ExportInspector.test.tsx
corepack pnpm --dir apps/web typecheck
git add apps/web/src/components/VideoPreviewPanel.tsx apps/web/src/components/VideoPreviewPanel.test.tsx apps/web/src/components/inspectors/ExportInspector.tsx apps/web/src/components/inspectors/ExportInspector.test.tsx apps/web/src/i18n/en.ts apps/web/src/i18n/zh.ts
git commit -m "feat(web): add export style editor and preview"
```

---

### Task 7: Workbench Export Integration

**Files:**
- Modify: `apps/web/src/pages/WorkbenchPage.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.test.tsx`
- Modify: `apps/web/e2e/fixtures.ts`
- Modify: `apps/web/e2e/workbench.spec.ts`

- [ ] **Step 1: Write failing Workbench tests**

Add tests:

```tsx
it("exports subtitles through the general export route with selected format and style", async () => {
  const user = userEvent.setup();
  renderWorkbench();

  await openProject(user);
  await user.click(screen.getByRole("button", { name: "Export" }));
  await user.selectOptions(screen.getByLabelText("Format"), "ass");
  await user.click(within(screen.getByTestId("inspector-body")).getByRole("button", { name: "Export" }));

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringMatching(/\/projects\/project-demo\/exports\/subtitles$/),
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"format":"ass"')
    })
  );
});

it("blocks export when timing validation has errors", async () => {
  const user = userEvent.setup();
  renderWorkbench({ document: documentWithOverlap });

  await openProject(user);
  await user.click(screen.getByRole("button", { name: "Export" }));

  expect(screen.getByText("Fix timing errors before exporting.")).toBeInTheDocument();
  expect(within(screen.getByTestId("inspector-body")).getByRole("button", { name: "Export" })).toBeDisabled();
});

it("applies a style preset and updates preview", async () => {
  const user = userEvent.setup();
  renderWorkbench({ stylePresets: presetListFixture });

  await openProject(user);
  await user.click(screen.getByRole("button", { name: "Export" }));
  await user.selectOptions(screen.getByLabelText("Style preset"), "preset-broadcast");
  await user.click(screen.getByRole("button", { name: "Apply preset" }));

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringMatching(/\/style-presets\/preset-broadcast\/apply$/),
    expect.objectContaining({ method: "POST" })
  );
});
```

- [ ] **Step 2: Run Workbench tests and verify failure**

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/WorkbenchPage.test.tsx
```

Expected: fails because Workbench still uses `useExportSrtMutation` and does not wire style presets.

- [ ] **Step 3: Implement Workbench integration**

Implementation requirements:

- Replace primary export mutation with `useSubtitleExportMutation`.
- Keep `useExportSrtMutation` only where legacy tests or settings still require it.
- Add state:
  - `exportFormat`.
  - `exportMode`.
  - `styleDraft`.
  - `showSafeArea`.
  - `activePresetId`.
  - `exportResult`.
- Query style presets when a project is active.
- Initialize `styleDraft` from active preset style, first subtitle document style, or default style.
- Pass `styleDraft` and `showSafeArea` to `VideoPreviewPanel`.
- Compute `hasBlockingTimingIssues` from `timingValidation.issues`.
- Extend `canExport` to require no timing errors.
- Keep unresolved local/server drafts blocking export.
- Send `{ format, mode, stylePresetId: activePresetId, style: styleDraft }` to `exportSubtitles`.
- Wire preset callbacks to create/update/rename/delete/apply mutations.
- After applying a preset, refetch subtitle document and style preset list.
- Update e2e fixtures for `/exports/subtitles` and `/style-presets`.

- [ ] **Step 4: Run focused web tests and commit**

```powershell
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/lib/subtitleStyles.test.ts src/components/VideoPreviewPanel.test.tsx src/components/inspectors/ExportInspector.test.tsx src/pages/WorkbenchPage.test.tsx
corepack pnpm --dir apps/web typecheck
git add apps/web/src/pages/WorkbenchPage.tsx apps/web/src/pages/WorkbenchPage.test.tsx apps/web/e2e/fixtures.ts apps/web/e2e/workbench.spec.ts
git commit -m "feat(web): integrate subtitle export styles"
```

---

### Task 8: Stage Verification And Review

**Files:**
- Create: `docs/development/0-28-stage-gate-review.md`

- [ ] **Step 1: Run focused verification**

```powershell
corepack pnpm --dir packages/shared test
python -m pytest worker/tests/export/test_text_subtitles.py worker/tests/export/test_srt.py worker/tests/storage/test_project_store.py worker/tests/api/test_app.py -q
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/lib/subtitleStyles.test.ts src/components/VideoPreviewPanel.test.tsx src/components/inspectors/ExportInspector.test.tsx src/pages/WorkbenchPage.test.tsx
corepack pnpm --dir apps/web typecheck
```

- [ ] **Step 2: Run full verification**

```powershell
.\scripts\check.ps1
```

- [ ] **Step 3: Run Browser smoke**

Manual smoke:

1. Start Worker on `127.0.0.1:8765` with isolated `DIPLOMAT_DATA_DIR`.
2. Start Web app on `127.0.0.1:1420`.
3. Seed a project with stable source and translated subtitle text.
4. Open the project in the in-app Browser.
5. Open the Export inspector.
6. Export SRT in bilingual mode.
7. Export VTT in target mode and confirm the output file starts with `WEBVTT`.
8. Export ASS in bilingual mode and confirm the output file contains `[Events]`.
9. Change style fields and confirm the preview overlay changes.
10. Toggle safe-area overlay and confirm it appears.
11. Save, rename, apply, update, and delete a style preset.
12. Reopen the project and confirm presets persist.
13. Introduce an overlap and confirm export is blocked.
14. Introduce a short cue warning and confirm export is allowed with a warning.
15. Confirm browser console error log count is 0.

- [ ] **Step 4: Write stage gate review**

Document:

- commits reviewed.
- focused verification results.
- full verification results.
- Browser smoke result.
- export files inspected.
- known limitations around OS font availability and SRT/VTT styling limits.

- [ ] **Step 5: Commit stage gate**

```powershell
git add docs/development/0-28-stage-gate-review.md
git commit -m "docs: accept 0.28 stage gate"
```

---

## Self-Review

- Spec coverage: the plan covers SRT hardening, VTT, ASS, source/target/bilingual modes, visual style editor, live preview, safe-area overlay, style preset CRUD/apply, and export validation.
- Placeholder scan: no task contains placeholder markers or unspecified tests; each task has concrete files, test commands, and implementation requirements.
- Type consistency: shared `SubtitleExport*`, Worker `SubtitleExport*`, Web API helpers, and Workbench state use the same format/mode/style naming.
