export function getErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }
  return error instanceof Error ? error.message : null;
}

export function displayRuntimeMessage(message: string) {
  return message
    .replaceAll("Diplomat Worker", "Diplomat local runtime")
    .replaceAll("Worker runtime", "local runtime")
    .replaceAll("Worker process", "Local runtime process")
    .replaceAll("Worker", "local runtime");
}

export function isTechnicalRuntimeErrorMessage(message: string) {
  return (
    message.startsWith("Local runtime request failed:") ||
    message.startsWith("Local runtime is not reachable") ||
    /127\.0\.0\.1|localhost|connection timed out|stack trace/i.test(message)
  );
}

export function displayRuntimeErrorMessage(error: unknown, fallback: string) {
  const message = getErrorMessage(error);
  if (!message) {
    return null;
  }
  return isTechnicalRuntimeErrorMessage(message) ? fallback : displayRuntimeMessage(message);
}
