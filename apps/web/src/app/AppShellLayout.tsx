import { AppShell, Badge, Box, Group, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AppRail } from "../components/AppRail";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useUiStore } from "../state/uiStore";
import { workstationSurfaces } from "./theme";

type AppShellLayoutProps = {
  children: ReactNode;
};

export function AppShellLayout({ children }: AppShellLayoutProps) {
  const { t } = useTranslation();
  const currentPage = useUiStore((state) => state.currentPage);
  const setPage = useUiStore((state) => state.setPage);
  const currentPageLabel = t(`nav.${currentPage}`);

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 72, breakpoint: 0 }}
      padding={0}
      styles={{
        root: { minHeight: "100vh", background: workstationSurfaces.app },
        header: {
          background: workstationSurfaces.header,
          borderBottom: `1px solid ${workstationSurfaces.outline}`
        },
        navbar: {
          background: workstationSurfaces.rail,
          borderRight: "1px solid #0f172a"
        },
        main: {
          minHeight: "100vh",
          background: workstationSurfaces.app,
          paddingTop: 56,
          paddingLeft: 72
        }
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
          <Group gap="md" wrap="nowrap" miw={0}>
            <Title order={1} size="h4" c={workstationSurfaces.text} lh={1}>
              {t("app.name")}
            </Title>
            <Text size="sm" fw={700} c={workstationSurfaces.textMuted} truncate>
              {t("app.subtitle")}
            </Text>
            <Badge variant="light" color="teal" radius="sm" tt="none">
              {currentPageLabel}
            </Badge>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Badge variant="outline" color="gray" radius="sm" tt="none">
              {t("settings.runtime")} · {t("status.ready")}
            </Badge>
            <LanguageSwitcher />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar>
        <AppRail currentPage={currentPage} onNavigate={setPage} />
      </AppShell.Navbar>

      <AppShell.Main>
        <Box p="lg" style={{ minWidth: 0, maxWidth: "100%" }}>
          {children}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
