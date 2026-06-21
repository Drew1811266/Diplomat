import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appI18n } from "../app/i18n";
import { useUiStore } from "../state/uiStore";
import { ModelsPage } from "./ModelsPage";
import { modelCatalogFixture } from "../test/fixtures";
import { renderWithProviders } from "../test/render";

function jsonResponse(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => payload
  } as Response;
}

function stubMatchMedia() {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn()
    }))
  );
}

function makeManyModels(count: number) {
  const baseModel = modelCatalogFixture.models[0];
  return Array.from({ length: count }, (_, index) => {
    const modelNumber = index + 1;
    const modelId = `asr.generated.${modelNumber}`;
    return {
      ...baseModel,
      modelId,
      name: `Generated Model ${modelNumber}`,
      installation: {
        ...baseModel.installation,
        modelId
      },
      runtimeProfiles: baseModel.runtimeProfiles.map((profile) => ({
        ...profile,
        modelId
      }))
    };
  });
}

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  useUiStore.getState().resetUiState();
  await appI18n.changeLanguage("en");
});

describe("ModelsPage", () => {
  it("renders curated model metadata and filters by task", async () => {
    const user = userEvent.setup();
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/models")) {
          return jsonResponse(modelCatalogFixture);
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    renderWithProviders(<ModelsPage />);

    expect(await screen.findByRole("main", { name: "Models" })).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent)).toEqual([
      "Models"
    ]);
    expect(await screen.findByRole("heading", { name: "Recommended setup" })).toBeVisible();
    expect(screen.getByText("Faster Whisper Medium")).toBeVisible();
    expect(screen.getByText("OPUS-MT Chinese to English")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Model Catalog" })).not.toBeInTheDocument();
    const advancedCatalogButton = screen.getByRole("button", { name: "Advanced model catalog" });
    expect(advancedCatalogButton).toHaveAttribute("aria-expanded", "false");

    await user.click(advancedCatalogButton);

    expect(advancedCatalogButton).toHaveAttribute("aria-expanded", "true");
    const catalogRegion = screen.getByRole("region", { name: "Advanced model catalog" });
    expect(within(catalogRegion).getByRole("heading", { name: "Model Catalog" })).toBeVisible();
    expect(await within(catalogRegion).findByText("Faster Whisper Small")).toBeVisible();
    expect(within(catalogRegion).getByText("Microsoft VibeVoice ASR")).toBeVisible();
    expect(within(catalogRegion).getByText("OPUS-MT Chinese to English")).toBeVisible();
    expect(within(catalogRegion).getByText("Tencent Hunyuan MT 7B FP8")).toBeVisible();
    expect(within(catalogRegion).getByText("Model license acceptance is required.")).toBeVisible();
    expect(within(catalogRegion).getAllByText("MIT").length).toBeGreaterThan(0);
    expect(within(catalogRegion).getByText("CC-BY-4.0")).toBeVisible();
    expect(within(catalogRegion).getAllByText("faster-whisper").length).toBeGreaterThan(0);
    expect(within(catalogRegion).getAllByText("vibevoice-asr").length).toBeGreaterThan(0);
    expect(within(catalogRegion).getAllByText("ct2-marian").length).toBeGreaterThan(0);
    expect(within(catalogRegion).getByText("zh -> en")).toBeVisible();
    expect(within(catalogRegion).getByText("D:/Diplomat/models/asr-medium")).toBeVisible();
    expect(within(catalogRegion).getAllByText("1/2 profiles").length).toBeGreaterThan(0);
    const details = within(catalogRegion).getByRole("complementary", { name: "Model details" });
    expect(within(details).getByText("Faster Whisper Small")).toBeVisible();
    expect(within(details).getByText("Model package details")).toBeVisible();

    await user.click(within(catalogRegion).getByLabelText("Translation"));

    expect(within(catalogRegion).queryByText("Faster Whisper Small")).not.toBeInTheDocument();
    expect(within(catalogRegion).queryByText("Microsoft VibeVoice ASR")).not.toBeInTheDocument();
    expect(within(catalogRegion).getByText("OPUS-MT Chinese to English")).toBeVisible();
    expect(within(catalogRegion).getByText("Tencent Hunyuan MT 7B FP8")).toBeVisible();
    expect(within(details).getByText("OPUS-MT Chinese to English")).toBeVisible();
  });

  it("filters model management by search text and installation status, then refreshes the catalog", async () => {
    const user = userEvent.setup();
    stubMatchMedia();
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/models")) {
        return jsonResponse(modelCatalogFixture);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<ModelsPage />);

    expect(await screen.findByRole("heading", { name: "Recommended setup" })).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Advanced model catalog" }));
    const catalogRegion = screen.getByRole("region", { name: "Advanced model catalog" });
    expect(await within(catalogRegion).findByText("Faster Whisper Small")).toBeVisible();

    await user.type(within(catalogRegion).getByRole("searchbox", { name: "Search models" }), "VibeVoice");

    expect(within(catalogRegion).getByText("Microsoft VibeVoice ASR")).toBeVisible();
    expect(within(catalogRegion).queryByText("Faster Whisper Small")).not.toBeInTheDocument();
    expect(within(catalogRegion).queryByText("OPUS-MT Chinese to English")).not.toBeInTheDocument();

    await user.clear(within(catalogRegion).getByRole("searchbox", { name: "Search models" }));
    await user.selectOptions(within(catalogRegion).getByLabelText("Installation status"), "installed");

    expect(within(catalogRegion).getByText("Faster Whisper Medium")).toBeVisible();
    expect(within(catalogRegion).queryByText("Faster Whisper Small")).not.toBeInTheDocument();
    expect(within(catalogRegion).queryByText("OPUS-MT Chinese to English")).not.toBeInTheDocument();

    await user.click(within(catalogRegion).getByRole("button", { name: "Refresh models" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("calls model download, cancel, retry, and delete endpoints", async () => {
    const user = userEvent.setup();
    stubMatchMedia();
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/models") && init?.method === undefined) {
        return jsonResponse(modelCatalogFixture);
      }
      if (url.endsWith("/models/asr.faster-whisper.small/download")) {
        return jsonResponse({
          modelId: "asr.faster-whisper.small",
          status: "queued",
          downloadedBytes: 0,
          totalBytes: 244000000,
          message: "Model download queued."
        }, true, 202);
      }
      if (url.endsWith("/models/translation.opus-mt.zh-en/cancel")) {
        return jsonResponse({
          modelId: "translation.opus-mt.zh-en",
          status: "canceled",
          downloadedBytes: 32000000,
          totalBytes: 160000000,
          message: "Model download canceled."
        });
      }
      if (url.endsWith("/models/translation.qwen3.4b/retry")) {
        return jsonResponse({
          modelId: "translation.qwen3.4b",
          status: "queued",
          downloadedBytes: 0,
          totalBytes: 2500000000,
          message: "Model download queued."
        }, true, 202);
      }
      if (url.endsWith("/models/asr.faster-whisper.medium")) {
        return jsonResponse({
          modelId: "asr.faster-whisper.medium",
          filesDeleted: 3,
          bytesDeleted: 770000000,
          message: "Model deleted."
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<ModelsPage />);

    await screen.findByRole("heading", { name: "Recommended setup" });
    await user.click(screen.getByRole("button", { name: "Advanced model catalog" }));
    const catalogRegion = screen.getByRole("region", { name: "Advanced model catalog" });
    await within(catalogRegion).findByText("Faster Whisper Small");
    await user.click(within(catalogRegion).getByRole("button", { name: "Install Faster Whisper Small" }));
    await user.click(within(catalogRegion).getByRole("button", { name: "Cancel OPUS-MT Chinese to English" }));
    await user.click(within(catalogRegion).getByRole("button", { name: "Retry Qwen3 4B Translation" }));
    await user.click(within(catalogRegion).getByRole("button", { name: "Delete Faster Whisper Medium" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/models\/asr\.faster-whisper\.small\/download$/),
        expect.objectContaining({ method: "POST" })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/models\/translation\.opus-mt\.zh-en\/cancel$/),
        expect.objectContaining({ method: "POST" })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/models\/translation\.qwen3\.4b\/retry$/),
        expect.objectContaining({ method: "POST" })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/models\/asr\.faster-whisper\.medium$/),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  it("shows a friendly runtime settings action when the model catalog is unavailable", async () => {
    const user = userEvent.setup();
    useUiStore.getState().setLanguage("zh");
    await appI18n.changeLanguage("zh");
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/models")) {
          return jsonResponse(
            {
              detail:
                "Worker is not reachable at http://127.0.0.1:8765. Start the local runtime from Settings."
            },
            false,
            503
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    renderWithProviders(<ModelsPage />);

    expect(await screen.findByRole("main", { name: "模型" })).toBeVisible();
    const alert = await screen.findByRole("alert", undefined, { timeout: 3000 });
    expect(alert).toHaveTextContent("模型目录不可用");
    expect(alert).toHaveTextContent("本地运行时");
    expect(screen.queryByText(/127\.0\.0\.1:8765/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Worker is not reachable/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "打开运行时设置" }));

    expect(useUiStore.getState().currentPage).toBe("settings");
    expect(useUiStore.getState().settingsCategory).toBe("runtime");
  });

  it("localizes common model availability reasons in Chinese", async () => {
    useUiStore.getState().setLanguage("zh");
    await appI18n.changeLanguage("zh");
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/models")) {
          return jsonResponse(modelCatalogFixture);
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    renderWithProviders(<ModelsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "高级模型目录" }));
    const catalogRegion = screen.getByRole("region", { name: "高级模型目录" });
    expect((await within(catalogRegion).findAllByText("模型未安装。")).length).toBeGreaterThan(0);
    expect(within(catalogRegion).getByText("需要先接受模型许可证。")).toBeVisible();
    expect(within(catalogRegion).queryByText("Model is not installed.")).not.toBeInTheDocument();
    expect(within(catalogRegion).queryByText("Model license acceptance is required.")).not.toBeInTheDocument();
  });

  it("virtualizes long model catalogs instead of rendering every model row", async () => {
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/models")) {
          return jsonResponse({ models: makeManyModels(500) });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    renderWithProviders(<ModelsPage />);

    expect(await screen.findByRole("heading", { name: "Recommended setup" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Advanced model catalog" }));
    const catalogRegion = screen.getByRole("region", { name: "Advanced model catalog" });
    expect(await within(catalogRegion).findByText("Generated Model 1")).toBeVisible();
    expect(within(catalogRegion).getByText("80/500 visible")).toBeVisible();
    expect(within(catalogRegion).queryByText("Generated Model 500")).not.toBeInTheDocument();
    expect(within(catalogRegion).getAllByTestId(/^model-row-/)).toHaveLength(80);
  });
});
