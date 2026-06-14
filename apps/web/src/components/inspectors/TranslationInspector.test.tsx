import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ModelCatalogEntry, TranslationJobRequest } from "@diplomat/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { modelCatalogFixture } from "../../test/fixtures";
import { TranslationInspector } from "./TranslationInspector";

const translationConfig: TranslationJobRequest = {
  provider: "fake",
  sourceLanguage: "zh",
  targetLanguage: "en",
  mode: "missing_only",
  endpoint: null,
  apiKeyEnv: null
};

const installedTranslationModel: ModelCatalogEntry = {
  ...modelCatalogFixture.models.find((model) => model.modelId === "translation.qwen3.4b")!,
  installation: {
    ...modelCatalogFixture.models.find((model) => model.modelId === "translation.qwen3.4b")!
      .installation,
    status: "installed",
    installedPath: "D:/Diplomat/models/qwen3-4b",
    downloadedBytes: 2_500_000_000,
    installedAt: "2026-06-14T00:05:00+00:00"
  },
  availability: {
    usable: true,
    reason: null
  }
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
  it("edits provider, languages, mode, endpoint, and API key env", () => {
    const onConfigChange = vi.fn();

    renderWithProviders(
      <TranslationInspector
        config={translationConfig}
        busy={false}
        onConfigChange={onConfigChange}
        onStart={() => undefined}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Provider" }), {
      target: { value: "libretranslate" }
    });
    fireEvent.change(screen.getByLabelText("Source language"), { target: { value: "ja" } });
    fireEvent.change(screen.getByLabelText("Target language"), { target: { value: "fr" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Translation mode" }), {
      target: { value: "overwrite_all" }
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
      sourceLanguage: "ja"
    });
    expect(onConfigChange).toHaveBeenCalledWith({
      ...translationConfig,
      targetLanguage: "fr"
    });
    expect(onConfigChange).toHaveBeenCalledWith({
      ...translationConfig,
      mode: "overwrite_all"
    });
    expect(onConfigChange).toHaveBeenCalledWith({
      ...translationConfig,
      endpoint: "http://127.0.0.1:5000"
    });
    expect(onConfigChange).toHaveBeenCalledWith({
      ...translationConfig,
      apiKeyEnv: "LIBRETRANSLATE_API_KEY"
    });
  });

  it("runs task action callbacks", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    const onCancel = vi.fn();
    const onRetry = vi.fn();

    renderWithProviders(
      <TranslationInspector
        config={translationConfig}
        busy={false}
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
      <TranslationInspector
        config={translationConfig}
        busy
        onConfigChange={() => undefined}
        onStart={() => undefined}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    expect(screen.getByRole("combobox", { name: "Provider" })).toBeDisabled();
    expect(screen.getByLabelText("Source language")).toBeDisabled();
    expect(screen.getByLabelText("Target language")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Translation mode" })).toBeDisabled();
    expect(screen.getByLabelText("Endpoint")).toBeDisabled();
    expect(screen.getByLabelText("API key env")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it.each([
    {
      field: "Source language",
      config: { ...translationConfig, sourceLanguage: "" },
      error: "Source language is required."
    },
    {
      field: "Source language",
      config: { ...translationConfig, sourceLanguage: "z" },
      error: "Use 2 to 12 characters."
    },
    {
      field: "Target language",
      config: { ...translationConfig, targetLanguage: "english-long-code" },
      error: "Use 2 to 12 characters."
    }
  ])("disables draft actions when $field is invalid", ({ config, error }) => {
    const onStart = vi.fn();
    const onRetry = vi.fn();

    renderWithProviders(
      <TranslationInspector
        config={config}
        busy={false}
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

  it("shows curated translation models and blocks unavailable selections", () => {
    const onSelectedModelChange = vi.fn();

    renderWithProviders(
      <TranslationInspector
        config={translationConfig}
        busy={false}
        modelCatalog={modelCatalogFixture.models}
        selectedModelId="translation.opus-mt.zh-en"
        onSelectedModelChange={onSelectedModelChange}
        onConfigChange={() => undefined}
        onStart={() => undefined}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    expect(screen.getByRole("combobox", { name: "Translation model" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "OPUS-MT Chinese to English" })
    ).toBeInTheDocument();
    expect(screen.getByText("Install this translation model before starting translation.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox", { name: "Translation model" }), {
      target: { value: "translation.qwen3.4b" }
    });

    expect(onSelectedModelChange).toHaveBeenCalledWith("translation.qwen3.4b");
  });

  it("blocks installed local translation models until the 0.25 runtime stage", () => {
    renderWithProviders(
      <TranslationInspector
        config={translationConfig}
        busy={false}
        modelCatalog={[installedTranslationModel]}
        selectedModelId="translation.qwen3.4b"
        onSelectedModelChange={() => undefined}
        onConfigChange={() => undefined}
        onStart={() => undefined}
        onCancel={() => undefined}
        onRetry={() => undefined}
      />
    );

    expect(screen.getByText("Local translation model execution lands in 0.25.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });
});
