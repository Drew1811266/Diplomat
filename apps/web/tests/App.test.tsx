import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

describe("App", () => {
  it("renders the M0 workbench shell", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ name: "diplomat-worker", status: "ok", version: "0.1.0" })
      }))
    );

    render(<App />);

    expect(screen.getByRole("heading", { name: "Diplomat" })).toBeInTheDocument();
    expect(await screen.findByText("Worker: ok")).toBeInTheDocument();
  });
});
