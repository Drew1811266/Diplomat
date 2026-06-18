# Diplomat Development Models

This directory defines the local development model layout for the 0.4 real-model pipeline.

- `models/manifests/` contains committed JSON metadata for approved model targets.
- `models/dev/` contains local development model folders. Only `.gitkeep` placeholders are committed.
- `models/licenses/accepted/` records local license acceptance state. The directory exists in Git, but local acceptance files are ignored.

Do not commit model weights, tokenizer files, safetensors, checkpoints, caches, or generated license acceptance records.

0.37 approved development paths:

- ASR: `models/dev/asr/microsoft--VibeVoice-ASR`
- Translation: `models/dev/translation/tencent--Hunyuan-MT-7B-fp8`
