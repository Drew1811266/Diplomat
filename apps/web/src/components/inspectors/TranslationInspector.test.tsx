import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ModelCatalogEntry, TranslationJobRequest } from "@diplomat/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { modelCatalogFixture } from "../../test/fixtures";
import { TranslationInspector } from "./TranslationInspector";

const translationConfig: TranslationJobRequest = {
  provider: "ct2-marian",
  modelId: null,
  modelNameOrPath: null,
  sourceLanguage: "zh",
  targetLanguage: "en",
  mode: "missing_only",
  device: "cpu",
  computeType: "int8",
  batchSize: 8,
  endpoint: null,
  apiKeyEnv: null
};

const installedTranslationModel: ModelCatalogEntry = {
  ...modelCatalogFixture.models.find((model) => model.modelId === "translation.opus-mt.zh-en")!,
  installation: {
    ...modelCatalogFixture.models.find((model) => model.modelId === "translation.opus-mt.zh-en")!
      .installation,
    status: "installed",
    installedPath: "D:/Diplomat/models/opus-zh-en",
    downloadedBytes: 160_000_000,
    installedAt: "2026-06-14T00:05:00+00:00"
  },
  availability: {
    usable: true,
    reason: null
  }
};

const configuredTranslationConfig: TranslationJobRequest = {
  ...translationConfig,
  modelId: installedTranslationModel.modelId
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

describe("TranslationInspector", () => {
  it("selects installed curated translation models as the formal local path", () => {
    const onConfigChange = vi.fn();

    renderWithProviders(
      <TranslationInspector
        config={translationConfig}
        busy={false}
        modelCatalog={[installedTranslationModel]}
        onConfigChange={onConfigChange}
        onStart={() => undefined}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    expect(screen.getByRole("combobox", { name: "Translation model" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "OPUS-MT Chinese to English" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Provider" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Endpoint")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("API key env")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox", { name: "Translation model" }), {
      target: { value: installedTranslationModel.modelId }
    });

    expect(onConfigChange).toHaveBeenCalledWith({
      ...translationConfig,
      provider: "ct2-marian",
      modelId: installedTranslationModel.modelId,
      modelNameOrPath: null,
      sourceLanguage: "zh",
      targetLanguage: "en"
    });
  });

  it("runs task action callbacks when a compatible installed model is selected", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    const onCancel = vi.fn();
    const onRetry = vi.fn();

    renderWithProviders(
      <TranslationInspector
        config={configuredTranslationConfig}
        busy={false}
        modelCatalog={[installedTranslationModel]}
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

  it("shows the selected translation runtime profile batch size", () => {
    renderWithProviders(
      <TranslationInspector
        config={{ ...configuredTranslationConfig, device: "cpu", computeType: "int8" }}
        busy={false}
        modelCatalog={[installedTranslationModel]}
        onConfigChange={() => undefined}
        onStart={() => undefined}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    expect(screen.getByText(/Batch size 8/)).toBeVisible();
  });

  it("disables form fields and start while busy", () => {
    renderWithProviders(
      <TranslationInspector
        config={configuredTranslationConfig}
        busy
        modelCatalog={[installedTranslationModel]}
        onConfigChange={() => undefined}
        onStart={() => undefined}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    expect(screen.getByRole("combobox", { name: "Translation model" })).toBeDisabled();
    expect(screen.getByLabelText("Source language")).toBeDisabled();
    expect(screen.getByLabelText("Target language")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Translation mode" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Device" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Compute type" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it.each([
    {
      field: "Source language",
      config: { ...configuredTranslationConfig, sourceLanguage: "" },
      error: "Source language is required."
    },
    {
      field: "Source language",
      config: { ...configuredTranslationConfig, sourceLanguage: "z" },
      error: "Use 2 to 12 characters."
    },
    {
      field: "Target language",
      config: { ...configuredTranslationConfig, targetLanguage: "english-long-code" },
      error: "Use 2 to 12 characters."
    }
  ])("disables draft actions when $field is invalid", ({ config, error }) => {
    const onStart = vi.fn();
    const onRetry = vi.fn();

    renderWithProviders(
      <TranslationInspector
        config={config}
        busy={false}
        modelCatalog={[installedTranslationModel]}
        onConfigChange={() => undefined}
        onStart={onStart}
        onCancel={() => undefined}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText(error)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onStart).not.toHaveBeenCalled();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("blocks translation when no installed usable model exists", () => {
    renderWithProviders(
      <TranslationInspector
        config={translationConfig}
        busy={false}
        modelCatalog={modelCatalogFixture.models}
        onConfigChange={() => undefined}
        onStart={() => undefined}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    expect(screen.getByText("Install a translation model from Models before starting local translation.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });

  it("blocks translation when the selected model does not support the language pair", () => {
    renderWithProviders(
      <TranslationInspector
        config={{ ...configuredTranslationConfig, sourceLanguage: "en", targetLanguage: "zh" }}
        busy={false}
        modelCatalog={[installedTranslationModel]}
        onConfigChange={() => undefined}
        onStart={() => undefined}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    expect(screen.getByText("Selected translation model does not support this language pair.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });

  it("keeps remote provider controls available only for explicit development mode", () => {
    const onConfigChange = vi.fn();

    renderWithProviders(
      <TranslationInspector
        config={{ ...translationConfig, provider: "fake" }}
        busy={false}
        allowDevelopmentControls
        onConfigChange={onConfigChange}
        onStart={() => undefined}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Provider" }), {
      target: { value: "libretranslate" }
    });
    fireEvent.change(screen.getByLabelText("Endpoint"), {
      target: { value: "http://127.0.0.1:5000" }
    });
    fireEvent.change(screen.getByLabelText("API key env"), {
      target: { value: "LIBRETRANSLATE_API_KEY" }
    });

    expect(onConfigChange).toHaveBeenCalledWith({
      ...translationConfig,
      provider: "libretranslate"
    });
    expect(onConfigChange).toHaveBeenCalledWith({
      ...translationConfig,
      provider: "fake",
      endpoint: "http://127.0.0.1:5000"
    });
    expect(onConfigChange).toHaveBeenCalledWith({
      ...translationConfig,
      provider: "fake",
      apiKeyEnv: "LIBRETRANSLATE_API_KEY"
    });
  });
});
