import { Box, Group, List, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import {
  IconChecklist,
  IconDatabase,
  IconEdit,
  IconFileExport,
  IconFolder,
  IconRocket,
  IconSettings,
  IconShieldCheck,
  type Icon
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

const helpSections = [
  { key: "firstRun", icon: IconRocket },
  { key: "models", icon: IconDatabase },
  { key: "localWorkflow", icon: IconFolder },
  { key: "editing", icon: IconEdit },
  { key: "export", icon: IconFileExport },
  { key: "diagnostics", icon: IconSettings },
  { key: "privacy", icon: IconShieldCheck },
  { key: "releaseChecklist", icon: IconChecklist }
] as const;

type HelpSectionKey = (typeof helpSections)[number]["key"];

function helpItems(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function HelpSection({
  sectionKey,
  icon: SectionIcon
}: {
  sectionKey: HelpSectionKey;
  icon: Icon;
}) {
  const { t } = useTranslation();
  const items = helpItems(t(`help.sections.${sectionKey}.items`, { returnObjects: true }));

  return (
    <Box
      component="section"
      bg="#ffffff"
      p="md"
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 6
      }}
    >
      <Stack gap="sm">
        <Group gap="xs" wrap="nowrap" align="center">
          <ThemeIcon color="teal" variant="light" radius="md" size={32}>
            <SectionIcon size={18} stroke={1.8} aria-hidden="true" />
          </ThemeIcon>
          <Title order={3} size="h5">
            {t(`help.sections.${sectionKey}.title`)}
          </Title>
        </Group>
        <List size="sm" spacing={6} withPadding>
          {items.map((item) => (
            <List.Item key={item}>{item}</List.Item>
          ))}
        </List>
      </Stack>
    </Box>
  );
}

export function HelpPage() {
  const { t } = useTranslation();

  return (
    <Box component="main" aria-label={t("help.title")} maw={980}>
      <Stack gap="md">
        <Box>
          <Title order={2}>{t("help.title")}</Title>
          <Text size="sm" c="dimmed" mt={4}>
            {t("help.subtitle")}
          </Text>
        </Box>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {helpSections.map(({ key, icon }) => (
            <HelpSection key={key} sectionKey={key} icon={icon} />
          ))}
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
