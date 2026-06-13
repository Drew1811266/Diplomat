import { createTheme, rem } from "@mantine/core";

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
  }
});
