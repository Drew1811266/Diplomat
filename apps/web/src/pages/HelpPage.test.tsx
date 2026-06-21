import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appI18n } from "../app/i18n";
import { useUiStore } from "../state/uiStore";
import { renderWithProviders } from "../test/render";
import { HelpPage } from "./HelpPage";

function stubMatchMedia() {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
}

function stubResizeObserver() {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn()
    }))
  );
}

beforeEach(async () => {
  stubMatchMedia();
  stubResizeObserver();
  localStorage.clear();
  useUiStore.getState().resetUiState();
  await appI18n.changeLanguage("en");
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  useUiStore.getState().resetUiState();
  await appI18n.changeLanguage("en");
});

describe("HelpPage", () => {
  it("renders a document-style help center with one active article", () => {
    renderWithProviders(<HelpPage />);

    expect(screen.getByRole("main", { name: "Help Center" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Help Center" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search help" })).toBeInTheDocument();

    const topics = screen.getByRole("navigation", { name: "Help topics" });
    expect(within(topics).getByRole("button", { name: "Quick start" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(topics).getByRole("button", { name: "Model management" })).toBeInTheDocument();
    expect(within(topics).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Quick start",
      "Projects and media",
      "Transcribe",
      "Translate",
      "Timing and QA",
      "Style",
      "Export",
      "Model management",
      "Tasks and recovery",
      "Runtime",
      "Keyboard shortcuts",
      "Privacy",
      "Troubleshooting"
    ]);

    const article = screen.getByRole("article", { name: "Quick start" });
    expect(within(article).getByRole("heading", { name: "Quick start" })).toBeInTheDocument();
    const articleSections = screen.getByRole("navigation", { name: "Article sections" });
    expect(
      within(articleSections).getByRole("link", {
        name: "Create a project in Project Library, open it, then import local videos from the Workbench."
      })
    ).toHaveAttribute("href", "#help-quickStart-item-1");
    expect(screen.queryByRole("heading", { name: "Model management" })).not.toBeInTheDocument();
    expect(
      within(article).getByText(
        "Create a project in Project Library, open it, then import local videos from the Workbench."
      )
    ).toBeInTheDocument();
  });

  it("switches Chinese help topics as single articles", async () => {
    const user = userEvent.setup();
    useUiStore.getState().setLanguage("zh");
    await appI18n.changeLanguage("zh");

    renderWithProviders(<HelpPage />);

    expect(screen.getByRole("main", { name: "帮助中心" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "帮助中心" })).toBeInTheDocument();

    const topics = screen.getByRole("navigation", { name: "帮助主题" });
    expect(within(topics).getByRole("button", { name: "快速开始" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.queryByRole("heading", { name: "模型管理" })).not.toBeInTheDocument();

    await user.click(within(topics).getByRole("button", { name: "模型管理" }));

    const article = screen.getByRole("article", { name: "模型管理" });
    expect(article).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "文章目录" })).toBeInTheDocument();
    expect(within(article).getByText("只安装“设置 > 模型”中列出的内置开源模型。")).toBeInTheDocument();
  });

  it("filters help topics and opens the matching article", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HelpPage />);

    await user.type(screen.getByRole("searchbox", { name: "Search help" }), "checksum");

    const topics = screen.getByRole("navigation", { name: "Help topics" });
    expect(within(topics).queryByRole("button", { name: "Quick start" })).not.toBeInTheDocument();
    expect(within(topics).getByRole("button", { name: "Model management" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    const article = screen.getByRole("article", { name: "Model management" });
    expect(article).toBeInTheDocument();
    expect(
      within(article).getByText(
        "Install only the curated open-source models listed in Settings > Models."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Privacy" })).not.toBeInTheDocument();
  });
});
