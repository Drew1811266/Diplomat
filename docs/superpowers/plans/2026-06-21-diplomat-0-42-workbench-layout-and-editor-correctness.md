# Diplomat 0.42 Workbench Layout and Editor Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 0.41 workbench issues that still block a mature desktop subtitle editing workflow: right-side subtitle table layout, active playback subtitles, timeline drag math, and language-aware subtitle editing.

**Architecture:** Keep the current three-zone workbench: video preview on the left, tabbed project controls on the right, timeline at the bottom. Make focused changes in existing components first, introducing small pure helper modules only for active subtitle lookup and timeline coordinate conversion.

**Tech Stack:** React, TypeScript, Mantine, Zustand, Vitest, Tauri web frontend.

---

## File Structure

- `docs/development/0-42-workbench-layout-and-editor-correctness.md`: product and technical spec for this stage.
- `apps/web/src/state/uiStore.ts`: widen right inspector defaults and bounds.
- `apps/web/src/state/uiStore.test.ts`: update layout persistence and clamp expectations.
- `apps/web/src/components/SubtitleGrid.tsx`: compact subtitle table with user-facing sequence IDs.
- `apps/web/src/components/SubtitleGrid.test.tsx`: verify column order, compact IDs, and active/selected rows.
- `apps/web/src/editor/playback/activeSubtitle.ts`: pure active subtitle lookup.
- `apps/web/src/editor/playback/activeSubtitle.test.ts`: boundary tests for active subtitle lookup.
- `apps/web/src/components/VideoPreviewPanel.tsx`: accept `activeLine`, `selectedLine`, and `playing`-aware preview rule.
- `apps/web/src/components/VideoPreviewPanel.test.tsx`: verify playback and pause preview behavior.
- `apps/web/src/pages/WorkbenchPage.tsx`: compute active line through helper and pass the correct preview line.
- `apps/web/src/editor/timeline/TimelineClock.ts`: central minimal timeline conversion helper.
- `apps/web/src/editor/timeline/TimelineClock.test.ts`: conversion and drag delta tests.
- `apps/web/src/components/TimelineEditor.tsx`: use `TimelineClock` for seek and drag delta.
- `apps/web/src/components/TimelineEditor.test.tsx`: verify zoomed drag math.
- `apps/web/src/lib/subtitleEditing.ts`: language-aware split and join helpers.
- `apps/web/src/lib/subtitleEditing.test.ts`: Chinese and English split/merge tests.

---

## Task 1: Widen Right Inspector and Compact Subtitle Table

**Files:**
- Modify: `apps/web/src/state/uiStore.ts`
- Modify: `apps/web/src/state/uiStore.test.ts`
- Modify: `apps/web/src/components/SubtitleGrid.tsx`
- Modify: `apps/web/src/components/SubtitleGrid.test.tsx`

- [ ] **Step 1: Update failing expectations for the new inspector width**

In `apps/web/src/state/uiStore.test.ts`, replace expectations that assume the default inspector width is `336` with `420`, and update the clamp upper bound case to expect `560`.

