import "@testing-library/jest-dom/vitest";
import { Button } from "@mantine/core";
import { cleanup, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { appI18n } from "../app/i18n";
import { useUiStore } from "../state/uiStore";
import { renderWithProviders } from "../test/render";
import { TaskStatusSurface } from "./TaskStatusSurface";

beforeAll(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

afterEach(async () => {
  cleanup();
  useUiStore.getState().resetUiState();
  await appI18n.changeLanguage("en");
});

describe("TaskStatusSurface", () => {
  it("renders running task status with progress", () => {
    renderWithProviders(<TaskStatusSurface busy message="Transcribing chunk 2 of 8" progress={0.25} />);

    expect(screen.getByRole("status")).toHaveTextContent("Running");
    expect(screen.getByText("Transcribing chunk 2 of 8")).toBeInTheDocument();
    expect(screen.getByLabelText("Task progress")).toBeInTheDocument();
  });

  it("renders queued, completed, and canceled states without requiring busy", () => {
    const { rerender } = renderWithProviders(
      <TaskStatusSurface busy={false} status="queued" message="Queued translation" />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Queued");

    rerender(<TaskStatusSurface busy={false} status="completed" message="Translation completed" />);

    expect(screen.getByRole("status")).toHaveTextContent("Completed");

    rerender(<TaskStatusSurface busy={false} status="canceled" message="Canceled by user" />);

    expect(screen.getByRole("status")).toHaveTextContent("Canceled");
  });

  it("renders failed errors with optional actions", () => {
    renderWithProviders(
      <TaskStatusSurface
        busy={false}
        error="CUDA out of memory"
        action={<Button>Retry</Button>}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("CUDA out of memory");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("localizes common backend task messages and errors in Chinese", async () => {
    useUiStore.getState().setLanguage("zh");
    await appI18n.changeLanguage("zh");
    const { rerender } = renderWithProviders(
      <TaskStatusSurface busy status="failed" message="Model is not installed" />
    );

    expect(screen.getByRole("status")).toHaveTextContent("模型未安装");
    expect(screen.queryByText("Model is not installed")).not.toBeInTheDocument();

    rerender(<TaskStatusSurface busy status="running" message="Transcribing audio" />);

    expect(screen.getByRole("status")).toHaveTextContent("正在转写音频");
    expect(screen.queryByText("Transcribing audio")).not.toBeInTheDocument();

    rerender(
      <TaskStatusSurface
        busy={false}
        error="Install the translation model before retrying."
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("请先安装翻译模型再重试。");
    expect(
      screen.queryByText("Install the translation model before retrying.")
    ).not.toBeInTheDocument();
  });
});
