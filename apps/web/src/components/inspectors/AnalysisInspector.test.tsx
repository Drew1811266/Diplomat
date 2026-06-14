import { cleanup, fireEvent, screen } from "@testing-library/react";
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
    fireEvent.change(screen.getByLabelText("Source language"), { target: { value: "zh" } });
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
    expect(screen.getByLabelText("Source language")).toBeDisabled();
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
      modelNameOrPath: null
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
    expect(screen.getByText("Install an ASR model from Models before starting local transcription.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });
});
