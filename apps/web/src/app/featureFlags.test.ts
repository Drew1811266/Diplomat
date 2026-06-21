import { afterEach, describe, expect, it, vi } from "vitest";
import { getUiV2FeatureFlag } from "./featureFlags";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("feature flags", () => {
  it("enables the ui-v2 shell by default", () => {
    vi.stubEnv("VITE_DIPLOMAT_UI_V2", undefined);

    expect(getUiV2FeatureFlag()).toEqual({
      key: "ui-v2",
      enabled: true,
      source: "default"
    });
  });

  it.each(["false", "0", "off", "legacy"])(
    "allows the ui-v2 flag to be disabled with %s",
    (value) => {
      vi.stubEnv("VITE_DIPLOMAT_UI_V2", value);

      expect(getUiV2FeatureFlag()).toEqual({
        key: "ui-v2",
        enabled: false,
        source: "env"
      });
    }
  );
});
