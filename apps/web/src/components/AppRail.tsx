import { ActionIcon, Stack, Tooltip } from "@mantine/core";
import {
  IconChecklist,
  IconDatabase,
  IconFolder,
  IconHelpCircle,
  IconLayoutDashboard,
  IconSettings
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
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
      gap="xs"
      px={8}
      py="sm"
      h="100%"
    >
      {navItems.map(({ page, icon: Icon, key }) => {
        const label = t(key);
        const active = currentPage === page;

        return (
          <Tooltip key={page} label={label} position="right" withArrow>
            <ActionIcon
              aria-label={label}
              color={active ? "teal" : "gray"}
              radius="md"
              size={40}
              variant={active ? "filled" : "subtle"}
              onClick={() => onNavigate(page)}
              styles={{
                root: {
                  color: active ? "#ffffff" : "#cbd5e1"
                }
              }}
            >
              <Icon size={22} stroke={1.8} aria-hidden="true" />
            </ActionIcon>
          </Tooltip>
        );
      })}
    </Stack>
  );
}