Run:

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/state/uiStore.test.ts --reporter=dot
```

Expected: FAIL until `uiStore.ts` is updated.

- [ ] **Step 2: Implement inspector width defaults**

In `apps/web/src/state/uiStore.ts`, change:

```ts
export const defaultWorkspaceLayout: WorkspaceLayout = {
  inspectorWidth: 336,
  bottomDockHeight: 210,
  inspectorCollapsed: false,
  bottomCollapsed: false
};
```

to:

```ts
export const defaultWorkspaceLayout: WorkspaceLayout = {
  inspectorWidth: 420,
  bottomDockHeight: 240,
  inspectorCollapsed: false,
  bottomCollapsed: false
};
```

Change inspector bounds from:

```ts
inspectorWidth: {
  min: 280,
  max: 480
}
```

to:

```ts
inspectorWidth: {
  min: 360,
  max: 560
}
```

- [ ] **Step 3: Add SubtitleGrid layout tests**

In `apps/web/src/components/SubtitleGrid.test.tsx`, add assertions that:

```tsx
expect(screen.getByRole("columnheader", { name: /ID|编号/ })).toBeVisible();
expect(screen.getByRole("columnheader", { name: /Source|原文/ })).toBeVisible();
expect(screen.getByRole("columnheader", { name: /Translation|译文/ })).toBeVisible();
expect(screen.getByRole("columnheader", { name: /Start|开始/ })).toBeVisible();
expect(screen.getByRole("columnheader", { name: /End|结束/ })).toBeVisible();
expect(screen.queryByRole("columnheader", { name: /Review|审阅|审核/ })).not.toBeInTheDocument();
expect(screen.queryByRole("columnheader", { name: /Status|状态/ })).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: /select subtitle 1|选择字幕 1/i })).toHaveTextContent("1");
expect(screen.queryByText("line-1")).not.toBeInTheDocument();
```

Run:

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/components/SubtitleGrid.test.tsx --reporter=dot
```

Expected: FAIL until `SubtitleGrid.tsx` is updated.

- [ ] **Step 4: Implement compact SubtitleGrid**

In `apps/web/src/components/SubtitleGrid.tsx`:

1. Build global display numbers before filtering:

```ts
const displayIndexByLineId = useMemo(
  () => new Map(lines.map((line, index) => [line.id, index + 1])),
  [lines]
);
```

2. Reduce table min width:

```tsx
style={{ minWidth: 620, tableLayout: "fixed" }}
```

3. Change table headers to:

```tsx
<Table.Th w={44}>{t("subtitleGrid.columns.id")}</Table.Th>
<Table.Th>{t("subtitleGrid.columns.source")}</Table.Th>
<Table.Th>{t("subtitleGrid.columns.translation")}</Table.Th>
<Table.Th w={82}>{t("subtitleGrid.columns.start")}</Table.Th>
<Table.Th w={82}>{t("subtitleGrid.columns.end")}</Table.Th>
```

4. Change row `colSpan` values from `7` to `5`.

5. Render the ID button with the display number:

```tsx
const displayIndex = displayIndexByLineId.get(line.id) ?? 0;
```

```tsx
<Button
  type="button"
  size="compact-xs"
  variant="subtle"
  color={selected ? "teal" : "gray"}
  aria-label={t("subtitleGrid.selectLine", { id: displayIndex })}
  onClick={(event) => {
    event.stopPropagation();
    onSelectLine(line.id);
  }}
>
  {displayIndex}
</Button>
```

6. Move review, translation status, timing issue, and quality issue badges into the source/translation cells as compact inline badges.

- [ ] **Step 5: Verify Task 1**

Run:

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/state/uiStore.test.ts src/components/SubtitleGrid.test.tsx --reporter=dot
```

Expected: PASS.

---

## Task 2: Separate Active Playback Subtitle from Selected Subtitle

**Files:**
- Create: `apps/web/src/editor/playback/activeSubtitle.ts`
- Create: `apps/web/src/editor/playback/activeSubtitle.test.ts`
- Modify: `apps/web/src/components/VideoPreviewPanel.tsx`
- Modify: `apps/web/src/components/VideoPreviewPanel.test.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.tsx`

- [ ] **Step 1: Add active subtitle lookup tests**

Create `apps/web/src/editor/playback/activeSubtitle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SubtitleLine } from "@diplomat/shared";
import { findActiveSubtitle } from "./activeSubtitle";

const line = (id: string, startMs: number, endMs: number): SubtitleLine => ({
  id,
  startMs,
  endMs,
  sourceText: id,
  translatedText: "",
  words: [],
  speaker: null,
  confidence: null,
  translationStatus: "not_requested",
  translationOrigin: null,
  translationError: null,
  reviewStatus: "draft",
  notes: "",
  translationQualityIssues: []
});

