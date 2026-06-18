import "@testing-library/jest-dom/vitest";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appI18n } from "../app/i18n";
import { renderWithProviders } from "../test/render";
import { TasksPage } from "./TasksPage";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await appI18n.changeLanguage("en");
});

describe("TasksPage", () => {
  it("renders localized task page copy", async () => {
    await appI18n.changeLanguage("zh");

    renderWithProviders(<TasksPage />);

    expect(screen.getByRole("main", { name: "任务" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "任务" })).toBeInTheDocument();
    expect(screen.getByText("长视频流水线")).toBeInTheDocument();
    expect(screen.getByText("智能切分")).toBeInTheDocument();
    expect(screen.getByText("ASR 转写")).toBeInTheDocument();
    expect(screen.getByText("恢复控制")).toBeInTheDocument();
  });
});
