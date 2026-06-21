export type EditorHistory<T> = {
  past: T[];
  present: T;
  future: T[];
  mergeKey?: string | null;
};

type UpdateEditorHistoryOptions = {
  mergeKey?: string | null;
  limit?: number;
};

const defaultHistoryLimit = 100;

export function updateEditorHistory<T>(
  history: EditorHistory<T>,
  nextPresent: T,
  options: UpdateEditorHistoryOptions = {}
): EditorHistory<T> {
  if (nextPresent === history.present) {
    return history;
  }

  const mergeKey = options.mergeKey ?? null;
  const limit = options.limit ?? defaultHistoryLimit;
  const shouldMerge = Boolean(mergeKey && mergeKey === history.mergeKey && history.past.length);
  const past = shouldMerge
    ? history.past
    : [...history.past, history.present].slice(Math.max(0, history.past.length + 1 - limit));

  return {
    past,
    present: nextPresent,
    future: [],
    mergeKey
  };
}

export function undoEditorHistory<T>(history: EditorHistory<T>): EditorHistory<T> {
  const previous = history.past.at(-1);
  if (!previous) {
    return history;
  }

  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    mergeKey: null
  };
}

export function redoEditorHistory<T>(history: EditorHistory<T>): EditorHistory<T> {
  const next = history.future[0];
  if (!next) {
    return history;
  }

  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
    mergeKey: null
  };
}