describe("findActiveSubtitle", () => {
  const lines = [line("line-1", 0, 1000), line("line-2", 1200, 2000)];

  it("returns the line containing the time", () => {
    expect(findActiveSubtitle(lines, 500)?.id).toBe("line-1");
  });

  it("includes the start boundary and excludes the end boundary", () => {
    expect(findActiveSubtitle(lines, 0)?.id).toBe("line-1");
    expect(findActiveSubtitle(lines, 1000)).toBeNull();
  });

  it("returns null during gaps", () => {
    expect(findActiveSubtitle(lines, 1100)).toBeNull();
  });

  it("returns the shortest matching line for overlaps", () => {
    const overlapping = [line("wide", 0, 3000), line("narrow", 1000, 1500)];
    expect(findActiveSubtitle(overlapping, 1250)?.id).toBe("narrow");
  });
});
```

Run:

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/editor/playback/activeSubtitle.test.ts --reporter=dot
```

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement activeSubtitle helper**

Create `apps/web/src/editor/playback/activeSubtitle.ts`:

```ts
import type { SubtitleLine } from "@diplomat/shared";

export function findActiveSubtitle(lines: SubtitleLine[], timeMs: number): SubtitleLine | null {
  let match: SubtitleLine | null = null;
  for (const line of lines) {
    if (timeMs < line.startMs || timeMs >= line.endMs) {
      continue;
    }
    if (!match || line.endMs - line.startMs < match.endMs - match.startMs) {
      match = line;
    }
  }
  return match;
}
```

This linear implementation is acceptable for 0.42 correctness. A binary-indexed version can replace it in the later playback architecture phase.

- [ ] **Step 3: Update VideoPreviewPanel tests**

In `apps/web/src/components/VideoPreviewPanel.test.tsx`, add a case:

```tsx
it("shows the active line while playing and selected line while paused", () => {
  const selectedLine = makeLine("selected", "Selected source", "Selected target");
  const activeLine = makeLine("active", "Active source", "Active target");

  const { rerender } = render(
    <VideoPreviewPanel
      mediaUrl="video.mp4"
      selectedLine={selectedLine}
      activeLine={activeLine}
      playing={true}
    />
  );

  expect(screen.getByText("Active source")).toBeInTheDocument();
  expect(screen.queryByText("Selected source")).not.toBeInTheDocument();

  rerender(
    <VideoPreviewPanel
      mediaUrl="video.mp4"
      selectedLine={selectedLine}
      activeLine={activeLine}
      playing={false}
    />
  );

  expect(screen.getByText("Selected source")).toBeInTheDocument();
});
```

Run:

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/components/VideoPreviewPanel.test.tsx --reporter=dot
```

Expected: FAIL until component props and display logic are updated.

- [ ] **Step 4: Implement preview display rule**

In `VideoPreviewPanel.tsx`, add props:

```ts
activeLine?: SubtitleLine | null;
playing?: boolean;
```

Resolve the displayed line:

```ts
const previewLine = playing ? activeLine ?? null : selectedLine ?? activeLine ?? null;
```

Replace every `selectedLine?.sourceText` and `selectedLine?.translatedText` used for overlay text with `previewLine?.sourceText` and `previewLine?.translatedText`. Replace the overlay condition from `selectedLine ?` to `previewLine ?`.

- [ ] **Step 5: Wire WorkbenchPage**

In `WorkbenchPage.tsx`:

1. Import `findActiveSubtitle`.
2. Replace the current active-line lookup with:

```ts
const activeLine = useMemo(
  () => findActiveSubtitle(subtitleLines, currentTimeMs),
  [currentTimeMs, subtitleLines]
);
const activeLineId = activeLine?.id ?? null;
```

3. Track whether preview video is playing through `VideoPreviewPanel` callback or a prop surfaced by the component. If the current implementation keeps playing local to `VideoPreviewPanel`, first pass `activeLine` and let `VideoPreviewPanel` use its local `playing` state as fallback.

4. Pass:

```tsx
selectedLine={selectedLine}
activeLine={activeLine}
```

- [ ] **Step 6: Verify Task 2**

Run:

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/editor/playback/activeSubtitle.test.ts src/components/VideoPreviewPanel.test.tsx --reporter=dot
```

