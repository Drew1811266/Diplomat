import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appI18n } from "../app/i18n";
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

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
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
    expect(await screen.findByText("Faster Whisper Small")).toBeVisible();
    expect(screen.getByText("OPUS-MT Chinese to English")).toBeVisible();
    expect(screen.getAllByText("MIT").length).toBeGreaterThan(0);
    expect(screen.getByText("CC-BY-4.0")).toBeVisible();
    expect(screen.getAllByText("faster-whisper").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ct2-marian").length).toBeGreaterThan(0);
    expect(screen.getByText("zh -> en")).toBeVisible();
    expect(screen.getByText("D:/Diplomat/models/asr-medium")).toBeVisible();
    expect(screen.getAllByText("1/2 profiles").length).toBeGreaterThan(0);

    await user.click(screen.getByLabelText("Translation"));

    expect(screen.queryByText("Faster Whisper Small")).not.toBeInTheDocument();
    expect(screen.getByText("OPUS-MT Chinese to English")).toBeVisible();
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

    await screen.findByText("Faster Whisper Small");
    await user.click(screen.getByRole("button", { name: "Install Faster Whisper Small" }));
    await user.click(screen.getByRole("button", { name: "Cancel OPUS-MT Chinese to English" }));
    await user.click(screen.getByRole("button", { name: "Retry Qwen3 4B Translation" }));
    await user.click(screen.getByRole("button", { name: "Delete Faster Whisper Medium" }));

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

  it("surfaces model query errors and localizes the page title", async () => {
    await appI18n.changeLanguage("zh");
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/models")) {
          return jsonResponse({ detail: "model registry unavailable" }, false, 503);
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    renderWithProviders(<ModelsPage />);

    expect(await screen.findByRole("main", { name: "模型" })).toBeVisible();
    expect(await screen.findByRole("alert", undefined, { timeout: 3000 })).toHaveTextContent(
      "model registry unavailable"
    );
  });
});
