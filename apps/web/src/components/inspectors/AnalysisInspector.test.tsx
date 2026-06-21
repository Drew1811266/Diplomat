import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnalysisJobRequest } from "@diplomat/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { modelCatalogFixture } from "../../test/fixtures";
import { AnalysisInspector } from "./AnalysisInspector";

const analysisConfig: AnalysisJobRequest = {
  provider: "fake",
  modelId: null,
  modelNameOrPath: null,
  device: "cpu",
  computeType: "int8",
  sourceLanguage: null,
  initialPrompt: null
};

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
}

beforeEach(() => {
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AnalysisInspector", () => {
  it("edits the analysis provider, model, language, and runtime fields", () => {
    const onConfigChange = vi.fn();

    renderWithProviders(
      <AnalysisInspector
        config={analysisConfig}
        busy={false}
        allowDevelopmentControls
        onConfigChange={onConfigChange}
        onStart={() => undefined}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Provider" }), {
      target: { value: "faster-whisper" }
    });
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "tiny" } });
    const sourceLanguage = screen.getByRole("combobox", { name: "Source language" });
    expect(within(sourceLanguage).getByRole("option", { name: "Auto detect" })).toBeInTheDocument();
    expect(within(sourceLanguage).getByRole("option", { name: "Chinese (zh)" })).toBeInTheDocument();
    fireEvent.change(sourceLanguage, { target: { value: "zh" } });
    fireEvent.click(screen.getByRole("button", { name: "Advanced options" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Device" }), {
      target: { value: "cuda" }
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Compute type" }), {
      target: { value: "float16" }
    });
    fireEvent.change(screen.getByLabelText("Initial prompt"), {
      target: { value: "Use short subtitle phrasing" }
    });

    expect(onConfigChange).toHaveBeenCalledWith({
      ...analysisConfig,
      provider: "faster-whisper"
    });
    expect(onConfigChange).toHaveBeenCalledWith({
      ...analysisConfig,
      modelNameOrPath: "tiny"
    });
    expect(onConfigChange).toHaveBeenCalledWith({
      ...analysisConfig,
      sourceLanguage: "zh"
    });
    expect(onConfigChange).toHaveBeenCalledWith({
      ...analysisConfig,
      device: "cuda"
    });
    expect(onConfigChange).toHaveBeenCalledWith({
      ...analysisConfig,
      computeType: "float16"
    });
    expect(onConfigChange).toHaveBeenCalledWith({
      ...analysisConfig,
      initialPrompt: "Use short subtitle phrasing"
    });
  });

  it("keeps runtime controls behind advanced options", () => {
    renderWithProviders(
      <AnalysisInspector
        config={analysisConfig}
        busy={false}
        allowDevelopmentControls
        onConfigChange={() => undefined}
        onStart={() => undefined}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    const advancedButton = screen.getByRole("button", { name: "Advanced options" });

    expect(advancedButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("combobox", { name: "Device" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Compute type" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Initial prompt")).not.toBeInTheDocument();

    fireEvent.click(advancedButton);

    expect(advancedButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("combobox", { name: "Device" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Compute type" })).toBeVisible();
    expect(screen.getByLabelText("Initial prompt")).toBeVisible();
  });

  it("runs task action callbacks", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    const onCancel = vi.fn();
    const onRetry = vi.fn();

    renderWithProviders(
      <AnalysisInspector
        config={analysisConfig}
        busy={false}
        allowDevelopmentControls
        onConfigChange={() => undefined}
        onStart={onStart}
        onCancel={onCancel}
        onRetry={onRetry}
      />
    );

    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("disables form fields and start while busy", () => {
    renderWithProviders(
      <AnalysisInspector
        config={analysisConfig}
        busy
        allowDevelopmentControls
        onConfigChange={() => undefined}
        onStart={() => undefined}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    expect(screen.getByRole("combobox", { name: "Provider" })).toBeDisabled();
    expect(screen.getByLabelText("Model")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Source language" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Advanced options" }));
    expect(screen.getByRole("combobox", { name: "Device" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Compute type" })).toBeDisabled();
    expect(screen.getByLabelText("Initial prompt")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it("limits runtime settings to non-empty device and compute type options", () => {
    renderWithProviders(
      <AnalysisInspector
        config={analysisConfig}
        busy={false}
        allowDevelopmentControls
        onConfigChange={() => undefined}
        onStart={() => undefined}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Advanced options" }));

    expect(screen.getByRole("combobox", { name: "Device" })).toHaveValue("cpu");
    expect(screen.getByRole("combobox", { name: "Compute type" })).toHaveValue("int8");
    expect(screen.queryAllByRole("option", { name: "" })).toHaveLength(0);
  });

  it("selects installed curated ASR models as the formal faster-whisper path", () => {
    const onConfigChange = vi.fn();

    renderWithProviders(
      <AnalysisInspector
        config={analysisConfig}
        busy={false}
        modelCatalog={modelCatalogFixture.models}
        onConfigChange={onConfigChange}
        onStart={() => undefined}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    expect(screen.getByRole("combobox", { name: "Installed ASR model" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Faster Whisper Medium" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Faster Whisper Small" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Model")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Installed ASR model" }), {
      target: { value: "asr.faster-whisper.medium" }
    });

    expect(onConfigChange).toHaveBeenCalledWith({
      ...analysisConfig,
      provider: "faster-whisper",
      modelId: "asr.faster-whisper.medium",
      modelNameOrPath: null,
      device: "cpu",
      computeType: "int8"
    });
  });

  it("selects installed VibeVoice ASR models with the VibeVoice provider", () => {
    const onConfigChange = vi.fn();
    const vibevoice = modelCatalogFixture.models.find(
      (model) => model.modelId === "asr.microsoft.vibevoice-asr"
    );
    if (!vibevoice) {
      throw new Error("Missing VibeVoice fixture");
    }
    const installedVibevoice = {
      ...vibevoice,
      installation: {
        ...vibevoice.installation,
        status: "installed" as const,
        installedPath: "D:/Diplomat/models/vibevoice"
      },
      availability: { usable: true, reason: null },
      runtimeProfiles: vibevoice.runtimeProfiles.map((profile) => ({
        ...profile,
        available: profile.device === "cuda",
        reason: profile.device === "cuda" ? null : profile.reason
      }))
    };

    renderWithProviders(
      <AnalysisInspector
        config={analysisConfig}
        busy={false}
        modelCatalog={[installedVibevoice]}
        onConfigChange={onConfigChange}
        onStart={() => undefined}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Installed ASR model" }), {
      target: { value: "asr.microsoft.vibevoice-asr" }
    });

    expect(onConfigChange).toHaveBeenCalledWith({
      ...analysisConfig,
      provider: "vibevoice-asr",
      modelId: "asr.microsoft.vibevoice-asr",
      modelNameOrPath: null,
      device: "cuda",
      computeType: "bfloat16"
    });
  });

  it("blocks formal ASR start until a curated model is installed", () => {
    const onStart = vi.fn();

    renderWithProviders(
      <AnalysisInspector
        config={{ ...analysisConfig, provider: "faster-whisper" }}
        busy={false}
        onConfigChange={() => undefined}
        onStart={onStart}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    expect(screen.queryByRole("combobox", { name: "Provider" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Model")).not.toBeInTheDocument();
    expect(
      screen.getByText("Install an ASR model from Settings > Models before starting local transcription.")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });

  it("blocks formal ASR start when the selected runtime profile is unavailable", () => {
    renderWithProviders(
      <AnalysisInspector
        config={{
          ...analysisConfig,
          provider: "faster-whisper",
          modelId: "asr.faster-whisper.medium",
          device: "cuda",
          computeType: "float16"
        }}
        busy={false}
        modelCatalog={modelCatalogFixture.models}
        onConfigChange={() => undefined}
        onStart={() => undefined}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    expect(screen.getByText("CUDA is not available in this local runtime.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });
});
