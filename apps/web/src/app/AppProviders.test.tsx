import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppProviders } from "./AppProviders";
import { workstationSurfaces } from "./theme";

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

describe("AppProviders", () => {
  it("renders children inside Mantine, Query, and i18n providers", () => {
    render(
      <AppProviders>
        <button type="button">Provider child</button>
      </AppProviders>
    );

    expect(screen.getByRole("button", { name: "Provider child" })).toBeInTheDocument();
  });

  it("exports workstation surface tokens for the desktop shell", () => {
    expect(workstationSurfaces.app).toBe("#f4f7fb");
    expect(workstationSurfaces.rail).toBe("#111827");
    expect(workstationSurfaces.panel).toBe("#ffffff");
  });
});
