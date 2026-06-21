import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { useEffect, useState, type ReactNode } from "react";
import { useUiStore } from "../state/uiStore";
import { appI18n } from "./i18n";
import { createAppQueryClient } from "./queryClient";
import { appTheme } from "./theme";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => createAppQueryClient());

  return (
    <I18nextProvider i18n={appI18n}>
      <AppLanguageSync />
      <QueryClientProvider client={queryClient}>
        <MantineProvider theme={appTheme} defaultColorScheme="light">
          <Notifications position="top-right" />
          {children}
        </MantineProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

function AppLanguageSync() {
  const language = useUiStore((state) => state.language);

  useEffect(() => {
    if (appI18n.resolvedLanguage !== language && appI18n.language !== language) {
      void appI18n.changeLanguage(language);
    }
  }, [language]);

  return null;
}
