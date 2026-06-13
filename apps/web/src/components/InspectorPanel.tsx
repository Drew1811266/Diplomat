import { Box, Stack, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import type { InspectorMode } from "../state/uiStore";

type InspectorPanelProps = {
  mode: InspectorMode;
  children: ReactNode;
};

const titleKeyByMode: Record<InspectorMode, string> = {
  line: "inspector.line",
  analysis: "inspector.analysis",
  translation: "inspector.translation",
  export: "inspector.export",
  "settings-lite": "inspector.line"
};

export function InspectorPanel({ mode, children }: InspectorPanelProps) {
  const { t } = useTranslation();

  return (
    <Box
      component="aside"
      role="region"
      aria-label="Inspector"
      bg="#ffffff"
      h="100%"
      style={{
        minHeight: 0,
        borderLeft: "1px solid #cbd5e1"
      }}
    >
      <Stack gap="md" p="md" h="100%">
        <Box>
          <Title order={2} size="h4" c="#0f172a">
            {t(titleKeyByMode[mode])}
          </Title>
        </Box>
        <Box style={{ minHeight: 0 }}>{children}</Box>
      </Stack>
    </Box>
  );
}
