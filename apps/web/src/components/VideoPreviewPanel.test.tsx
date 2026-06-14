import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzedDocumentFixture } from "../test/fixtures";
import { renderWithProviders } from "../test/render";
import { VideoPreviewPanel } from "./VideoPreviewPanel";

function stubMatchMedia() {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
}

beforeEach(() => {
  stubMatchMedia();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("VideoPreviewPanel", () => {
  it("renders worker-served media URL and reports playback time", () => {
    const onTimeUpdate = vi.fn();

    renderWithProviders(
      <VideoPreviewPanel
        mediaUrl="http://worker.test/projects/project-1/media/source"
        selectedLine={null}
        onTimeUpdate={onTimeUpdate}
      />
    );

    const video = screen.getByLabelText("Video preview media") as HTMLVideoElement;
    expect(video).toHaveAttribute("src", "http://worker.test/projects/project-1/media/source");

    video.currentTime = 1.234;
    fireEvent.timeUpdate(video);

    expect(onTimeUpdate).toHaveBeenCalledWith(1234);
  });

  it("applies seek requests to the video element", () => {
    const { rerender } = renderWithProviders(
      <VideoPreviewPanel
        mediaUrl="http://worker.test/projects/project-1/media/source"
        selectedLine={null}
        seekRequestMs={null}
      />
    );

    const video = screen.getByLabelText("Video preview media") as HTMLVideoElement;
    expect(video.currentTime).toBe(0);

    rerender(
      <VideoPreviewPanel
        mediaUrl="http://worker.test/projects/project-1/media/source"
        selectedLine={null}
        seekRequestMs={1500}
      />
    );

    expect(video.currentTime).toBe(1.5);
  });

  it("keeps selected subtitle overlay visible above media", () => {
    renderWithProviders(
      <VideoPreviewPanel
        mediaUrl="http://worker.test/projects/project-1/media/source"
        selectedLine={{
          ...analyzedDocumentFixture.lines[0]!,
          sourceText: "选中的字幕",
          translatedText: "Selected subtitle"
        }}
      />
    );

    expect(screen.getByText("选中的字幕")).toBeVisible();
    expect(screen.getByText("Selected subtitle")).toBeVisible();
  });

  it("renders styled subtitle preview and safe area overlay", () => {
    const style = {
      ...analyzedDocumentFixture.styles[0]!,
      primaryColor: "#ffeecc",
      secondaryColor: "#88f7ff",
      fontSize: 44,
      backgroundBar: true
    };

    renderWithProviders(
      <VideoPreviewPanel
        mediaUrl="http://worker.test/projects/project-1/media/source"
        selectedLine={{
          ...analyzedDocumentFixture.lines[0]!,
          sourceText: "Styled source",
          translatedText: "Styled target"
        }}
        previewStyle={style}
        showSafeArea
      />
    );

    expect(screen.getByText("Styled source")).toHaveStyle({ color: "#ffeecc" });
    expect(screen.getByText("Styled target")).toHaveStyle({ color: "#88f7ff" });
    expect(screen.getByTestId("subtitle-safe-area")).toBeInTheDocument();
  });
});
