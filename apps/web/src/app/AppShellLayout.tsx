import { AppShell, Box, Group, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AppRail } from "../components/AppRail";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useUiStore } from "../state/uiStore";

type AppShellLayoutProps = {
  children: ReactNode;
};

export function AppShellLayout({ children }: AppShellLayoutProps) {
  const { t } = useTranslation();
  const currentPage = useUiStore((state) => state.currentPage);
  const setPage = useUiStore((state) => state.setPage);

  return (
    <AppShell
      header={{ height: 48 }}
      navbar={{ width: 56, breakpoint: 0 }}
      padding={0}
      styles={{
        root: { minHeight: "100vh", background: "#e9edf2" },
        header: {
          background: "#f8fafc",
          borderBottom: "1px solid #cbd5e1"
        },
        navbar: {
          background: "#111827",
          borderRight: "1px solid #0f172a"
        },
        main: {
          minHeight: "100vh",
          background: "#e9edf2",
          paddingTop: 48,
          paddingLeft: 56
        }
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Title order={1} size="h4" c="#0f172a" lh={1}>
              {t("app.name")}
            </Title>
            <Text size="sm" fw={700} c="dimmed" truncate>
              {t("app.subtitle")}
            </Text>
          </Group>
          <LanguageSwitcher />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar>
        <AppRail currentPage={currentPage} onNavigate={setPage} />
      </AppShell.Navbar>

      <AppShell.Main>
        <Box p="lg" style={{ minWidth: 0 }}>
          {children}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
