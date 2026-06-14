import type { CSSProperties } from "react";
import type { SubtitleStyle } from "@diplomat/shared";
import type { TimingValidationResult } from "./timingValidation";

export const defaultSubtitleStyle: SubtitleStyle = {
  id: "default",
  name: "Default",
  fontFamily: "Arial",
  fontSize: 36,
  primaryColor: "#FFFFFF",
  secondaryColor: "#14B8A6",
  strokeWidth: 3,
  shadow: 1,
  position: "bottom-center",
  marginV: 48,
  alignment: "center",
  bilingualLayout: "source-above-target",
  lineSpacing: 1.15,
  backgroundBar: false,
  backgroundColor: "#000000cc",
  safeAreaMargin: 32
};

export function subtitleStyleWithDefaults(
  style: Partial<SubtitleStyle> | null | undefined
): SubtitleStyle {
  return {
    ...defaultSubtitleStyle,
    ...style,
    id: style?.id?.trim() || defaultSubtitleStyle.id,
    name: style?.name?.trim() || defaultSubtitleStyle.name,
    fontFamily: style?.fontFamily?.trim() || defaultSubtitleStyle.fontFamily,
    primaryColor: style?.primaryColor?.trim() || defaultSubtitleStyle.primaryColor,
    secondaryColor: style?.secondaryColor?.trim() || defaultSubtitleStyle.secondaryColor,
    position: style?.position?.trim() || defaultSubtitleStyle.position,
    alignment: style?.alignment?.trim() || defaultSubtitleStyle.alignment,
    bilingualLayout: style?.bilingualLayout?.trim() || defaultSubtitleStyle.bilingualLayout,
    backgroundColor: style?.backgroundColor?.trim() || defaultSubtitleStyle.backgroundColor
  };
}

export function previewStyleToCss(style: SubtitleStyle): CSSProperties {
  const normalized = subtitleStyleWithDefaults(style);
  const stroke = Math.max(0, normalized.strokeWidth);
  const shadow = Math.max(0, normalized.shadow);
  return {
    color: normalized.primaryColor,
    fontFamily: `${normalized.fontFamily}, Arial, sans-serif`,
    fontSize: normalized.fontSize,
    lineHeight: normalized.lineSpacing,
    textAlign: textAlignForStyle(normalized),
    textShadow: [
      stroke > 0 ? `0 0 ${stroke}px rgba(0,0,0,0.92)` : null,
      shadow > 0 ? `0 ${shadow}px ${shadow * 3}px rgba(0,0,0,0.72)` : null
    ]
      .filter(Boolean)
      .join(", "),
    background: normalized.backgroundBar ? normalized.backgroundColor : "transparent"
  };
}

export function previewContainerStyle(style: SubtitleStyle): CSSProperties {
  const normalized = subtitleStyleWithDefaults(style);
  return {
    left: "14%",
    right: "14%",
    bottom: normalized.position.includes("top") ? undefined : normalized.marginV,
    top: normalized.position.includes("top") ? normalized.marginV : undefined,
    justifyContent: justifyContentForStyle(normalized)
  };
}

export function safeAreaStyle(style: SubtitleStyle): CSSProperties {
  const margin = subtitleStyleWithDefaults(style).safeAreaMargin;
  return {
    position: "absolute",
    inset: `${margin}px`,
    border: "1px dashed rgba(255,255,255,0.55)",
    pointerEvents: "none"
  };
}

export function hasBlockingTimingIssues(validation: TimingValidationResult): boolean {
  return validation.issues.some((issue) => issue.severity === "error");
}

export function timingIssueSummary(validation: TimingValidationResult) {
  return {
    errors: validation.issues.filter((issue) => issue.severity === "error").length,
    warnings: validation.issues.filter((issue) => issue.severity === "warning").length
  };
}

function textAlignForStyle(style: SubtitleStyle): CSSProperties["textAlign"] {
  if (style.alignment.includes("left")) {
    return "left";
  }
  if (style.alignment.includes("right")) {
    return "right";
  }
  return "center";
}

function justifyContentForStyle(style: SubtitleStyle): CSSProperties["justifyContent"] {
  if (style.alignment.includes("left")) {
    return "flex-start";
  }
  if (style.alignment.includes("right")) {
    return "flex-end";
  }
  return "center";
}
