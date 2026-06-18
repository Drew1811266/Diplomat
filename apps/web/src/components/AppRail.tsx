import { ActionIcon, Box, Stack, Tooltip } from "@mantine/core";
import {
  IconChecklist,
  IconDatabase,
  IconFolder,
  IconHelpCircle,
  IconLayoutDashboard,
  IconSettings
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { workstationSurfaces } from "../app/theme";
import type { AppPage } from "../state/uiStore";

type AppRailProps = {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
};

const navItems = [
  { page: "projects", icon: IconFolder, key: "nav.projects" },
  { page: "workbench", icon: IconLayoutDashboard, key: "nav.workbench" },
  { page: "models", icon: IconDatabase, key: "nav.models" },
  { page: "tasks", icon: IconChecklist, key: "nav.tasks" },
  { page: "help", icon: IconHelpCircle, key: "nav.help" },
  { page: "settings", icon: IconSettings, key: "nav.settings" }
] as const;

export function AppRail({ currentPage, onNavigate }: AppRailProps) {
  const { t } = useTranslation();

  return (
    <Stack
      role="navigation"
      aria-label="Application"
      align="center"
      gap={6}
      px={10}
      py="md"
      h="100%"
    >
      {navItems.map(({ page, icon: Icon, key }) => {
        const label = t(key);
        const active = currentPage === page;

        return (
          <Tooltip key={page} label={label} position="right" withArrow>
            <Box pos="relative" w={52} h={44}>
              {active ? (
                <Box
                  aria-hidden="true"
                  pos="absolute"
                  left={0}
                  top={8}
                  w={3}
                  h={28}
                  bg={workstationSurfaces.railActive}
                  style={{ borderRadius: 2 }}
                />
              ) : null}
              <ActionIcon
                aria-current={active ? "page" : undefined}
                aria-label={label}
                color={active ? "teal" : "gray"}
                data-active={active ? "true" : "false"}
                radius="md"
                size={44}
                variant={active ? "filled" : "subtle"}
                onClick={() => onNavigate(page)}
                styles={{
                  root: {
                    color: active ? "#ffffff" : "#cbd5e1",
                    marginLeft: 8,
                    transition: "background 160ms ease, color 160ms ease"
                  }
                }}
              >
                <Icon size={23} stroke={1.8} aria-hidden="true" />
              </ActionIcon>
            </Box>
          </Tooltip>
        );
      })}
    </Stack>
  );
}
