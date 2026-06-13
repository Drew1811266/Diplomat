import { Badge, Box, Center, Group, Stack, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { InspectorPanel } from "../components/InspectorPanel";
import { TimelineStrip } from "../components/TimelineStrip";
import { TopToolbar } from "../components/TopToolbar";
import { VideoPreviewPanel } from "../components/VideoPreviewPanel";
import { useUiStore } from "../state/uiStore";

export function WorkbenchPage() {
  const { t } = useTranslation();
  const isNarrow = useMediaQuery("(max-width: 900px)");
  const inspectorMode = useUiStore((state) => state.inspectorMode);
  const setInspectorMode = useUiStore((state) => state.setInspectorMode);
  const selectedLine = null;
  const layout = isNarrow ? "stacked" : "split";

  return (
    <Box
      component="main"
      aria-label={t("workbench.title")}
      bg="#e9edf2"
      style={{
        height: "calc(100vh - 84px)",
        minHeight: 620,
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        overflow: "hidden",
        border: "1px solid #cbd5e1",
        borderRadius: 6
      }}
    >
      <TopToolbar
        canSave={false}
        canExport
        onInspectorMode={setInspectorMode}
        onSave={() => undefined}
      />

      <Box
        data-testid="workbench-body"
        data-layout={layout}
        style={{
          display: "grid",
          gridTemplateColumns: isNarrow ? "minmax(0, 1fr)" : "minmax(0, 1fr) 320px",
          gridTemplateRows: isNarrow ? "minmax(0, 1fr) minmax(260px, 40vh)" : undefined,
          minHeight: 0,
          overflow: isNarrow ? "auto" : "hidden"
        }}
      >
        <Box
          style={{
            display: "grid",
            gridTemplateRows: "minmax(240px, 45vh) minmax(0, 1fr) auto",
            minHeight: 0
          }}
        >
          <Box p="md" bg="#111827" style={{ minHeight: 0 }}>
            <VideoPreviewPanel sourceVideoPath={null} selectedLine={selectedLine} />
          </Box>

          <Box
            component="section"
            role="region"
            aria-label={t("workbench.subtitleGrid")}
            bg="#ffffff"
            style={{
              minHeight: 0,
              borderTop: "1px solid #cbd5e1",
              overflow: "hidden",
              display: "grid",
              gridTemplateRows: "36px minmax(0, 1fr)"
            }}
          >
            <Group
              h={36}
              px="sm"
              justify="space-between"
              wrap="nowrap"
              style={{ borderBottom: "1px solid #e2e8f0" }}
            >
              <Text size="sm" fw={700} c="#0f172a">
                {t("workbench.subtitleGrid")}
              </Text>
              <Badge size="sm" variant="light" color="gray">
                {t("status.ready")}
              </Badge>
            </Group>
            <Center data-testid="subtitle-grid-body" p="md" style={{ minHeight: 0, overflow: "auto" }}>
              <Stack align="center" gap={4}>
                <Text size="sm" fw={700} c="#334155">
                  {t("workbench.noDocument")}
                </Text>
              </Stack>
            </Center>
          </Box>

          <TimelineStrip durationMs={0} lineCount={0} />
        </Box>

        <InspectorPanel mode={inspectorMode} layout={isNarrow ? "stacked" : "side"}>
          <Stack gap="sm">
            <Text size="sm" c="#334155">
              {inspectorMode === "line" ? t("inspector.emptyLine") : t("status.ready")}
            </Text>
          </Stack>
        </InspectorPanel>
      </Box>
    </Box>
  );
}
