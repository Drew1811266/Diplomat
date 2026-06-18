import { createTheme, rem } from "@mantine/core";

export const workstationSurfaces = {
  app: "#f4f7fb",
  rail: "#111827",
  railActive: "#0f766e",
  header: "#ffffff",
  panel: "#ffffff",
  panelAlt: "#f8fafc",
  outline: "#d7dee8",
  outlineStrong: "#aab7c7",
  text: "#111827",
  textMuted: "#5b677a",
  success: "#0f766e",
  warning: "#b45309",
  danger: "#be123c"
};

export const appTheme = createTheme({
  primaryColor: "teal",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  headings: {
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  },
  radius: {
    xs: rem(3),
    sm: rem(4),
    md: rem(6),
    lg: rem(8),
    xl: rem(8)
  },
  colors: {
    diplomatTeal: [
      "#e6fffb",
      "#c8f7f0",
      "#99f6e4",
      "#5eead4",
      "#2dd4bf",
      "#14b8a6",
      "#0f766e",
      "#115e59",
      "#134e4a",
      "#042f2e"
    ]
  },
  other: {
    workstationSurfaces
  }
});
