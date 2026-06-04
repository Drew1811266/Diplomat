# Diplomat AI Subtitle Editor Design

Date: 2026-06-04
Status: Approved design, pending implementation plan
License intent: Application source code under MIT License; AI model weights keep their own licenses and are downloaded by the user.

## Summary

Diplomat is a Windows-first, local-first desktop application for professional AI subtitle production. Users import a video, the app analyzes speech locally, generates editable transcript and translation subtitles, supports Chinese-English bilingual subtitle workflows, and exports subtitle files or a new video with subtitles burned in.

The first public version targets high-performance Windows PCs, especially NVIDIA GPU systems. It should handle long videos such as courses, podcasts, interviews, and lectures in the 1-3 hour range. It must be stable under long-running workloads by using chunked processing, task checkpoints, recoverable job state, and local caches.

The product is not a general-purpose video editor. It is a professional subtitle editor with AI-assisted transcription, translation, speaker diarization, waveform-assisted timing, subtitle styling, and export.

## Confirmed Product Decisions

- Product shape: Windows desktop application.
- Runtime strategy: local offline AI processing after first-time model download.
- Hardware target: high-performance Windows PCs, NVIDIA GPU preferred.
- Language scope: Chinese-English first, architecture prepared for more languages later.
- User segment: personal creators first; project and batch concepts should not block later studio workflows.
- Video duration: long videos must be usable, with 1-3 hour videos as an explicit design target.
- Model delivery: app binary stays smaller; models are downloaded on first use and cached locally.
- Open-source model: application code uses MIT License. Model weights keep their upstream licenses.
- Desktop stack: Tauri + React + Python AI Worker.
- Professional feature scope: time-axis editing, bilingual text review, advanced subtitle styling, waveform assistance, speaker diarization, subtitle export, and burned-in video export are all in scope.

## Non-Goals For First Public Release

- No account system, cloud sync, paid plans, or team collaboration.
- No full video editing timeline with transitions, filters, or audio mixing.
- No mobile app.
- No first-version quality promise for broad multilingual translation beyond Chinese-English.
- No bundling model weights into the MIT source repository.
- No guarantee that low-end machines can process long videos comfortably.
- No pixel-level subtitle animation editor; provide professional subtitle style presets and templates instead.

## User Workflow

The primary workflow is:

1. Import a local video file.
2. Create a local project.
3. Run preflight checks for FFmpeg, GPU, models, disk space, and file access.
4. Extract and normalize audio from the source video.
5. Split audio into recoverable chunks.
6. Run speech recognition with word-level timestamps.
7. Run speaker diarization and merge speaker segments with transcript timing.
8. Translate Chinese to English or English to Chinese.
9. Build an internal editable subtitle draft.
10. Review text, translation, speakers, and timing in the workbench.
11. Adjust subtitle styles and bilingual layout.
12. Export SRT, VTT, ASS, or burn subtitles into a new video.

## System Architecture

Diplomat should be split into four major layers.

### React Workbench

React owns the professional subtitle editing UI:

- Video preview.
- Subtitle line list.
- Timeline and subtitle blocks.
- Audio waveform.
- Speaker controls.
- Text and translation review.
- Style inspector.
- Model manager UI.
- Export panel.
- Task progress and logs.

The workbench should be dense, predictable, and tool-oriented. It should avoid landing-page composition, decorative cards, oversized marketing typography, and hidden controls. Keyboard access, labeled form controls, visible focus, readable contrast, and ARIA announcements for dynamic task updates are required.

### Tauri Shell

Tauri owns local desktop integration:

- Windows application window.
- File picker and file permissions.
- Project directory management.
- Launching and supervising the Python Worker.
- Local IPC bridge between frontend and worker.
- App settings and update hooks.
- Packaging and installer integration.

Tauri should not run AI or FFmpeg workloads directly. It should provide a reliable shell and system boundary.

### Python AI Worker

The Python Worker owns heavy local processing:

- FFmpeg audio extraction and video export orchestration.
- Voice activity detection or segmentation.
- Whisper/faster-whisper transcription.
- Translation.
- Speaker diarization.
- Waveform generation.
- Subtitle draft generation.
- Task queue, checkpoints, logging, and retry logic.

React and Tauri communicate with the worker through a defined local IPC boundary, such as local HTTP/WebSocket or stdio RPC. The UI must not import Python internals.

### Local Project Store

The project store persists local data:

- SQLite for project metadata, task state, model records, export history, and settings.
- JSON subtitle document for the canonical editable subtitle draft.
- Cache folders for audio chunks, waveform data, ASR intermediate results, translation results, proxy media, and export artifacts.

## AI Pipeline

The AI pipeline should be:

1. Input video.
2. FFmpeg extracts normalized mono audio, typically 16 kHz WAV for ASR.
3. Audio is split into chunks using silence/VAD and duration constraints.
4. ASR produces segment and word-level timestamps.
5. Speaker diarization produces speaker turns.
6. ASR segments and speaker turns are merged.
7. Translation generates Chinese-English subtitle text.
8. Internal subtitle draft is written to disk.
9. User edits the draft in the workbench.
10. Exporters render SRT, VTT, ASS, or burned-in video.

