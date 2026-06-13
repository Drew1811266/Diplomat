import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppProviders } from "./AppProviders";

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
});
