# Diplomat 0.4 Real-Model Desktop Roadmap

Date: 2026-06-18

Target range: 0.36.0 through 0.40.0

Base release: 0.35.0

## Goal

Diplomat 0.4 turns the 0.35 desktop stability line into a real-model desktop product line. The release is accepted only when a representative 2-3 hour lecture, course, or tutorial video can complete import, intelligent audio segmentation, ASR, translation, editing, and export with real local models.

## Three Major Tasks

### Task 1: Desktop UI And Interaction Upgrade

The current frontend must become a polished desktop application rather than a functional prototype. The 0.4 UI direction is a Material Design 3 inspired workstation:

- professional app shell and navigation rail.
- clear surface hierarchy and typography.
- dense but readable workbench layout.
- model, task, runtime, and recovery status visible from the UI.
- improved inspector and long-task interaction design.
- no marketing-page layout.

### Task 2: Real Local Model Integration

0.4 must connect real ASR and translation models.

- ASR model: `microsoft/VibeVoice-ASR`.
- Translation model: `tencent/Hunyuan-MT-7B-fp8`.
- Later high-quality translation model: `tencent/Hy-MT2-30B-A3B`, outside 0.4 acceptance.
- Development model files live under `models/dev`.
- GitHub stores folder structure, manifests, and metadata, not model weights.
- Model licenses, checksums, source URLs, and local acceptance state are first-class release data.

### Task 3: Functional And Workflow Completion

0.4 must prove that the app works end-to-end, not just expose UI controls.

- Intelligent course-oriented audio segmentation.
- Speech-aware chunk manifests.
- ASR child-process isolation.
- GPU memory release after ASR before translation begins.
- Translation child-process isolation.
- GPU memory release after translation completes.
- Recoverable chunk and batch persistence.
- Editable subtitle document.
- Exported subtitle or video artifacts.
- Three-hour acceptance evidence.

## Stage Map

| Version | Stage | Main Task Coverage | Exit Result |
| --- | --- | --- | --- |
| 0.36 | Material 3 desktop workstation | Task 1 | The desktop UI looks and behaves like a professional workstation and exposes long-task/model state clearly. |
| 0.37 | Model directory and manifests | Task 2 | Development model folders, manifests, ignore rules, license gates, and model readiness checks exist. |
| 0.38 | Intelligent ASR segmentation | Task 2 and Task 3 | VAD-backed intelligent segmentation and VibeVoice-ASR isolated execution produce recoverable ASR chunks. |
| 0.39 | Hunyuan translation pipeline | Task 2 and Task 3 | Hunyuan-MT-7B-fp8 translates subtitle batches after ASR memory is released. |
| 0.40 | 2-3 hour release gate | Task 3 | A representative 2-3 hour video completes the real workflow and produces acceptance evidence. |

## Required Stage Process

Each 0.01 stage follows the same process:

1. Start from `main`.
2. Create a branch with the `codex/` prefix.
3. Write or update the stage development document under `docs/development`.
4. Write the stage implementation plan under `docs/superpowers/plans`.
5. Implement focused changes.
6. Run focused verification.
7. Run full repository verification when the stage is ready:

```powershell
.\scripts\check.ps1
```

8. Run stage-specific opt-in verification when applicable.
9. Write a stage gate review under `docs/development`.
10. Fix blocking findings.
11. Merge accepted branch into `main`.
12. Push `main` to GitHub.
13. Tag only final accepted release points that need public version tags.
14. Begin the next 0.01 stage only after the previous stage is accepted.

## Branch Names

- `codex/0.36-material-workstation`
- `codex/0.37-model-directory-manifests`
- `codex/0.38-intelligent-asr`
- `codex/0.39-hunyuan-translation`
- `codex/0.40-three-hour-release-gate`

## Version Policy

Each stage advances package metadata to the corresponding patch-like minor line:

- 0.36.0
- 0.37.0
- 0.38.0
- 0.39.0
- 0.40.0

Version changes must remain consistent across:

- root `package.json`.
- app package metadata.
- Tauri config and Cargo metadata.
- Worker Python metadata.
- README current version.
- release verification scripts.

## Model Storage Policy

The repository may commit:

- `models/README.md`.
- `models/.gitignore`.
- `models/dev/**/.gitkeep`.
- `models/manifests/*.json`.
- scripts that download, verify, or inspect models.
- docs describing source, license, size, and expected path.

The repository must not commit:

- `.safetensors`.
- `.bin`.
- `.pt`.
- `.onnx` model weights unless explicitly approved as small redistributable assets.
- Hugging Face cache folders.
- local acceptance media.
- generated transcription or translation artifacts.

## Acceptance Definition For 0.4

0.4 is complete only when:

- the final version is `0.40.0`.
- `main` contains every accepted stage.
- GitHub has the accepted `main`.
- a `v0.40` release tag exists.
- a 2-3 hour representative video completed the real-model workflow.
- VibeVoice-ASR and Hunyuan-MT-7B-fp8 were used in the acceptance path.
- model memory lifecycle evidence shows ASR memory released before translation starts.
- subtitle editing and export work after the real model pipeline.
- stage gate docs record all known limitations.
