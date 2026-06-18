import { describe, expect, it } from "vitest";
import {
  ModelCatalogResponseSchema,
  ModelDownloadResponseSchema,
  ModelRegistryEntrySchema
} from "../src/model";

const registryEntry = {
  modelId: "asr-light",
  name: "Faster Whisper Small",
  task: "asr",
  tier: "light",
  runtime: "faster-whisper",
  provider: "faster-whisper",
  version: "2026-06-14",
  languages: ["zh", "en"],
  languagePairs: [],
  modelSizeBytes: 488_000_000,
  downloadSizeBytes: 244_000_000,
  diskRequirementBytes: 600_000_000,
  recommendedHardware: "CPU fallback, NVIDIA GPU recommended",
  licenseName: "MIT",
  licenseUrl: "https://huggingface.co/Systran/faster-whisper-small",
  sourceUrl: "https://example.invalid/asr-light.bin",
  checksumAlgorithm: "sha256",
  checksum: "0".repeat(64),
  termsSummary: "Open model weights; verify upstream license before release."
};

describe("model registry schemas", () => {
  it("parses a curated registry entry", () => {
    const parsed = ModelRegistryEntrySchema.parse(registryEntry);

    expect(parsed.modelId).toBe("asr-light");
    expect(parsed.task).toBe("asr");
  });

  it("accepts the VibeVoice ASR runtime target", () => {
    const parsed = ModelRegistryEntrySchema.parse({
      ...registryEntry,
      modelId: "asr.microsoft.vibevoice-asr",
      name: "Microsoft VibeVoice ASR",
      runtime: "vibevoice-asr",
      provider: "microsoft"
    });

    expect(parsed.runtime).toBe("vibevoice-asr");
  });

  it("parses catalog entries merged with installation state", () => {
    const parsed = ModelCatalogResponseSchema.parse({
      models: [
        {
          ...registryEntry,
          installation: {
            modelId: "asr-light",
            status: "installed",
            installedPath: "D:/Diplomat/models/asr-light",
            downloadedBytes: 244_000_000,
            totalBytes: 244_000_000,
            checksum: "0".repeat(64),
            errorMessage: null,
            createdAt: "2026-06-14T00:00:00+00:00",
            updatedAt: "2026-06-14T00:01:00+00:00",
            installedAt: "2026-06-14T00:01:00+00:00"
          },
          availability: {
            usable: true,
            reason: null
          },
          runtimeProfiles: [
            {
              profileId: "asr-light:cpu:int8",
              task: "asr",
              provider: "faster-whisper",
              device: "cpu",
              computeType: "int8",
              batchSize: 1,
              recommended: true,
              available: true,
              reason: null,
              notes: "CPU fallback ASR profile."
            }
          ]
        }
      ]
    });

    expect(parsed.models[0]!.availability.usable).toBe(true);
    expect(parsed.models[0]!.runtimeProfiles[0]!.batchSize).toBe(1);
  });

  it("rejects unknown status values", () => {
    expect(() =>
      ModelDownloadResponseSchema.parse({
        modelId: "asr-light",
        status: "half_done",
        downloadedBytes: 0,
        totalBytes: 1,
        message: "bad"
      })
    ).toThrow();
  });
});
