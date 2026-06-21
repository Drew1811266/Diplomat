import { Box, Button, Group, List, Stack, Text, TextInput, ThemeIcon, Title } from "@mantine/core";
import {
  IconAlertTriangle,
  IconClockCheck,
  IconDatabase,
  IconFileExport,
  IconFolder,
  IconKeyboard,
  IconLanguage,
  IconListCheck,
  IconMicrophone,
  IconPalette,
  IconRocket,
  IconSettings,
  IconShieldCheck,
  type Icon
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { workstationSurfaces } from "../app/theme";
import { useUiStore, type HelpTopic } from "../state/uiStore";

const helpSections = [
  { key: "quickStart", icon: IconRocket },
  { key: "projectsMedia", icon: IconFolder },
  { key: "transcription", icon: IconMicrophone },
  { key: "translation", icon: IconLanguage },
  { key: "timingQa", icon: IconClockCheck },
  { key: "style", icon: IconPalette },
  { key: "export", icon: IconFileExport },
  { key: "models", icon: IconDatabase },
  { key: "tasksRecovery", icon: IconListCheck },
  { key: "runtime", icon: IconSettings },
  { key: "shortcuts", icon: IconKeyboard },
  { key: "privacy", icon: IconShieldCheck },
  { key: "troubleshooting", icon: IconAlertTriangle }
] as const;

type HelpSectionKey = Extract<(typeof helpSections)[number]["key"], HelpTopic>;

function helpItems(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function tocPreview(item: string) {
  if (item.length <= 44) {
    return item;
  }

  const splitPoints = [", then ", "; ", ". ", " and ", ","];
  const splitIndex = splitPoints
    .map((point) => item.indexOf(point))
    .filter((index) => index >= 18 && index <= 44)
    .sort((first, second) => first - second)[0];

  if (splitIndex) {
    return item.slice(0, splitIndex).replace(/[,.]$/, "");
  }

  return `${item.slice(0, 42).trim()}...`;
}

function HelpArticle({
  sectionKey,
  icon: SectionIcon
}: {
  sectionKey: HelpSectionKey;
  icon: Icon;
}) {
  const { t } = useTranslation();
  const items = helpItems(t(`help.sections.${sectionKey}.items`, { returnObjects: true }));
  const title = t(`help.sections.${sectionKey}.title`);
  const titleId = `help-title-${sectionKey}`;

  return (
    <Box
      id={`help-${sectionKey}`}
      component="article"
      aria-labelledby={titleId}
      bg={workstationSurfaces.panel}
      p="lg"
      style={{
        border: `1px solid ${workstationSurfaces.outline}`,
        borderRadius: 6
      }}
    >
      <Stack gap="md">
        <Group gap="xs" wrap="nowrap" align="center">
          <ThemeIcon color="teal" variant="light" radius="md" size={32}>
            <SectionIcon size={18} stroke={1.8} aria-hidden="true" />
          </ThemeIcon>
          <Title id={titleId} order={3} size="h4">
            {title}
          </Title>
        </Group>
        <List size="sm" spacing="sm" withPadding>
          {items.map((item, index) => (
            <List.Item key={item} id={`help-${sectionKey}-item-${index}`}>
              {item}
            </List.Item>
          ))}
        </List>
      </Stack>
    </Box>
  );
}

function HelpArticleToc({ sectionKey }: { sectionKey: HelpSectionKey }) {
  const { t } = useTranslation();
  const items = helpItems(t(`help.sections.${sectionKey}.items`, { returnObjects: true }));

  return (
    <Box
      className="diplomat-help-toc diplomat-sticky-nav"
      bg={workstationSurfaces.panel}
      p="sm"
      style={{
        border: `1px solid ${workstationSurfaces.outline}`,
        borderRadius: 6
      }}
    >
      <Stack role="navigation" aria-label={t("help.articleSectionsNav")} gap={4}>
        <Text size="xs" fw={800} c="dimmed" px="xs">
          {t("help.articleSectionsNav")}
        </Text>
        {items.map((item, index) => (
          <Button
            key={`${sectionKey}-${index}`}
            component="a"
            href={`#help-${sectionKey}-item-${index}`}
            aria-label={item}
            variant="subtle"
            color="gray"
            size="compact-xs"
            justify="flex-start"
            title={item}
            styles={{
              root: {
                height: "auto",
                minHeight: 30,
                paddingBlock: 6,
                paddingInline: 8
              },
              inner: {
                alignItems: "flex-start"
              },
              label: {
                display: "block",
                lineHeight: 1.25,
                textAlign: "left",
                whiteSpace: "normal",
                width: "100%"
              }
            }}
          >
            <Text component="span" size="xs" fw={700} c="inherit" lineClamp={2}>
              {index + 1}. {tocPreview(item)}
            </Text>
          </Button>
        ))}
      </Stack>
    </Box>
  );
}

export function HelpPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const activeTopic = useUiStore((state) => state.helpTopic);
  const setActiveTopic = useUiStore((state) => state.setHelpTopic);
  const filteredSections = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return helpSections;
    }

    return helpSections.filter(({ key }) => {
      const title = t(`help.sections.${key}.title`).toLocaleLowerCase();
      const items = helpItems(t(`help.sections.${key}.items`, { returnObjects: true }))
        .join(" ")
        .toLocaleLowerCase();
      return `${title} ${items}`.includes(normalizedQuery);
    });
  }, [query, t]);

  const selectedSection =
    filteredSections.find(({ key }) => key === activeTopic) ?? filteredSections[0] ?? null;

  return (
    <Box component="main" aria-label={t("help.title")} maw={1340}>
      <Stack gap="md">
        <Box>
          <Title order={1}>{t("help.title")}</Title>
          <Text size="sm" c="dimmed" mt={4}>
            {t("help.subtitle")}
          </Text>
        </Box>

        <Box
          p="md"
          style={{
            border: `1px solid ${workstationSurfaces.outline}`,
            borderRadius: 6,
            background: workstationSurfaces.panel
          }}
        >
          <Stack gap="sm">
            <TextInput
              type="search"
              label={t("help.search")}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </Stack>
        </Box>

        <Box className="diplomat-help-layout">
          <Box
            className="diplomat-sticky-nav"
            bg={workstationSurfaces.panel}
            p="sm"
            style={{
              border: `1px solid ${workstationSurfaces.outline}`,
              borderRadius: 6
            }}
          >
            <Stack role="navigation" aria-label={t("help.topicsNav")} gap={4}>
              {filteredSections.map(({ key, icon: TopicIcon }) => (
                <Button
                  key={key}
                  type="button"
                  variant={selectedSection?.key === key ? "light" : "subtle"}
                  color="teal"
                  size="sm"
                  fullWidth
                  justify="flex-start"
                  leftSection={<TopicIcon size={16} stroke={1.8} aria-hidden="true" />}
                  aria-current={selectedSection?.key === key ? "page" : undefined}
                  onClick={() => setActiveTopic(key)}
                >
                  {t(`help.sections.${key}.title`)}
                </Button>
              ))}
              {filteredSections.length === 0 ? (
                <Text size="sm" c="dimmed" px="xs" py="sm">
                  {t("help.noResults")}
                </Text>
              ) : null}
            </Stack>
          </Box>

          <Box className="diplomat-help-article">
            {selectedSection ? (
              <HelpArticle sectionKey={selectedSection.key} icon={selectedSection.icon} />
            ) : (
              <Box
                bg={workstationSurfaces.panel}
                p="lg"
                style={{
                  border: `1px solid ${workstationSurfaces.outline}`,
                  borderRadius: 6
                }}
              >
                <Text c="dimmed">{t("help.noResults")}</Text>
              </Box>
            )}
          </Box>

          {selectedSection ? <HelpArticleToc sectionKey={selectedSection.key} /> : null}
        </Box>
      </Stack>
    </Box>
  );
}
