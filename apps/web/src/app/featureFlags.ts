export type FeatureFlagState = {
  key: "ui-v2";
  enabled: boolean;
  source: "default" | "env";
};

const disabledUiV2Values = new Set(["0", "false", "off", "legacy"]);

export function getUiV2FeatureFlag(): FeatureFlagState {
  const rawValue = import.meta.env.VITE_DIPLOMAT_UI_V2;
  if (rawValue === undefined || rawValue === "") {
    return {
      key: "ui-v2",
      enabled: true,
      source: "default"
    };
  }

  return {
    key: "ui-v2",
    enabled: !disabledUiV2Values.has(rawValue.trim().toLowerCase()),
    source: "env"
  };
}
