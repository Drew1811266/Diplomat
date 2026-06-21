import type { TFunction } from "i18next";

const commonTaskMessageKeys: Record<string, string> = {
  "Analysis canceled": "tasks.messages.analysisCanceled",
  "Analysis completed": "tasks.messages.analysisCompleted",
  "Analysis queued": "tasks.messages.analysisQueued",
  "Burn-in export completed": "tasks.messages.burnInExportCompleted",
  "Model is not installed": "tasks.messages.modelNotInstalled",
  "Model is not installed.": "tasks.messages.modelNotInstalled",
  "Model download queued.": "tasks.messages.modelDownloadQueued",
  "Queued burn-in export": "tasks.messages.queuedBurnInExport",
  "Task completed": "tasks.messages.taskCompleted",
  "Transcribing audio": "tasks.messages.transcribingAudio",
  "Translation completed": "tasks.messages.translationCompleted",
  "Waveform queued": "tasks.messages.waveformQueued",
  "Install the translation model before retrying.":
    "tasks.messages.installTranslationModelBeforeRetrying"
};

export function sanitizeTaskMessage(message: string) {
  return message
    .replaceAll("Worker runtime", "local runtime")
    .replaceAll("Worker", "local runtime")
    .trim();
}

export function displayTaskMessage(message: string, t: TFunction) {
  const sanitizedMessage = sanitizeTaskMessage(message);
  const messageKey = commonTaskMessageKeys[sanitizedMessage];
  return messageKey ? t(messageKey) : sanitizedMessage;
}
