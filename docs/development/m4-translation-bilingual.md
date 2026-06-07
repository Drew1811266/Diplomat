# M4 Translation And Bilingual Subtitles

M4 adds project-level subtitle translation on top of the M3 local ASR workflow. The Worker owns translation provider execution and mutates the saved subtitle document; the Web workbench provides controls for provider settings, translation jobs, line review, edited translated text, and bilingual SRT export.

## Included

- Translation metadata on each subtitle line:
  - `translationStatus`
  - `translationOrigin`
  - `translationError`
- Translation settings stored per project.
- Background Worker translation jobs with progress, cancellation, and retry.
- Deterministic `fake` translation provider for tests and offline demos.
- Optional LibreTranslate HTTP provider.
- Web workbench controls for provider, source language, target language, mode, endpoint, and API key environment variable.
- Source, target, and bilingual SRT export coverage after translation.

## Not Included

- Cloud-hosted translation services.
- Committed model weights, service tokens, or API keys.
- Automatic language detection.
- Segment re-timing or subtitle splitting during translation.
- Burned-in video export. That remains planned for a later milestone.

## Providers And Privacy

The default provider is `fake`. It is deterministic and local: it returns text in the form `[targetLanguage] sourceText`. This gives the app a fully testable translation workflow without network access or paid services.

LibreTranslate is optional. The Worker sends subtitle line text to the configured LibreTranslate endpoint. If that endpoint is remote, text leaves the local machine. Use a local LibreTranslate server when privacy matters.

No API keys are stored in subtitle documents. The optional `apiKeyEnv` setting stores only the environment variable name; the Worker reads the value from its process environment at runtime.

## LibreTranslate Setup

1. Run or choose a LibreTranslate-compatible endpoint.
2. In the Web Translation panel, select `libretranslate`.
3. Set `LibreTranslate endpoint`, for example `http://127.0.0.1:5000`.
4. If needed, set `API key env` to an environment variable name such as `LIBRETRANSLATE_API_KEY`.
5. Start Translation.

The Worker also supports `DIPLOMAT_LIBRETRANSLATE_ENDPOINT` as a fallback endpoint when the request does not include an endpoint.

## Web Development Worker URL

The Web app defaults to `http://127.0.0.1:8765` for Worker API calls. When another local service already uses that port, start the Worker on another port and set both the Worker CORS origin and the Web API base URL:

```powershell
$env:DIPLOMAT_CORS_ORIGINS = "http://127.0.0.1:1421"
python -m uvicorn diplomat_worker.api.app:app --host 127.0.0.1 --port 8767
```

In a second terminal:

```powershell
$env:VITE_DIPLOMAT_WORKER_BASE_URL = "http://127.0.0.1:8767"
corepack pnpm --dir apps/web exec vite --host 127.0.0.1 --port 1421 --strictPort
```

This setting affects browser-side API helpers only. The Worker still listens on the host and port used to start Uvicorn.

## Worker API

Fetch project translation settings:

```powershell
Invoke-RestMethod -Method GET `
  -Uri "http://127.0.0.1:8765/projects/<projectId>/translation-settings"
```

Save settings:

```powershell
Invoke-RestMethod -Method PUT `
  -Uri "http://127.0.0.1:8765/projects/<projectId>/translation-settings" `
  -ContentType "application/json" `
  -Body '{
    "provider": "fake",
    "sourceLanguage": "zh",
    "targetLanguage": "en",
    "mode": "missing_only",
    "endpoint": null,
    "apiKeyEnv": null
  }'
```

Start a translation job:

```powershell
Invoke-RestMethod -Method POST `
  -Uri "http://127.0.0.1:8765/projects/<projectId>/translation-jobs" `
  -ContentType "application/json" `
  -Body '{
    "provider": "fake",
    "sourceLanguage": "zh",
    "targetLanguage": "en",
    "mode": "missing_only"
  }'
```

Poll, cancel, and retry use the shared task endpoints:

```powershell
Invoke-RestMethod -Method GET  -Uri "http://127.0.0.1:8765/tasks/<taskId>"
Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:8765/tasks/<taskId>/cancel"
Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:8765/tasks/<taskId>/retry"
```

## Web Workflow

1. Create or reopen a project with a subtitle document.
2. Confirm the Translation panel source and target languages.
3. Choose `fake` or `libretranslate`.
4. Choose translation mode:
   - `missing_only`: translate empty, not requested, or failed target lines.
   - `overwrite_all`: replace all translated lines that have source text.
5. Start Translation.
6. Review generated target text in the line editor.
7. Edit target text manually as needed. Edited lines are marked `edited`.
8. Save subtitles.
9. Export source, target, or bilingual SRT.

## Manual M4 Test

Use the fake provider first because it does not require external services:

1. Start the Worker and Web app from the M4 branch.
2. Reopen a project with source subtitles.
3. Start fake translation.
4. Confirm translated text appears as `[en] <source text>` or `[zh] <source text>`.
5. Edit one translated line and save.
6. Reopen the project and confirm the edited text persists.
7. Export bilingual SRT and confirm the file contains source and target lines.
8. Select LibreTranslate with an invalid endpoint and confirm the task fails.
9. Switch back to the fake provider, click Retry, and confirm recovery.

## Known Limitations

- The fake provider is not a linguistic translator.
- LibreTranslate quality and latency depend on the configured server.
- Raw task API retry without a replacement body reuses the failed task payload; the Web Retry button submits the current panel configuration.
- The UI does not yet provide batch conflict review for overwritten translations.
- Burned-in subtitle video export is not part of M4.
