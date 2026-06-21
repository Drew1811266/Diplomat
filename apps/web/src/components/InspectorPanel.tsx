import { ActionIcon, Badge, Box, Group, Stack, Text, Title, Tooltip } from "@mantine/core";
import { IconHelpCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { workstationSurfaces } from "../app/theme";
import type { InspectorMode } from "../state/uiStore";

type InspectorPanelProps = {
  mode: InspectorMode;
  children: ReactNode;
  layout?: "side" | "stacked";
  onOpenHelp?: () => void;
};

const titleKeyByMode: Record<InspectorMode, string> = {
  media: "inspector.media",
  line: "inspector.line",
  analysis: "inspector.analysis",
  translation: "inspector.translation",
  style: "inspector.style",
  export: "inspector.export",
  "settings-lite": "inspector.projectSettings"
};

const projectScopedModes = new Set<InspectorMode>([
  "media",
  "analysis",
  "translation",
  "style",
  "export",
  "settings-lite"
]);

export function InspectorPanel({
  mode,
  children,
  layout = "side",
  onOpenHelp
}: InspectorPanelProps) {
  const { t } = useTranslation();
  const showProjectScope = projectScopedModes.has(mode);
  const title = t(titleKeyByMode[mode]);

  return (
    <Box
      component="aside"
      role="region"
      aria-label={t("workbench.labels.inspector")}
      bg={workstationSurfaces.panel}
      h="100%"
      style={{
        minHeight: 0,
        borderLeft: layout === "side" ? `1px solid ${workstationSurfaces.outline}` : undefined,
        borderTop: layout === "stacked" ? `1px solid ${workstationSurfaces.outline}` : undefined
      }}
    >
      <Stack gap="md" p="md" h="100%" style={{ minHeight: 0 }}>
        <Box>
          <Group gap={6} wrap="nowrap" align="center">
          <Title order={2} size="h4" c={workstationSurfaces.text}>
            {title}
          </Title>
            {onOpenHelp ? (
              <Tooltip label={t("help.context.openFor", { topic: title })} openDelay={400}>
                <ActionIcon
                  type="button"
                  aria-label={t("help.context.openFor", { topic: title })}
                  color="gray"
                  radius="sm"
                  size="sm"
                  variant="subtle"
                  onClick={onOpenHelp}
                >
                  <IconHelpCircle size={16} stroke={1.8} aria-hidden="true" />
                </ActionIcon>
              </Tooltip>
            ) : null}
          </Group>
        </Box>
        {showProjectScope ? (
          <Box
            role="note"
            aria-label={t("inspector.projectScopeLabel")}
            bg="#f0fdfa"
            px="sm"
            py={8}
            style={{
              border: `1px solid ${workstationSurfaces.outline}`,
              borderRadius: 6
            }}
          >
            <Group gap="xs" align="flex-start" wrap="nowrap">
              <Badge color="teal" variant="light" size="xs" style={{ flexShrink: 0 }}>
                {t("inspector.projectScopeLabel")}
              </Badge>
              <Text size="xs" c={workstationSurfaces.textMuted}>
                {t("inspector.projectScopeDescription")}
              </Text>
            </Group>
          </Box>
        ) : null}
        <Box data-testid="inspector-body" style={{ minHeight: 0, overflow: "auto" }}>
          {children}
        </Box>
      </Stack>
    </Box>
  );
}
