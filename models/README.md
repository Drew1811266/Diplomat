# Diplomat Development Models

This directory defines the local development model layout for the 0.4 real-model pipeline.

- `models/manifests/` contains committed JSON metadata for approved model targets.
- `models/dev/` contains local development model folders. Only `.gitkeep` placeholders are committed.
- `models/licenses/accepted/` records local license acceptance state. The directory exists in Git, but local acceptance files are ignored.

Do not commit model weights, tokenizer files, safetensors, checkpoints, caches, or generated license acceptance records.

0.37 approved development paths:

- ASR: `models/dev/asr/microsoft--VibeVoice-ASR`
- Translation: `models/dev/translation/tencent--Hunyuan-MT-7B-fp8`

## License Boundaries

Diplomat source code is MIT licensed. Model weights are separate external assets and keep their upstream licenses.

`tencent/Hunyuan-MT-7B-fp8` is treated as a restricted, user-provided external model:

- Hunyuan weights are not included in this repository.
- Hunyuan weights must not be redistributed with Diplomat.
- Users must review and accept Tencent's upstream license before local use.
- The local acceptance record is ignored by Git and must not be committed.
- The acceptance flow requires explicit confirmation that local use is in a permitted territory and not in the European Union, United Kingdom, or South Korea.

For local 0.40 development, prepare Hunyuan only after reviewing the upstream license:

```powershell
python .\scripts\acceptance\prepare-0-40-models.py `
  --model-id translation.tencent.hunyuan-mt-7b-fp8 `
  --accept-hunyuan-license `
  --confirm-hunyuan-restricted-license `
  --confirm-hunyuan-permitted-territory `
  --confirm-hunyuan-no-redistribution
```
