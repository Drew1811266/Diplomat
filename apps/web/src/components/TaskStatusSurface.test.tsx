import "@testing-library/jest-dom/vitest";
import { Button } from "@mantine/core";
import { cleanup, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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

afterEach(() => {
  cleanup();
});

describe("TaskStatusSurface", () => {
  it("renders running task status with progress", () => {
    renderWithProviders(<TaskStatusSurface busy message="Transcribing chunk 2 of 8" progress={0.25} />);

    expect(screen.getByRole("status")).toHaveTextContent("Running");
    expect(screen.getByText("Transcribing chunk 2 of 8")).toBeInTheDocument();
    expect(screen.getByLabelText("Task progress")).toBeInTheDocument();
  });

  it("renders queued and completed states without requiring busy", () => {
    const { rerender } = renderWithProviders(
      <TaskStatusSurface busy={false} status="queued" message="Queued translation" />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Queued");

    rerender(<TaskStatusSurface busy={false} status="completed" message="Translation completed" />);

    expect(screen.getByRole("status")).toHaveTextContent("Completed");
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
});