### Speech Recognition

Recommended first backend:

- faster-whisper with Whisper large-v3 or turbo-class models.
- GPU-first inference.
- Batched processing.
- Word-level timestamps where available.

Whisper's code and model weights are released under MIT according to the OpenAI Whisper repository. faster-whisper is also MIT-licensed and is suitable as the optimized runtime path.

### Translation

Recommended architecture:

- OPUS-MT as a fast baseline translation backend.
- A Qwen-class local LLM backend for higher-quality subtitle translation, terminology handling, and natural bilingual phrasing.

OPUS-MT project code is MIT, while public OPUS-MT models are commonly distributed as CC-BY 4.0 model artifacts. Qwen3 model cards currently show Apache-2.0 licensing for Qwen3-8B and the Qwen3 repository states open-weight models are Apache 2.0. Because model terms can change per model and release, Diplomat must show model-specific license metadata at download time.

### Speaker Diarization

Recommended first backend:

- pyannote speaker-diarization-community-1.

This model may require Hugging Face authentication and user acceptance. The application should guide users through that flow and cache the model locally after download. Diarization output must be editable because speaker labels will not always be correct.

### FFmpeg

FFmpeg is required for:

- Audio extraction.
- Audio normalization.
- Proxy media generation.
- ASS subtitle burn-in.
- Final video export.

The application can call FFmpeg as an external tool, but packaging must respect FFmpeg LGPL/GPL build differences. Prefer documenting and distributing a compliant FFmpeg build strategy before public release.

## Model Manager

The model manager is a first-version requirement because model weights are not part of the MIT source repository.

It must show:

- Model name.
- Purpose.
- Version.
- Source URL.
- License.
- Approximate download size.
- Disk usage.
- Recommended GPU/VRAM.
- Whether a Hugging Face token or license acceptance is required.
- Installed state and cache path.
- Checksum or integrity status.

It must support:

- First-run model selection.
- License acceptance before download.
- Download progress and retry.
- Offline mode for already installed models.
- Model health checks.
- CUDA availability checks.
- Clear fallback or remediation messages when a model cannot load.

The app should persist a local acceptance record containing model id, version, license URL, acceptance timestamp, and user-visible terms summary.

## Professional Workbench UI

The workbench layout should be:

- Left sidebar: project files, model/task state, subtitle tracks.
- Center top: video preview and subtitle line list.
- Center bottom: timeline, waveform, subtitle blocks, playback controls.
- Right inspector: selected subtitle line, timing, speaker, style, bilingual layout.
- Top toolbar: analyze, save, export, burn-in, settings.

### Editing Capabilities

First-version editor features:

- Edit source transcript and translated text line by line.
- Generate Chinese-only, English-only, or bilingual subtitles.
- Drag subtitle blocks on the timeline.
- Adjust start and end time.
- Split and merge subtitle lines.
- Snap timing to speech boundaries where available.
- Show waveform for manual timing.
- Show and edit speaker labels.
- Rename speakers.
- Merge incorrect duplicate speakers.
- Filter by speaker.
- Batch replace text.
- Maintain a glossary for terms and names.
- Apply style presets.
- Adjust font size, position, color, stroke, shadow, line spacing, and bilingual ordering.

### UI Quality Rules

- Use familiar icon buttons for common editing actions when possible.
- Use explicit labels for form controls.
- Keep text readable at desktop editing densities.
- Avoid layout shifts on hover.
- Use visible focus states.
- Use ARIA live regions for task progress and errors.
- Ensure all critical editor actions are keyboard reachable.
- Do not convey state by color alone.

## Internal Subtitle Document

Diplomat should not use SRT as its primary editable data structure. SRT is too limited for bilingual editing, styling, speakers, word timing, AI provenance, and review state.

The canonical subtitle draft should include:

- `id`
- `start_ms`
- `end_ms`
- `speaker_id`
- `source_language`
- `target_language`
- `source_text`
- `translated_text`
- `words[]` with optional word timing
- `style_overrides`
- `review_status`
- `ai_origin` metadata
- `notes`

Speaker records should include:

- `id`
- `display_name`
- `color`
- `style_id`
- `merged_into`
- optional confidence/provenance metadata

Style records should include:

- font family
- font size
- primary color
- secondary color
- stroke width
- shadow
- position
- margins
- alignment
- bilingual layout
- line spacing

Task records should include:

- task id
- type
- status
- input manifest
- output manifest
- model versions
- started/completed timestamps
- progress
- error code
- user-readable error
- diagnostic log path

## Export Design

Supported subtitle exports:

- SRT for broad compatibility.
- VTT for web players and course platforms.
- ASS for advanced layout, bilingual styling, positioning, stroke, and burn-in consistency.

Supported video exports:

- Burned-in MP4/MKV using FFmpeg.

Burn-in flow:

1. Generate ASS from the internal subtitle document.
2. Use the same style parameters as the preview layer where practical.
3. Generate a short preview clip before long final export.
4. Run FFmpeg with logged command and progress parsing.
5. Write final video to the project's exports folder.
6. Never overwrite the original video by default.