Expected: PASS.

---

## Task 3: Add Minimal TimelineClock and Fix Drag Delta

**Files:**
- Create: `apps/web/src/editor/timeline/TimelineClock.ts`
- Create: `apps/web/src/editor/timeline/TimelineClock.test.ts`
- Modify: `apps/web/src/components/TimelineEditor.tsx`
- Modify: `apps/web/src/components/TimelineEditor.test.tsx`

- [ ] **Step 1: Add TimelineClock tests**

Create `apps/web/src/editor/timeline/TimelineClock.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TimelineClock } from "./TimelineClock";

describe("TimelineClock", () => {
  it("converts between time and x using content width", () => {
    const clock = new TimelineClock({ durationMs: 10_000, contentWidthPx: 1_000 });
    expect(clock.timeToX(5_000)).toBe(500);
    expect(clock.xToTime(250)).toBe(2_500);
  });

  it("converts pixel deltas independently from viewport width", () => {
    const clock = new TimelineClock({ durationMs: 10_000, contentWidthPx: 2_000 });
    expect(clock.deltaPxToMs(100)).toBe(500);
  });

  it("clamps x positions to duration", () => {
    const clock = new TimelineClock({ durationMs: 10_000, contentWidthPx: 1_000 });
    expect(clock.xToTime(-50)).toBe(0);
    expect(clock.xToTime(1_500)).toBe(10_000);
  });
});
```

