import { describe, expect, it } from "vitest";
import {
  redoEditorHistory,
  undoEditorHistory,
  updateEditorHistory,
  type EditorHistory
} from "./EditorHistory";

function history(present: string): EditorHistory<string> {
  return {
    past: [],
    present,
    future: [],
    mergeKey: null
  };
}

describe("EditorHistory", () => {
  it("merges consecutive updates with the same merge key into one undo step", () => {
    const first = updateEditorHistory(history("original"), "draft-1", { mergeKey: "line:1" });
    const second = updateEditorHistory(first, "draft-2", { mergeKey: "line:1" });

    expect(second.past).toEqual(["original"]);
    expect(second.present).toBe("draft-2");

    const undone = undoEditorHistory(second);
    expect(undone.present).toBe("original");
  });

  it("starts a new undo step when the merge key changes", () => {
    const first = updateEditorHistory(history("original"), "line-1-edit", { mergeKey: "line:1" });
    const second = updateEditorHistory(first, "line-2-edit", { mergeKey: "line:2" });

    expect(second.past).toEqual(["original", "line-1-edit"]);
    expect(undoEditorHistory(second).present).toBe("line-1-edit");
  });

  it("caps past history at the configured limit", () => {
    let current = history("0");

    current = updateEditorHistory(current, "1", { limit: 2 });
    current = updateEditorHistory(current, "2", { limit: 2 });
    current = updateEditorHistory(current, "3", { limit: 2 });

    expect(current.past).toEqual(["1", "2"]);
    expect(current.present).toBe("3");
  });

  it("clears redo entries after a new edit", () => {
    const edited = updateEditorHistory(history("original"), "edited");
    const undone = undoEditorHistory(edited);
    const replaced = updateEditorHistory(undone, "replacement");

    expect(replaced.future).toEqual([]);
    expect(redoEditorHistory(replaced).present).toBe("replacement");
  });
});
