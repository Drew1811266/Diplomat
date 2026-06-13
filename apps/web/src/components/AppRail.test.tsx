import "@testing-library/jest-dom/vitest";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppRail } from "./AppRail";
import { renderWithProviders } from "../test/render";

function stubMatchMedia() {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
}

describe("AppRail", () => {
  it("renders primary navigation buttons and reports navigation", () => {
    const onNavigate = vi.fn();
    stubMatchMedia();

    renderWithProviders(<AppRail currentPage="projects" onNavigate={onNavigate} />);

    expect(screen.getByRole("button", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Workbench" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(onNavigate).toHaveBeenCalledWith("settings");
  });
});
