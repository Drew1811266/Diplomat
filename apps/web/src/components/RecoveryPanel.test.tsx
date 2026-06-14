import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SubtitleDraftResponse, SubtitleSnapshotSummary } from "@diplomat/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzedDocumentFixture } from "../test/fixtures";
import { renderWithProviders } from "../test/render";
import { RecoveryPanel } from "./RecoveryPanel";

const draft: SubtitleDraftResponse = {
  projectId: "project-demo",
  updatedAt: "2026-06-14T00:00:00+00:00",
  lineCount: analyzedDocumentFixture.lines.length,
  document: analyzedDocumentFixture
};

const snapshot: SubtitleSnapshotSummary = {
  snapshotId: "snapshot-20260614000000000000-abcd1234",
  projectId: "project-demo",
  reason: "manual",
  label: "Manual checkpoint",
  createdAt: "2026-06-14T00:00:00+00:00",
  lineCount: analyzedDocumentFixture.lines.length
};

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RecoveryPanel", () => {
  it("returns null when there is nothing to recover", () => {
    renderWithProviders(
      <RecoveryPanel
        draft={null}
        snapshots={[]}
        busy={false}
        onRestoreDraft={vi.fn()}
        onDiscardDraft={vi.fn()}
        onCreateSnapshot={vi.fn()}
        onRestoreSnapshot={vi.fn()}
      />
    );

    expect(screen.queryByRole("region", { name: "Recovery" })).not.toBeInTheDocument();
  });

  it("shows draft and snapshot recovery actions", () => {
    renderWithProviders(
      <RecoveryPanel
        draft={draft}
        snapshots={[snapshot]}
        busy={false}
        onRestoreDraft={vi.fn()}
        onDiscardDraft={vi.fn()}
        onCreateSnapshot={vi.fn()}
        onRestoreSnapshot={vi.fn()}
      />
    );

    expect(screen.getByRole("region", { name: "Recovery" })).toBeInTheDocument();
    expect(screen.getByText("Autosaved draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore draft" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Restore snapshot Manual checkpoint" })).toBeEnabled();
  });

  it("calls recovery handlers", async () => {
    const user = userEvent.setup();
    const onRestoreDraft = vi.fn();
    const onDiscardDraft = vi.fn();
    const onCreateSnapshot = vi.fn();
    const onRestoreSnapshot = vi.fn();

    renderWithProviders(
      <RecoveryPanel
        draft={draft}
        snapshots={[snapshot]}
        busy={false}
        onRestoreDraft={onRestoreDraft}
        onDiscardDraft={onDiscardDraft}
        onCreateSnapshot={onCreateSnapshot}
        onRestoreSnapshot={onRestoreSnapshot}
      />
    );

    await user.click(screen.getByRole("button", { name: "Restore draft" }));
    await user.click(screen.getByRole("button", { name: "Discard draft" }));
    await user.click(screen.getByRole("button", { name: "Create snapshot" }));
    await user.click(screen.getByRole("button", { name: "Restore snapshot Manual checkpoint" }));

    expect(onRestoreDraft).toHaveBeenCalledTimes(1);
    expect(onDiscardDraft).toHaveBeenCalledTimes(1);
    expect(onCreateSnapshot).toHaveBeenCalledTimes(1);
    expect(onRestoreSnapshot).toHaveBeenCalledWith(snapshot.snapshotId);
  });
});