## Long Video Stability

Long-video support must be designed around recoverable work, not one-shot processing.

### Job State Machine

Jobs use:

- `queued`
- `running`
- `paused`
- `failed`
- `completed`
- `canceled`

### Processing Stages

The primary processing job contains:

1. `preflight`
2. `extract_audio`
3. `chunk_audio`
4. `transcribe_chunks`
5. `diarize`
6. `translate`
7. `build_subtitle_draft`
8. `export`

### Recovery Rules

- Each chunk writes a manifest after completion.
- Failed chunks can be retried without rerunning the whole video.
- Stage outputs are checksummed or otherwise validated.
- Canceling a task preserves completed stages unless the user explicitly clears caches.
- Pausing a task releases GPU resources where possible.
- On restart, the project can resume from the latest valid manifest.
- AI raw results and user-edited subtitle state are stored separately.

### Preflight Checks

Preflight should verify:

- FFmpeg is available.
- Source video can be read.
- Audio stream exists.
- Output directory is writable.
- Disk space is sufficient for cache and exports.
- CUDA and required GPU libraries are available.
- Worker dependencies can load.
- Required models are installed.
- Installed model checksums match expected values.
- Model license acceptance records exist.

### User-Facing Error Handling

Errors should be actionable:

- Missing model: open model manager.
- CUDA unavailable: show driver/runtime checks.
- Out of memory: suggest smaller model, lower batch size, or fewer concurrent tasks.
- FFmpeg failed: show short reason, preserve command and log.
- Disk full: show cache cleanup entry.
- Corrupt project/cache: offer validation and repair.

## Repository Structure

Recommended repository structure:

```text
diplomat/
  apps/
    desktop/        # Tauri shell
    web/            # React workbench UI
  worker/           # Python AI/video worker
  packages/
    shared/         # shared schemas/types
    subtitle-core/  # timing/export logic
  docs/
  scripts/
  tests/
  LICENSE
  README.md
```

Shared schemas should be treated as a contract between TypeScript and Python. Use JSON Schema/Zod/Pydantic or an equivalent approach so the UI and worker agree on subtitle documents, task events, model metadata, and export manifests.

## Milestones

### M0: Repository Foundation

- Initialize monorepo.
- Add MIT License.
- Add Tauri + React app skeleton.
- Add Python Worker skeleton.
- Add basic local IPC.
- Add shared schema package.
- Add development scripts.

### M1: Core Pipeline

- Import video.
- Run preflight checks.
- Extract audio with FFmpeg.
- Chunk audio.
- Run faster-whisper transcription.
- Generate internal subtitle document.
- Persist project state.

### M2: Workbench

- Show video preview.
- Show subtitle line list.
- Edit transcript text.
- Save edits.
- Add basic timeline with subtitle blocks.
- Add basic style controls.
- Export SRT.

### M3: Professional Tools

- Add bilingual translation.
- Add waveform view.
- Add speaker diarization.
- Add speaker editing.
- Add split/merge.
- Add batch replace.
- Add glossary.
- Add VTT and ASS export.

### M4: Export And Packaging

- Add ASS burn-in with FFmpeg.
- Add preview clip generation.
- Add model manager.
- Add Windows installer.
- Add dependency diagnostics.
- Add public-release documentation.

## MVP Acceptance Criteria

The first public MVP is acceptable when:

- A user can import a 1-3 hour video.
- The app can run local transcription on the video.
- The app can generate Chinese, English, or bilingual subtitle drafts.
- The app can show and edit subtitle lines.
- The app can show waveform-assisted timing.
- The user can adjust timing, split, and merge subtitle lines.
- The user can review and correct speaker labels.
- The user can adjust subtitle size, position, color, stroke, and bilingual layout.
- The user can export SRT, VTT, and ASS.
- The user can burn subtitles into a new video.
- A failed long-running task can be diagnosed and retried from a checkpoint.
- The model manager clearly separates MIT application code from model licenses.

## Key Risks

- Python Worker packaging inside a Tauri app on Windows.
- CUDA/cuDNN/CTranslate2 dependency mismatch.
- Large model download size and user setup friction.
- Speaker diarization accuracy on noisy videos.
- Long-video memory and disk pressure.
- FFmpeg distribution and license compliance.
- Preview-vs-burn-in subtitle style mismatch.

## Source References

- OpenAI Whisper: https://github.com/openai/whisper
- faster-whisper: https://github.com/SYSTRAN/faster-whisper
- pyannote speaker-diarization-community-1: https://huggingface.co/pyannote/speaker-diarization-community-1
- OPUS-MT: https://github.com/Helsinki-NLP/Opus-MT
- Qwen3-8B license page: https://huggingface.co/Qwen/Qwen3-8B/blob/main/LICENSE
- Qwen3 repository: https://github.com/QwenLM/Qwen3
- FFmpeg legal notes: https://www.ffmpeg.org/legal.html

## Implementation Plan Gate

Do not begin implementation from this design until an implementation plan is written and reviewed. The implementation plan should break the work into verifiable steps and should start with M0 and M1, not the full professional UI.