Run:

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/editor/timeline/TimelineClock.test.ts --reporter=dot
```

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement TimelineClock**

Create `apps/web/src/editor/timeline/TimelineClock.ts`:

```ts
type TimelineClockOptions = {
  durationMs: number;
  contentWidthPx: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export class TimelineClock {
  readonly durationMs: number;
  readonly contentWidthPx: number;
  readonly pixelsPerMs: number;

  constructor(options: TimelineClockOptions) {
    this.durationMs = Math.max(1, options.durationMs);
    this.contentWidthPx = Math.max(1, options.contentWidthPx);
    this.pixelsPerMs = this.contentWidthPx / this.durationMs;
  }

  timeToX(timeMs: number) {
    return clamp(timeMs, 0, this.durationMs) * this.pixelsPerMs;
  }

  xToTime(xPx: number) {
    return clamp(xPx / this.pixelsPerMs, 0, this.durationMs);
  }

  deltaPxToMs(deltaPx: number) {
    return deltaPx / this.pixelsPerMs;
  }
}
```

- [ ] **Step 3: Use TimelineClock in TimelineEditor**

In `TimelineEditor.tsx`:

1. Import `TimelineClock`.
2. Create the clock after `trackWidth`:

```ts
const timelineClock = useMemo(
  () => new TimelineClock({ durationMs: safeDurationMs, contentWidthPx: trackWidth }),
  [safeDurationMs, trackWidth]
);
```

3. In `timeFromClientX`, replace proportional conversion with:

```ts
const offset = clamp(clientX - rect.left + (element.scrollLeft ?? 0), 0, trackWidth);
return snap(timelineClock.xToTime(offset));
```

4. In `deltaFromClientX`, replace:

```ts
return snap((deltaPx / Math.max(1, rect.width)) * safeDurationMs);
```

with:

```ts
return snap(timelineClock.deltaPxToMs(deltaPx));
```

- [ ] **Step 4: Verify Task 3**

Run:

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/editor/timeline/TimelineClock.test.ts src/components/TimelineEditor.test.tsx --reporter=dot
```

Expected: PASS.

---

## Task 4: Language-Aware Split and Merge

**Files:**
- Modify: `apps/web/src/lib/subtitleEditing.ts`
- Modify: `apps/web/src/lib/subtitleEditing.test.ts`

- [ ] **Step 1: Add split and merge tests**

In `apps/web/src/lib/subtitleEditing.test.ts`, add tests:

```ts
it("splits Chinese text without requiring spaces", () => {
  const document = makeDocument([
    makeLine({
      id: "line-1",
      startMs: 0,
      endMs: 4000,
      sourceText: "这是第一句话这是第二句话",
      translatedText: "This is the first sentence. This is the second sentence."
    })
  ]);

  const next = splitSubtitleLine(document, "line-1", 2000);

  expect(next.lines).toHaveLength(2);
  expect(next.lines[0]!.sourceText).toBe("这是第一句话");
  expect(next.lines[1]!.sourceText).toBe("这是第二句话");
});

it("merges Chinese text without inserting English spaces", () => {
  const document = makeDocument([
    makeLine({ id: "line-1", sourceText: "你好", translatedText: "hello", startMs: 0, endMs: 1000 }),
    makeLine({ id: "line-2", sourceText: "世界", translatedText: "world", startMs: 1000, endMs: 2000 })
  ]);

  const next = mergeSubtitleLine(document, "line-1", "next");

  expect(next.lines[0]!.sourceText).toBe("你好世界");
  expect(next.lines[0]!.translatedText).toBe("hello world");
});
```

Run:

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/lib/subtitleEditing.test.ts --reporter=dot
```

Expected: FAIL until split and join helpers are updated.

- [ ] **Step 2: Implement language-aware helpers**

In `subtitleEditing.ts`, replace `splitText` with a helper that:

1. Keeps the current whitespace split for text containing whitespace-separated words.
2. Uses `Intl.Segmenter` with `granularity: "grapheme"` when there are no spaces.
3. Falls back to `Array.from(value.trim())`.

Replace `joinText` with logic:

```ts
function shouldJoinWithoutSpace(left: string, right: string) {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u.test(left.trim()) &&
    /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(right.trim());
}
```

If `shouldJoinWithoutSpace(left, right)` is true, concatenate directly. Otherwise join with one space.

- [ ] **Step 3: Verify Task 4**

Run:

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/lib/subtitleEditing.test.ts --reporter=dot
```

Expected: PASS.

---

## Task 5: Regression and Desktop Smoke Test

**Files:**
- Verify only.

- [ ] **Step 1: Run focused frontend tests**

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/state/uiStore.test.ts src/components/SubtitleGrid.test.tsx src/editor/playback/activeSubtitle.test.ts src/components/VideoPreviewPanel.test.tsx src/editor/timeline/TimelineClock.test.ts src/components/TimelineEditor.test.tsx src/lib/subtitleEditing.test.ts --reporter=dot
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\tsc.CMD' --noEmit
```

Expected: PASS.

- [ ] **Step 3: Launch current development desktop app**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-dev-desktop.ps1 --timeout-ms=120000
```

Expected:

- The desktop app launches from `D:\Software Project\Diplomat`.
- Local runtime is reachable.
- The UI uses the latest development code.
- Right inspector is wider.
- Subtitle tab table shows compact numeric IDs and source/translation-first columns.
- Preview subtitle follows playback time.
- Timeline drag remains functional after zoom.

## Self-Review

- Spec coverage: The plan covers the user override to keep subtitles in the right tab, plus active subtitle correctness, timeline delta correctness, and language-aware split/merge.
- Deferred scope: Command-based undo history, full PlaybackController, logical viewport virtualization, waveform V2, and proxy video are intentionally deferred after this first 0.42 slice.
- Placeholder scan: No TBD/TODO/fill-in instructions remain.
- Type consistency: New helpers are pure TypeScript modules and use existing `SubtitleLine` shape.
